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
import { loadModule, findModule, listModules, getDefaultSearchPaths } from '../modules/loader.js';
import { runModule } from '../modules/runner.js';
import { getProvider } from '../providers/index.js';
import type { CognitiveModule, Provider } from '../types.js';

// =============================================================================
// Types
// =============================================================================

interface RunRequest {
  module: string;
  args: string;
  provider?: string;
  model?: string;
}

interface RunResponse {
  ok: boolean;
  data?: unknown;
  meta?: unknown;
  error?: string;
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

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
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
    version: '1.2.0',
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
    version: '1.2.0',
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
    jsonResponse(res, 404, { error: `Module '${moduleName}' not found` });
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
  searchPaths: string[]
): Promise<void> {
  // Verify API key
  if (!verifyApiKey(req)) {
    jsonResponse(res, 401, {
      error: 'Missing or invalid API Key. Use header: Authorization: Bearer <your-api-key>',
    });
    return;
  }
  
  // Parse request body
  let request: RunRequest;
  try {
    const body = await parseBody(req);
    request = JSON.parse(body);
  } catch {
    jsonResponse(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  
  // Validate request
  if (!request.module || !request.args) {
    jsonResponse(res, 400, { error: 'Missing required fields: module, args' });
    return;
  }
  
  // Find module
  const moduleData = await findModule(request.module, searchPaths);
  if (!moduleData) {
    jsonResponse(res, 404, { error: `Module '${request.module}' not found` });
    return;
  }
  
  try {
    // Create provider
    const provider = getProvider(request.provider, request.model);
    
    // Run module
    const result = await runModule(moduleData, provider, {
      input: { query: request.args, code: request.args },
      useV22: true,
    });
    
    const response: RunResponse = {
      ok: result.ok,
      module: request.module,
      provider: request.provider || process.env.LLM_PROVIDER || 'openai',
    };
    
    if (result.ok) {
      if ('meta' in result) response.meta = result.meta;
      if ('data' in result) response.data = result.data;
    } else {
      if ('error' in result) response.error = result.error?.message;
    }
    
    jsonResponse(res, 200, response);
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      module: request.module,
    });
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        await handleRun(req, res, searchPaths);
      } else {
        jsonResponse(res, 404, { error: 'Not found' });
      }
    } catch (error) {
      console.error('Server error:', error);
      jsonResponse(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
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
