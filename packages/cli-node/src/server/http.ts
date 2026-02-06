/**
 * Cognitive Modules HTTP API Server
 * 
 * Provides RESTful API interface for workflow platform integration.
 * 
 * Start with:
 *   cog serve --port 8000
 * 
 * Environment variables:
 *   COGNITIVE_API_KEY - API Key authentication (optional)
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. - LLM provider keys
 */

import http from 'node:http';
import { URL } from 'node:url';
import { findModule, listModules, getDefaultSearchPaths } from '../modules/loader.js';
import { runModule } from '../modules/runner.js';
import { getProvider } from '../providers/index.js';
import type { CognitiveModule, Provider, EnvelopeError } from '../types.js';
import { VERSION } from '../version.js';
import { ErrorCodes, makeErrorEnvelope, makeHttpError } from '../errors/index.js';

// =============================================================================
// Types
// =============================================================================

interface RunRequest {
  module: string;
  args: string;
  provider?: string;
  model?: string;
  version?: string;  // Protocol version (default: "2.2")
}

// Supported protocol versions
const SUPPORTED_VERSIONS = ['2.2', '2.1'] as const;
const DEFAULT_VERSION = '2.2';

/**
 * Get requested protocol version from request
 * Priority: body.version > X-Cognitive-Version header > query param > default
 */
function getRequestedVersion(
  req: http.IncomingMessage,
  url: URL,
  bodyVersion?: string
): string {
  // Body version takes priority
  if (bodyVersion && SUPPORTED_VERSIONS.includes(bodyVersion as typeof SUPPORTED_VERSIONS[number])) {
    return bodyVersion;
  }
  
  // Check header
  const headerVersion = req.headers['x-cognitive-version'] as string | undefined;
  if (headerVersion && SUPPORTED_VERSIONS.includes(headerVersion as typeof SUPPORTED_VERSIONS[number])) {
    return headerVersion;
  }
  
  // Check query param
  const queryVersion = url.searchParams.get('version');
  if (queryVersion && SUPPORTED_VERSIONS.includes(queryVersion as typeof SUPPORTED_VERSIONS[number])) {
    return queryVersion;
  }
  
  return DEFAULT_VERSION;
}

/**
 * v2.2 Envelope Response - Unified format for HTTP API
 * 
 * Success: { ok: true, version, meta, data, module, provider }
 * Failure: { ok: false, version, meta, error, partial_data?, module, provider }
 * 
 * Error structure follows ERROR-CODES.md specification.
 */
interface RunResponse {
  ok: boolean;
  version: string;
  meta: {
    confidence: number;
    risk: 'none' | 'low' | 'medium' | 'high';
    explain: string;
    trace_id?: string;
    model?: string;
    latency_ms?: number;
  };
  data?: unknown;
  error?: EnvelopeError;
  partial_data?: unknown;
  module: string;
  provider?: string;
}

interface ModuleInfo {
  name: string;
  version?: string;
  description?: string;
  format: string;
  path: string;
  responsibility?: string;
  tier?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(res: http.ServerResponse, status: number, data: unknown, protocolVersion: string = DEFAULT_VERSION): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cognitive-Version',
    'X-Cognitive-Version': protocolVersion,
  });
  res.end(JSON.stringify(data, null, 2));
}

const MAX_BODY_BYTES = 1024 * 1024; // 1MB

function parseBody(req: http.IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let received = 0;
    req.on('data', (chunk) => {
      const chunkSize = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      received += chunkSize;
      if (received > maxBytes) {
        const err = new Error('Payload too large');
        (err as { code?: string }).code = 'PAYLOAD_TOO_LARGE';
        req.destroy(err);
        reject(err);
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function verifyApiKey(req: http.IncomingMessage): boolean {
  const expectedKey = process.env.COGNITIVE_API_KEY;
  if (!expectedKey) return true; // No auth required
  
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === expectedKey;
}

// =============================================================================
// Request Handlers
// =============================================================================

async function handleRoot(res: http.ServerResponse): Promise<void> {
  jsonResponse(res, 200, {
    name: 'Cognitive Modules API',
    version: VERSION,
    protocol: {
      version: DEFAULT_VERSION,
      supported: SUPPORTED_VERSIONS,
      negotiation: {
        header: 'X-Cognitive-Version',
        query: '?version=2.2',
        body: 'version field in request body',
      },
    },
    docs: '/docs',
    endpoints: {
      run: 'POST /run',
      modules: 'GET /modules',
      module_info: 'GET /modules/{name}',
      health: 'GET /health',
    },
  });
}

async function handleHealth(res: http.ServerResponse): Promise<void> {
  const providers = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    minimax: Boolean(process.env.MINIMAX_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    qwen: Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
  };
  
  jsonResponse(res, 200, {
    status: 'healthy',
    version: VERSION,
    providers,
  });
}

async function handleModules(
  res: http.ServerResponse,
  searchPaths: string[]
): Promise<void> {
  const modules = await listModules(searchPaths);
  
  const moduleInfos: ModuleInfo[] = modules.map((m) => ({
    name: m.name,
    version: m.version,
    description: m.responsibility,
    format: m.format,
    path: m.location,
    responsibility: m.responsibility,
    tier: m.tier,
  }));
  
  jsonResponse(res, 200, {
    modules: moduleInfos,
    count: moduleInfos.length,
  });
}

async function handleModuleInfo(
  res: http.ServerResponse,
  moduleName: string,
  searchPaths: string[]
): Promise<void> {
  const moduleData = await findModule(moduleName, searchPaths);
  
  if (!moduleData) {
    const envelope = makeErrorEnvelope({
      code: ErrorCodes.MODULE_NOT_FOUND,
      message: `Module '${moduleName}' not found`,
      suggestion: 'Use GET /modules to list available modules',
    });
    jsonResponse(res, 404, envelope);
    return;
  }
  
  jsonResponse(res, 200, {
    name: moduleData.name,
    version: moduleData.version,
    description: moduleData.responsibility,
    format: moduleData.format,
    path: moduleData.location,
    responsibility: moduleData.responsibility,
    tier: moduleData.tier,
    inputSchema: moduleData.inputSchema,
    outputSchema: moduleData.outputSchema,
  });
}

async function handleRun(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  searchPaths: string[],
  url: URL
): Promise<void> {
  // Version will be determined after parsing body
  let protocolVersion = DEFAULT_VERSION;
  
  // Helper to build error envelope using unified error factory
  const buildHttpError = (
    code: string,
    message: string,
    options: {
      moduleName?: string;
      providerName?: string;
      suggestion?: string;
      recoverable?: boolean;
      retry_after_ms?: number;
    } = {}
  ): [number, RunResponse] => {
    const moduleName = options.moduleName ?? request?.module ?? 'unknown';
    const providerName = options.providerName ?? request?.provider ?? 'unknown';
    const [status, envelope] = makeHttpError({
      code,
      message,
      version: protocolVersion,
      suggestion: options.suggestion,
      recoverable: options.recoverable,
      retry_after_ms: options.retry_after_ms,
      module: moduleName,
      provider: providerName,
    });
    
    return [status, envelope as RunResponse];
  };

  // Verify API key
  if (!verifyApiKey(req)) {
    jsonResponse(res, 401, buildHttpError(
      ErrorCodes.PERMISSION_DENIED,
      'Missing or invalid API Key',
      { suggestion: 'Use header: Authorization: Bearer <your-api-key>' }
    ), protocolVersion);
    return;
  }
  
  // Parse request body
  let request: RunRequest | undefined;
  try {
    const body = await parseBody(req);
    request = JSON.parse(body);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === 'PAYLOAD_TOO_LARGE') {
      const [status, body] = buildHttpError(
        ErrorCodes.INPUT_TOO_LARGE,
        'Payload too large',
        { suggestion: 'Reduce input size to under 1MB' }
      );
      jsonResponse(res, status, body, protocolVersion);
      return;
    }
    const [status, body] = buildHttpError(
      ErrorCodes.PARSE_ERROR,
      'Invalid JSON body',
      { suggestion: 'Ensure request body is valid JSON' }
    );
    jsonResponse(res, status, body, protocolVersion);
    return;
  }

  if (!request || typeof request !== 'object') {
    const [status, body] = buildHttpError(
      ErrorCodes.INVALID_INPUT,
      'Invalid request body',
      { suggestion: 'Ensure request body is a JSON object' }
    );
    jsonResponse(res, status, body, protocolVersion);
    return;
  }

  const reqBody = request as RunRequest;

  // Determine protocol version (body > header > query > default)
  protocolVersion = getRequestedVersion(req, url, reqBody.version);
  
  // Validate request
  if (!reqBody.module || !reqBody.args) {
    const [status, body] = buildHttpError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      'Missing required fields: module, args',
      { 
        moduleName: reqBody?.module ?? 'unknown',
        suggestion: 'Provide both "module" and "args" fields in request body'
      }
    );
    jsonResponse(res, status, body, protocolVersion);
    return;
  }
  
  // Find module
  const moduleData = await findModule(reqBody.module, searchPaths);
  if (!moduleData) {
    const [status, body] = buildHttpError(
      ErrorCodes.MODULE_NOT_FOUND,
      `Module '${reqBody.module}' not found`,
      { 
        moduleName: reqBody.module,
        suggestion: 'Use GET /modules to list available modules'
      }
    );
    jsonResponse(res, status, body, protocolVersion);
    return;
  }
  
  try {
    // Create provider
    const provider = getProvider(reqBody.provider, reqBody.model);
    const providerName = provider.name;
    
    // Run module (always use v2.2 format internally)
    const result = await runModule(moduleData, provider, {
      args: reqBody.args,
      useV22: true,
    });
    
    // Build response envelope with requested protocol version
    if (result.ok && 'data' in result) {
      const v22Result = result as { 
        ok: true; 
        meta?: RunResponse['meta']; 
        data: unknown;
      };
      const response: RunResponse = {
        ok: true,
        version: protocolVersion,
        meta: v22Result.meta ?? {
          confidence: 0.5,
          risk: 'medium',
          explain: 'No meta provided',
        },
        data: v22Result.data,
        module: reqBody.module,
        provider: providerName,
      };
      jsonResponse(res, 200, response, protocolVersion);
    } else {
      // Error response - must include meta and full error object
      const errorResult = result as { 
        ok: false; 
        meta?: RunResponse['meta']; 
        error?: { code: string; message: string; recoverable?: boolean; suggestion?: string };
        partial_data?: unknown;
      };
      
      const response: RunResponse = {
        ok: false,
        version: protocolVersion,
        meta: errorResult.meta ?? {
          confidence: 0.0,
          risk: 'high',
          explain: errorResult.error?.message ?? 'An error occurred',
        },
        error: errorResult.error ?? {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Unknown error',
          recoverable: false,
        },
        partial_data: errorResult.partial_data,
        module: reqBody.module,
        provider: providerName,
      };
      jsonResponse(res, 200, response, protocolVersion);
    }
  } catch (error) {
    // Infrastructure error - still return envelope
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [status, response] = buildHttpError(
      ErrorCodes.INTERNAL_ERROR,
      errorMessage,
      {
        moduleName: reqBody?.module,
        providerName: reqBody?.provider,
        recoverable: false,
      }
    );
    jsonResponse(res, status, response, protocolVersion);
  }
}

// =============================================================================
// Server
// =============================================================================

export interface ServeOptions {
  host?: string;
  port?: number;
  cwd?: string;
}

export function createServer(options: ServeOptions = {}): http.Server {
  const { cwd = process.cwd() } = options;
  const searchPaths = getDefaultSearchPaths(cwd);
  
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase();
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cognitive-Version',
        'Access-Control-Expose-Headers': 'X-Cognitive-Version',
      });
      res.end();
      return;
    }
    
    try {
      // Route requests
      if (path === '/' && method === 'GET') {
        await handleRoot(res);
      } else if (path === '/health' && method === 'GET') {
        await handleHealth(res);
      } else if (path === '/modules' && method === 'GET') {
        await handleModules(res, searchPaths);
      } else if (path.startsWith('/modules/') && method === 'GET') {
        const moduleName = path.slice('/modules/'.length);
        await handleModuleInfo(res, moduleName, searchPaths);
      } else if (path === '/run' && method === 'POST') {
        await handleRun(req, res, searchPaths, url);
      } else {
        const envelope = makeErrorEnvelope({
          code: ErrorCodes.ENDPOINT_NOT_FOUND,
          message: `Endpoint '${path}' not found`,
          suggestion: 'Use GET / to see available endpoints',
          risk: 'low',
        });
        jsonResponse(res, 404, envelope);
      }
    } catch (error) {
      console.error('Server error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      const envelope = makeErrorEnvelope({
        code: ErrorCodes.INTERNAL_ERROR,
        message: errorMessage,
        recoverable: false,
      });
      jsonResponse(res, 500, envelope);
    }
  });
  
  return server;
}

export async function serve(options: ServeOptions = {}): Promise<void> {
  const { host = '0.0.0.0', port = 8000 } = options;
  
  const server = createServer(options);
  
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      console.log(`Cognitive Modules HTTP Server running at http://${host}:${port}`);
      console.log('Endpoints:');
      console.log('  GET  /          - API info');
      console.log('  GET  /health    - Health check');
      console.log('  GET  /modules   - List modules');
      console.log('  GET  /modules/:name - Module info');
      console.log('  POST /run       - Run module');
      resolve();
    });
  });
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  serve().catch(console.error);
}
