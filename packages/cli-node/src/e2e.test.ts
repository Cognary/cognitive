/**
 * End-to-End Tests for Cognitive Runtime
 * 
 * These tests verify complete execution flows:
 * - Module loading → validation → execution → response parsing
 * - CLI commands (validate, run, compose)
 * - Streaming output
 * - Error handling across the full stack
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Provider, InvokeParams, InvokeResult } from './types.js';
import { runModule, runModuleStream, makeErrorResponse, ERROR_CODES, type StreamEvent } from './modules/runner.js';
import { loadModule, loadSingleFileModule } from './modules/loader.js';
import { validateModule } from './modules/validator.js';

// =============================================================================
// Mock Provider for E2E Testing
// =============================================================================

/**
 * Configurable mock provider for testing complete execution flows.
 * Supports:
 * - Pre-configured responses based on input patterns
 * - Simulated streaming
 * - Error injection
 * - Latency simulation
 * - Call tracking for assertions
 */
class E2EMockProvider implements Provider {
  name = 'e2e-mock';
  
  private responses: Map<string, string | (() => string)> = new Map();
  private errorToThrow: Error | null = null;
  private latencyMs: number = 0;
  private calls: Array<{ params: InvokeParams; timestamp: number }> = [];
  
  /**
   * Configure a response for messages containing a specific keyword
   */
  setResponse(keyword: string, response: object | string): void {
    const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
    this.responses.set(keyword, responseStr);
  }
  
  /**
   * Configure a dynamic response generator
   */
  setDynamicResponse(keyword: string, generator: () => object | string): void {
    this.responses.set(keyword, () => {
      const result = generator();
      return typeof result === 'string' ? result : JSON.stringify(result);
    });
  }
  
  /**
   * Set default response when no keyword matches
   */
  setDefaultResponse(response: object | string): void {
    this.setResponse('*', response);
  }
  
  /**
   * Configure provider to throw an error
   */
  setError(error: Error): void {
    this.errorToThrow = error;
  }
  
  /**
   * Set simulated latency
   */
  setLatency(ms: number): void {
    this.latencyMs = ms;
  }
  
  isConfigured(): boolean {
    return true;
  }
  
  supportsStreaming(): boolean {
    return true;
  }
  
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    this.calls.push({ params, timestamp: Date.now() });
    
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
    
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    
    const content = this.findResponse(params);
    return {
      content,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }
  
  async *invokeStream(params: InvokeParams): AsyncGenerator<string, InvokeResult, unknown> {
    this.calls.push({ params, timestamp: Date.now() });
    
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
    
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    
    const content = this.findResponse(params);
    
    // Simulate streaming by yielding content in chunks
    const chunkSize = 20;
    for (let i = 0; i < content.length; i += chunkSize) {
      yield content.slice(i, i + chunkSize);
      // Small delay to simulate real streaming
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    return {
      content,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }
  
  private findResponse(params: InvokeParams): string {
    const userMessage = params.messages.find(m => m.role === 'user')?.content || '';
    
    for (const [keyword, response] of this.responses) {
      if (keyword !== '*' && userMessage.toLowerCase().includes(keyword.toLowerCase())) {
        return typeof response === 'function' ? response() : response;
      }
    }
    
    const defaultResponse = this.responses.get('*');
    if (defaultResponse) {
      return typeof defaultResponse === 'function' ? defaultResponse() : defaultResponse;
    }
    
    // Fallback: valid v2.2 envelope
    return JSON.stringify({
      ok: true,
      meta: {
        confidence: 0.85,
        risk: 'low',
        explain: 'Mock response from E2E test provider',
      },
      data: {
        result: 'mock-result',
        rationale: 'This is a mock rationale for testing',
      },
    });
  }
  
  /**
   * Get all recorded calls
   */
  getCalls(): Array<{ params: InvokeParams; timestamp: number }> {
    return this.calls;
  }
  
  /**
   * Get the last call made
   */
  getLastCall(): { params: InvokeParams; timestamp: number } | undefined {
    return this.calls[this.calls.length - 1];
  }
  
  /**
   * Reset provider state
   */
  reset(): void {
    this.responses.clear();
    this.errorToThrow = null;
    this.latencyMs = 0;
    this.calls = [];
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

let tempDir: string;
let mockProvider: E2EMockProvider;

/**
 * Create a test module in the temp directory
 */
async function createTestModule(
  name: string,
  config: {
    responsibility?: string;
    prompt?: string;
    inputSchema?: object;
    outputSchema?: object;
    tier?: string;
    excludes?: string[];
  } = {}
): Promise<string> {
  const modulePath = path.join(tempDir, name);
  await fs.mkdir(modulePath, { recursive: true });
  
  // Create module.yaml
  const manifest = {
    name,
    version: '1.0.0',
    responsibility: config.responsibility || `Test module for ${name}`,
    tier: config.tier || 'exec',
    excludes: config.excludes || ['unrelated_topics'],
  };
  await fs.writeFile(
    path.join(modulePath, 'module.yaml'),
    `# ${name}\n` + Object.entries(manifest).map(([k, v]) => 
      Array.isArray(v) ? `${k}:\n${v.map(i => `  - ${i}`).join('\n')}` : `${k}: ${v}`
    ).join('\n')
  );
  
  // Create prompt.md
  const prompt = config.prompt || `You are a test module named ${name}.\nRespond with a valid JSON envelope.`;
  await fs.writeFile(path.join(modulePath, 'prompt.md'), prompt);
  
  // Create schema.json
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: `${name} Schema`,
    type: 'object',
    properties: {
      input: config.inputSchema || {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      output: config.outputSchema || {
        type: 'object',
        properties: {
          meta: {
            type: 'object',
            properties: {
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
              explain: { type: 'string' },
            },
            required: ['confidence', 'risk', 'explain'],
          },
          data: {
            type: 'object',
            properties: {
              result: { type: 'string' },
              rationale: { type: 'string' },
            },
            required: ['result', 'rationale'],
          },
        },
        required: ['meta', 'data'],
      },
    },
  };
  await fs.writeFile(path.join(modulePath, 'schema.json'), JSON.stringify(schema, null, 2));
  
  return modulePath;
}

/**
 * Create a single-file module (Markdown with optional frontmatter).
 */
async function createSingleFileModule(
  filename: string,
  config: {
    frontmatter?: Record<string, unknown>;
    body?: string;
  } = {}
): Promise<string> {
  const filePath = path.join(tempDir, filename);
  const frontmatter = config.frontmatter ?? {
    name: path.basename(filename, path.extname(filename)),
    version: '0.1.0',
    responsibility: 'Single-file module used for E2E tests',
    tier: 'decision',
  };
  const body = config.body ?? 'Return a valid v2.2 envelope JSON.';

  const yamlLines = Object.entries(frontmatter).flatMap(([k, v]) => {
    if (Array.isArray(v)) {
      return [`${k}:`, ...v.map(item => `  - ${String(item)}`)];
    }
    return [`${k}: ${String(v)}`];
  });

  const content = `---\n${yamlLines.join('\n')}\n---\n\n${body}\n`;
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cognitive-e2e-'));
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  mockProvider = new E2EMockProvider();
});

// =============================================================================
// E2E Tests: Module Loading and Validation
// =============================================================================

describe('E2E: Module Loading', () => {
  it('should load a v2.2 module completely', async () => {
    const modulePath = await createTestModule('load-test-module', {
      tier: 'exec',
      responsibility: 'Test module loading',
    });
    
    const module = await loadModule(modulePath);
    
    expect(module).toBeDefined();
    expect(module.name).toBe('load-test-module');
    expect(module.responsibility).toBe('Test module loading');
    expect(module.prompt).toContain('test module');
    // v2 modules may have inputSchema/outputSchema directly or via schema property
    expect(module.format).toBe('v2');
  });
  
  it('should fail to load non-existent module', async () => {
    await expect(loadModule('/non/existent/path')).rejects.toThrow();
  });

  it('should load a single-file module with generated schemas', async () => {
    const filePath = await createSingleFileModule('single-file-module.md', {
      frontmatter: {
        name: 'single-file-module',
        version: '0.1.0',
        responsibility: 'Test single-file module loading',
        tier: 'decision',
        excludes: ['do_not_do_x'],
      },
      body: 'You are a test single-file module. Respond with a valid v2.2 envelope.',
    });

    const module = await loadSingleFileModule(filePath);

    expect(module).toBeDefined();
    expect(module.name).toBe('single-file-module');
    expect(module.responsibility).toBe('Test single-file module loading');
    expect(module.prompt).toContain('single-file module');
    expect(module.format).toBe('v2');
    expect(module.formatVersion).toBe('v2.2');
    expect(module.metaSchema).toBeDefined();
    expect(module.dataSchema).toBeDefined();
  });
  
  it('should validate a valid module without errors', async () => {
    const modulePath = await createTestModule('valid-module');
    
    const result = await validateModule(modulePath);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// =============================================================================
// E2E Tests: Module Execution
// =============================================================================

describe('E2E: Module Execution', () => {
  it('should execute module and return valid envelope', async () => {
    const modulePath = await createTestModule('exec-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setDefaultResponse({
      ok: true,
      meta: {
        confidence: 0.92,
        risk: 'low',
        explain: 'Successfully processed the test query',
      },
      data: {
        result: 'processed-result',
        rationale: 'Input was valid and processing completed',
      },
    });
    
    const result = await runModule(module, mockProvider, { input: { query: 'test input' } });
    
    expect(result.ok).toBe(true);
    expect(result.meta.confidence).toBeGreaterThan(0.9);
    expect(result.meta.risk).toBe('low');
    expect(result.data?.result).toBe('processed-result');
  });

  it('should execute single-file module and return valid envelope', async () => {
    const filePath = await createSingleFileModule('run-single-file.md', {
      frontmatter: {
        name: 'run-single-file',
        version: '0.1.0',
        responsibility: 'Execute single-file module',
        tier: 'decision',
      },
      body: 'Return a JSON v2.2 envelope with meta and data.',
    });
    const module = await loadSingleFileModule(filePath);

    mockProvider.setDefaultResponse({
      ok: true,
      meta: {
        confidence: 0.88,
        risk: 'low',
        explain: 'Single-file module executed',
      },
      data: {
        result: 'ok',
        rationale: 'This is a test rationale',
      },
    });

    const result = await runModule(module, mockProvider, { args: 'hello' });
    expect(result.ok).toBe(true);
    expect(result.version).toBe('2.2');
    expect(result.meta.explain).toContain('Single-file');
    expect((result as any).data).toBeDefined();
  });
  
  it('should handle LLM returning markdown-wrapped JSON', async () => {
    const modulePath = await createTestModule('markdown-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setDefaultResponse(`\`\`\`json
{
  "ok": true,
  "meta": {
    "confidence": 0.88,
    "risk": "none",
    "explain": "Extracted from markdown"
  },
  "data": {
    "result": "markdown-extracted",
    "rationale": "JSON was wrapped in code block"
  }
}
\`\`\``);
    
    const result = await runModule(module, mockProvider, { input: { query: 'test' } });
    
    expect(result.ok).toBe(true);
    expect(result.data?.result).toBe('markdown-extracted');
  });
  
  it('should handle provider errors gracefully', async () => {
    const modulePath = await createTestModule('provider-error-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setError(new Error('Simulated provider failure'));
    
    const result = await runModule(module, mockProvider, { input: { query: 'test' } });
    
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('provider failure');
  });
  
  it('should handle malformed LLM response', async () => {
    const modulePath = await createTestModule('malformed-response-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setDefaultResponse('This is not valid JSON at all!');
    
    const result = await runModule(module, mockProvider, { input: { query: 'test' } });
    
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toMatch(/E1000|PARSE_ERROR/);
  });
});

// =============================================================================
// E2E Tests: Streaming Execution
// =============================================================================

describe('E2E: Streaming Execution', () => {
  it('should stream chunks and return complete result', async () => {
    const modulePath = await createTestModule('stream-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setDefaultResponse({
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Streamed response' },
      data: { result: 'streamed', rationale: 'Via streaming' },
    });
    
    const chunks: string[] = [];
    let finalResult: StreamEvent['result'] = undefined;
    
    for await (const event of runModuleStream(module, mockProvider, { input: { query: 'test' } })) {
      if (event.type === 'delta' && event.delta) {
        chunks.push(event.delta);
      } else if (event.type === 'end') {
        finalResult = event.result;
      }
    }
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(finalResult).toBeDefined();
    expect(finalResult?.ok).toBe(true);
    expect((finalResult as any)?.data?.result).toBe('streamed');
  });
  
  it('should emit error event on failure', async () => {
    const modulePath = await createTestModule('stream-error-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setError(new Error('Stream error'));
    
    let errorEvent: StreamEvent | null = null;
    
    for await (const event of runModuleStream(module, mockProvider, { input: { query: 'test' } })) {
      if (event.type === 'error') {
        errorEvent = event;
      }
    }
    
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.error).toBeDefined();
  });
});

// =============================================================================
// E2E Tests: Error Code System
// =============================================================================

describe('E2E: Error Code System', () => {
  it('should use E-format error codes', () => {
    const errorResponse = makeErrorResponse({
      code: 'E1001',
      message: 'Invalid input provided',
    });
    
    expect(errorResponse.ok).toBe(false);
    expect(errorResponse.error?.code).toBe('E1001');
  });
  
  it('should normalize legacy error codes to E-format', () => {
    const errorResponse = makeErrorResponse({
      code: 'INVALID_INPUT',
      message: 'Invalid input',
    });
    
    // Should be normalized to E1001
    expect(errorResponse.ok).toBe(false);
    expect(errorResponse.error?.code).toBe('E1001');
  });
  
  it('should include proper error metadata', () => {
    const errorResponse = makeErrorResponse({
      code: 'E4000',
      message: 'Runtime error occurred',
      suggestion: 'Try again later',
    });
    
    expect(errorResponse.error?.recoverable).toBeDefined();
    expect(errorResponse.error?.suggestion).toBe('Try again later');
    expect(errorResponse.meta.confidence).toBeLessThan(0.5); // Runtime errors have low confidence
  });
  
  it('should have error code categories defined', () => {
    // Verify error taxonomy has key codes
    expect(ERROR_CODES.E1000).toBeDefined(); // Input: Parse error
    expect(ERROR_CODES.E1001).toBeDefined(); // Input: Invalid input
    expect(ERROR_CODES.E2001).toBeDefined(); // Processing: Low confidence
    expect(ERROR_CODES.E3001).toBeDefined(); // Output: Schema violation
    expect(ERROR_CODES.E4000).toBeDefined(); // Runtime: Unknown error
  });
});

// =============================================================================
// E2E Tests: Complete Workflow
// =============================================================================

describe('E2E: Complete Workflow', () => {
  it('should complete full lifecycle: create → load → validate → execute', async () => {
    // 1. Create module
    const modulePath = await createTestModule('full-lifecycle-test', {
      responsibility: 'Analyze user sentiment',
      prompt: 'Analyze the sentiment of the user input. Return a sentiment score.',
      outputSchema: {
        type: 'object',
        properties: {
          meta: {
            type: 'object',
            properties: {
              confidence: { type: 'number' },
              risk: { type: 'string' },
              explain: { type: 'string' },
            },
            required: ['confidence', 'risk', 'explain'],
          },
          data: {
            type: 'object',
            properties: {
              sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
              score: { type: 'number', minimum: -1, maximum: 1 },
              rationale: { type: 'string' },
            },
            required: ['sentiment', 'score', 'rationale'],
          },
        },
        required: ['meta', 'data'],
      },
    });
    
    // 2. Load module
    const module = await loadModule(modulePath);
    expect(module.name).toBe('full-lifecycle-test');
    
    // 3. Validate module
    const validation = await validateModule(modulePath);
    expect(validation.valid).toBe(true);
    
    // 4. Configure mock response
    mockProvider.setResponse('happy', {
      ok: true,
      meta: { confidence: 0.95, risk: 'none', explain: 'Clear positive sentiment detected' },
      data: { sentiment: 'positive', score: 0.85, rationale: 'User expressed happiness' },
    });
    
    mockProvider.setResponse('angry', {
      ok: true,
      meta: { confidence: 0.88, risk: 'low', explain: 'Negative sentiment with frustration' },
      data: { sentiment: 'negative', score: -0.7, rationale: 'User expressed anger' },
    });
    
    // 5. Execute with different inputs - input is passed via args which goes into prompt
    const positiveResult = await runModule(module, mockProvider, { args: 'I am so happy today!' });
    expect(positiveResult.ok).toBe(true);
    expect(positiveResult.data?.sentiment).toBe('positive');
    
    const negativeResult = await runModule(module, mockProvider, { args: 'This makes me angry!' });
    expect(negativeResult.ok).toBe(true);
    expect(negativeResult.data?.sentiment).toBe('negative');
  });
  
  it('should track provider calls for debugging', async () => {
    const modulePath = await createTestModule('call-tracking-test');
    const module = await loadModule(modulePath);
    
    // Use args which gets substituted into prompt
    await runModule(module, mockProvider, { args: 'first call' });
    await runModule(module, mockProvider, { args: 'second call' });
    
    const calls = mockProvider.getCalls();
    expect(calls).toHaveLength(2);
    
    // User message should contain the args via prompt substitution
    // The messages array has [system, user] - user message contains the processed prompt
    expect(calls[0].params.messages.length).toBe(2);
    expect(calls[1].params.messages.length).toBe(2);
  });
});

// =============================================================================
// E2E Tests: Edge Cases
// =============================================================================

describe('E2E: Edge Cases', () => {
  it('should handle empty input gracefully', async () => {
    const modulePath = await createTestModule('empty-input-test', {
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      },
    });
    const module = await loadModule(modulePath);
    
    const result = await runModule(module, mockProvider, { input: {} });
    
    // Should still execute (no required fields in this schema)
    expect(result.ok).toBe(true);
  });
  
  it('should handle very large input via args', async () => {
    const modulePath = await createTestModule('large-input-test');
    const module = await loadModule(modulePath);
    
    const largeArgs = 'x'.repeat(10000);
    const result = await runModule(module, mockProvider, { args: largeArgs });
    
    expect(result.ok).toBe(true);
    // Verify the provider was called
    const lastCall = mockProvider.getLastCall();
    expect(lastCall).toBeDefined();
    expect(lastCall?.params.messages.length).toBe(2);
  });
  
  it('should handle unicode and special characters', async () => {
    const modulePath = await createTestModule('unicode-test');
    const module = await loadModule(modulePath);
    
    mockProvider.setDefaultResponse({
      ok: true,
      meta: { confidence: 0.9, risk: 'none', explain: '测试中文和表情 🎉' },
      data: { result: 'Ελληνικά 日本語 العربية', rationale: 'Unicode handled' },
    });
    
    const result = await runModule(module, mockProvider, { args: '你好世界 🌍' });
    
    expect(result.ok).toBe(true);
    expect(result.meta.explain).toContain('测试中文');
    expect(result.data?.result).toContain('日本語');
  });
  
  it('should handle concurrent executions', async () => {
    const modulePath = await createTestModule('concurrent-test');
    const module = await loadModule(modulePath);
    
    // Execute 5 concurrent requests
    const promises = Array.from({ length: 5 }, (_, i) => 
      runModule(module, mockProvider, { args: `concurrent-${i}` })
    );
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.ok).toBe(true);
    });
    
    expect(mockProvider.getCalls()).toHaveLength(5);
  });
});
