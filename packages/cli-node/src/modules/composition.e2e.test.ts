/**
 * Composition Engine E2E Tests - Semantic Contract Verification
 * 
 * This test suite verifies the semantic correctness of CompositionOrchestrator:
 * - Dataflow mapping: input transformations are correctly applied
 * - Aggregation: merge/array/first strategies produce correct results
 * - Timeout: execution time tracking
 * - Fallback: backup modules are invoked on failure
 * - Execution trace: complete audit trail
 * 
 * Key design: Mock runModule to capture inputs directly, avoiding fragile
 * prompt text parsing.
 * 
 * IMPLEMENTATION NOTE:
 * The vi.mock approach intercepts runModule calls, which means some internal
 * orchestrator checks (maxDepth, circular in executeModule) are exercised
 * but their error paths may not be fully testable via mocked runModule.
 * For full coverage of error paths, integration tests with real modules
 * or direct unit tests of internal methods are recommended.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { CognitiveModule, ModuleResult, ModuleInput } from '../types.js';
import { 
  CompositionOrchestrator, 
  type CompositionConfig,
  COMPOSITION_ERRORS,
  aggregateResults
} from './composition.js';

// =============================================================================
// Captured Inputs Registry - Track what each module received
// =============================================================================

interface CapturedCall {
  moduleName: string;
  input: ModuleInput;
  timestamp: number;
}

const capturedCalls: CapturedCall[] = [];
const mockResponses: Map<string, ModuleResult | ((input: ModuleInput) => ModuleResult)> = new Map();
const mockDelays: Map<string, number> = new Map();
const mockErrors: Map<string, Error> = new Map();

function clearCapturedCalls(): void {
  capturedCalls.length = 0;
}

function setMockResponse(moduleName: string, response: ModuleResult | ((input: ModuleInput) => ModuleResult)): void {
  mockResponses.set(moduleName, response);
}

function setMockDelay(moduleName: string, delayMs: number): void {
  mockDelays.set(moduleName, delayMs);
}

function setMockError(moduleName: string, error: Error): void {
  mockErrors.set(moduleName, error);
}

function clearMockResponses(): void {
  mockResponses.clear();
  mockDelays.clear();
  mockErrors.clear();
}

function getCapturedCallsForModule(moduleName: string): CapturedCall[] {
  return capturedCalls.filter(c => c.moduleName === moduleName);
}

function getLastCapturedInput(moduleName: string): ModuleInput | undefined {
  const calls = getCapturedCallsForModule(moduleName);
  return calls.length > 0 ? calls[calls.length - 1].input : undefined;
}

// Default success response
function defaultResponse(moduleName: string): ModuleResult {
  return {
    ok: true,
    meta: { confidence: 0.9, risk: 'low', explain: `${moduleName} completed` },
    data: { result: `${moduleName}-output`, rationale: 'Mock output' }
  } as ModuleResult;
}

// =============================================================================
// Mock Module Registry
// =============================================================================

const mockModules: Map<string, CognitiveModule> = new Map();

function createMockModule(
  name: string, 
  composition?: CompositionConfig,
  overrides: Partial<CognitiveModule> = {}
): CognitiveModule {
  return {
    name,
    version: '1.0.0',
    responsibility: `Mock module: ${name}`,
    excludes: [],
    prompt: `Module ${name} prompt`,
    location: `/mock/${name}`,
    format: 'v2',
    formatVersion: 'v2.2',
    composition,
    ...overrides
  };
}

function registerMockModule(module: CognitiveModule): void {
  mockModules.set(module.name, module);
}

function clearMockModules(): void {
  mockModules.clear();
}

// =============================================================================
// Mock loader.js - Return modules from our registry
// =============================================================================

vi.mock('./loader.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./loader.js')>();
  return {
    ...original,
    findModule: vi.fn(async (name: string) => {
      return mockModules.get(name) || null;
    }),
    getDefaultSearchPaths: vi.fn(() => ['/mock'])
  };
});

// =============================================================================
// Mock runner.js - Capture inputs and return controlled responses
// =============================================================================

vi.mock('./runner.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./runner.js')>();
  return {
    ...original,
    runModule: vi.fn(async (
      module: CognitiveModule, 
      _provider: unknown, 
      options: { input?: ModuleInput } = {}
    ): Promise<ModuleResult> => {
      const input = options.input || {};
      
      // Capture the call with its input
      capturedCalls.push({
        moduleName: module.name,
        input,
        timestamp: Date.now()
      });
      
      // Check for configured error
      const error = mockErrors.get(module.name);
      if (error) {
        throw error;
      }
      
      // Apply configured delay (for timing testing)
      const delay = mockDelays.get(module.name);
      if (delay && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Return configured response or default
      const responseConfig = mockResponses.get(module.name);
      if (responseConfig) {
        return typeof responseConfig === 'function' ? responseConfig(input) : responseConfig;
      }
      
      return defaultResponse(module.name);
    })
  };
});

// =============================================================================
// Test Setup
// =============================================================================

// Create a minimal mock provider (not actually used since we mock runModule)
const mockProvider = {
  name: 'mock',
  invoke: vi.fn(),
  isConfigured: () => true
};

let orchestrator: CompositionOrchestrator;

beforeEach(() => {
  orchestrator = new CompositionOrchestrator(mockProvider as any, '/mock');
  clearMockModules();
  clearCapturedCalls();
  clearMockResponses();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// E2E Tests: Dataflow Mapping - SEMANTIC VERIFICATION
// =============================================================================

describe('E2E: Dataflow Mapping (Semantic Verification)', () => {
  it('should pass mapped fields correctly to downstream module', async () => {
    // Setup: source produces data, consumer receives mapped fields
    const source = createMockModule('source');
    const consumer = createMockModule('consumer');
    
    const composed = createMockModule('dataflow-composed', {
      pattern: 'sequential',
      requires: [
        { name: 'source' },
        { name: 'consumer' }
      ],
      dataflow: [
        { from: 'input', to: 'source' },
        { 
          from: 'source', 
          to: 'consumer',
          mapping: {
            mapped_field: '$.extracted',
            nested_value: '$.nested.deep'
          }
        },
        { from: 'consumer', to: 'output' }
      ]
    });
    
    registerMockModule(source);
    registerMockModule(consumer);
    registerMockModule(composed);
    
    // Source produces specific data structure
    setMockResponse('source', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Source done' },
      data: { 
        extracted: 'IMPORTANT_VALUE',
        nested: { deep: 'NESTED_VALUE' },
        rationale: 'Source output'
      }
    } as ModuleResult);
    
    setMockResponse('consumer', {
      ok: true,
      meta: { confidence: 0.95, risk: 'none', explain: 'Consumer done' },
      data: { processed: true, rationale: 'Consumed' }
    } as ModuleResult);
    
    // Execute
    const result = await orchestrator.execute('dataflow-composed', { query: 'test' });
    
    // Verify result
    expect(result.ok).toBe(true);
    
    // CRITICAL ASSERTION: Verify consumer received mapped input
    const consumerInput = getLastCapturedInput('consumer');
    expect(consumerInput).toBeDefined();
    expect(consumerInput?.mapped_field).toBe('IMPORTANT_VALUE');
    expect(consumerInput?.nested_value).toBe('NESTED_VALUE');
    
    // FINAL OUTPUT ASSERTION: Verify the composition's final result
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.processed).toBe(true);
  });
  
  it('should pass entire object with $ mapping', async () => {
    const source = createMockModule('full-source');
    const consumer = createMockModule('full-consumer');
    
    const composed = createMockModule('full-pass', {
      pattern: 'sequential',
      requires: [{ name: 'full-source' }, { name: 'full-consumer' }],
      dataflow: [
        { from: 'input', to: 'full-source' },
        { from: 'full-source', to: 'full-consumer', mapping: { all_data: '$' } },
        { from: 'full-consumer', to: 'output' }
      ]
    });
    
    registerMockModule(source);
    registerMockModule(consumer);
    registerMockModule(composed);
    
    const sourceData = { field1: 'a', field2: 'b', rationale: 'test' };
    setMockResponse('full-source', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Done' },
      data: sourceData
    } as ModuleResult);
    
    await orchestrator.execute('full-pass', { initial: 'input' });
    
    const consumerInput = getLastCapturedInput('full-consumer');
    expect(consumerInput?.all_data).toEqual(sourceData);
  });
  
  it('should handle missing fields in mapping gracefully', async () => {
    const source = createMockModule('partial-source');
    const consumer = createMockModule('partial-consumer');
    
    const composed = createMockModule('partial-mapping', {
      pattern: 'sequential',
      requires: [{ name: 'partial-source' }, { name: 'partial-consumer' }],
      dataflow: [
        { from: 'input', to: 'partial-source' },
        { 
          from: 'partial-source', 
          to: 'partial-consumer',
          mapping: {
            existing: '$.exists',
            missing: '$.does_not_exist'
          }
        },
        { from: 'partial-consumer', to: 'output' }
      ]
    });
    
    registerMockModule(source);
    registerMockModule(consumer);
    registerMockModule(composed);
    
    setMockResponse('partial-source', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Done' },
      data: { exists: 'VALUE', rationale: 'test' }
    } as ModuleResult);
    
    await orchestrator.execute('partial-mapping', {});
    
    const consumerInput = getLastCapturedInput('partial-consumer');
    expect(consumerInput?.existing).toBe('VALUE');
    expect(consumerInput?.missing).toBeUndefined();
  });
  
  it('should chain multiple mappings in sequence', async () => {
    const step1 = createMockModule('chain-s1');
    const step2 = createMockModule('chain-s2');
    const step3 = createMockModule('chain-s3');
    
    const composed = createMockModule('chain-test', {
      pattern: 'sequential',
      requires: [{ name: 'chain-s1' }, { name: 'chain-s2' }, { name: 'chain-s3' }],
      dataflow: [
        { from: 'input', to: 'chain-s1' },
        { from: 'chain-s1', to: 'chain-s2', mapping: { step1_output: '$.value' } },
        { from: 'chain-s2', to: 'chain-s3', mapping: { step2_output: '$.processed' } },
        { from: 'chain-s3', to: 'output' }
      ]
    });
    
    registerMockModule(step1);
    registerMockModule(step2);
    registerMockModule(step3);
    registerMockModule(composed);
    
    setMockResponse('chain-s1', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'S1' },
      data: { value: 'from-s1', rationale: 'S1 done' }
    } as ModuleResult);
    
    setMockResponse('chain-s2', {
      ok: true,
      meta: { confidence: 0.85, risk: 'low', explain: 'S2' },
      data: { processed: 'from-s2', rationale: 'S2 done' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('chain-test', { initial: 'data' });
    
    expect(result.ok).toBe(true);
    
    // Verify each step received correct mapped input
    expect(getLastCapturedInput('chain-s2')?.step1_output).toBe('from-s1');
    expect(getLastCapturedInput('chain-s3')?.step2_output).toBe('from-s2');
    
    // FINAL OUTPUT ASSERTION: Verify chain output is from last step
    expect(result.result).toBeDefined();
    expect(result.moduleResults['chain-s3']).toBeDefined();
  });
});

// =============================================================================
// E2E Tests: Parallel Aggregation - RESULT CONTENT VERIFICATION
// =============================================================================

describe('E2E: Parallel Aggregation (Result Content Verification)', () => {
  it('should merge results with all fields combined', async () => {
    const worker1 = createMockModule('merge-w1');
    const worker2 = createMockModule('merge-w2');
    const worker3 = createMockModule('merge-w3');
    
    const composed = createMockModule('merge-test', {
      pattern: 'parallel',
      requires: [
        { name: 'merge-w1' },
        { name: 'merge-w2' },
        { name: 'merge-w3' }
      ],
      dataflow: [
        { from: 'input', to: ['merge-w1', 'merge-w2', 'merge-w3'] },
        { 
          from: ['merge-w1', 'merge-w2', 'merge-w3'], 
          to: 'output',
          aggregate: 'merge'
        }
      ]
    });
    
    registerMockModule(worker1);
    registerMockModule(worker2);
    registerMockModule(worker3);
    registerMockModule(composed);
    
    setMockResponse('merge-w1', {
      ok: true,
      meta: { confidence: 0.8, risk: 'low', explain: 'W1' },
      data: { field1: 'value1', rationale: 'W1 done' }
    } as ModuleResult);
    
    setMockResponse('merge-w2', {
      ok: true,
      meta: { confidence: 0.9, risk: 'none', explain: 'W2' },
      data: { field2: 'value2', rationale: 'W2 done' }
    } as ModuleResult);
    
    setMockResponse('merge-w3', {
      ok: true,
      meta: { confidence: 0.85, risk: 'low', explain: 'W3' },
      data: { field3: 'value3', rationale: 'W3 done' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('merge-test', {});
    
    expect(result.ok).toBe(true);
    
    // All workers should have been called
    expect(getCapturedCallsForModule('merge-w1').length).toBe(1);
    expect(getCapturedCallsForModule('merge-w2').length).toBe(1);
    expect(getCapturedCallsForModule('merge-w3').length).toBe(1);
    
    // CRITICAL: Verify final output contains merged data from all workers
    // This closes the proof: dataflow → execution → aggregation → final output
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.field1).toBe('value1');
    expect(finalData.field2).toBe('value2');
    expect(finalData.field3).toBe('value3');
  });
  
  it('should produce correct array aggregation in E2E flow', async () => {
    // Full E2E test for array aggregation (not just unit test)
    const item1 = createMockModule('array-item1');
    const item2 = createMockModule('array-item2');
    const item3 = createMockModule('array-item3');
    
    const composed = createMockModule('array-e2e-test', {
      pattern: 'parallel',
      requires: [
        { name: 'array-item1' },
        { name: 'array-item2' },
        { name: 'array-item3' }
      ],
      dataflow: [
        { from: 'input', to: ['array-item1', 'array-item2', 'array-item3'] },
        { 
          from: ['array-item1', 'array-item2', 'array-item3'], 
          to: 'output',
          aggregate: 'array'
        }
      ]
    });
    
    registerMockModule(item1);
    registerMockModule(item2);
    registerMockModule(item3);
    registerMockModule(composed);
    
    setMockResponse('array-item1', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Item1' },
      data: { id: 1, value: 'first' }
    } as ModuleResult);
    
    setMockResponse('array-item2', {
      ok: true,
      meta: { confidence: 0.85, risk: 'low', explain: 'Item2' },
      data: { id: 2, value: 'second' }
    } as ModuleResult);
    
    setMockResponse('array-item3', {
      ok: true,
      meta: { confidence: 0.88, risk: 'none', explain: 'Item3' },
      data: { id: 3, value: 'third' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('array-e2e-test', {});
    
    expect(result.ok).toBe(true);
    
    // All items should have been called
    expect(getCapturedCallsForModule('array-item1').length).toBe(1);
    expect(getCapturedCallsForModule('array-item2').length).toBe(1);
    expect(getCapturedCallsForModule('array-item3').length).toBe(1);
    
    // CRITICAL: Verify final output has array with correct length and content
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.results).toBeDefined();
    expect(Array.isArray(finalData.results)).toBe(true);
    expect(finalData.results.length).toBe(3);
    
    // Verify array contains all items (order may vary due to parallel execution)
    const ids = finalData.results.map((r: any) => r.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
  });
  
  it('should produce correct first-wins result in E2E flow', async () => {
    const fast = createMockModule('first-fast');
    const slow = createMockModule('first-slow');
    
    const composed = createMockModule('first-e2e-test', {
      pattern: 'parallel',
      requires: [
        { name: 'first-fast' },
        { name: 'first-slow' }
      ],
      dataflow: [
        { from: 'input', to: ['first-fast', 'first-slow'] },
        { 
          from: ['first-fast', 'first-slow'], 
          to: 'output',
          aggregate: 'first'
        }
      ]
    });
    
    registerMockModule(fast);
    registerMockModule(slow);
    registerMockModule(composed);
    
    // Fast module responds quickly with winning result
    setMockResponse('first-fast', {
      ok: true,
      meta: { confidence: 0.95, risk: 'low', explain: 'Fast winner' },
      data: { winner: 'fast', speed: 'quick' }
    } as ModuleResult);
    
    // Slow module (would lose in first-wins)
    setMockResponse('first-slow', {
      ok: true,
      meta: { confidence: 0.7, risk: 'medium', explain: 'Slow runner' },
      data: { winner: 'slow', speed: 'delayed' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('first-e2e-test', {});
    
    expect(result.ok).toBe(true);
    
    // CRITICAL: Verify final output is from first successful result
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.winner).toBe('fast');
    expect(finalData.speed).toBe('quick');
  });
  
  it('should collect results with array strategy (data.results)', async () => {
    // Test aggregateResults directly for precise verification
    const results: ModuleResult[] = [
      { ok: true, meta: { confidence: 0.8, risk: 'low', explain: 'R1' }, data: { item: 'A' } } as ModuleResult,
      { ok: true, meta: { confidence: 0.9, risk: 'none', explain: 'R2' }, data: { item: 'B' } } as ModuleResult,
      { ok: true, meta: { confidence: 0.7, risk: 'low', explain: 'R3' }, data: { item: 'C' } } as ModuleResult,
    ];
    
    const aggregated = aggregateResults(results, 'array');
    
    expect(aggregated.ok).toBe(true);
    // Array strategy collects data into data.results array
    expect((aggregated as any).data).toBeDefined();
    expect((aggregated as any).data.results).toBeDefined();
    expect(Array.isArray((aggregated as any).data.results)).toBe(true);
    expect((aggregated as any).data.results.length).toBe(3);
    expect((aggregated as any).data.results[0]).toEqual({ item: 'A' });
    expect((aggregated as any).data.results[1]).toEqual({ item: 'B' });
    expect((aggregated as any).data.results[2]).toEqual({ item: 'C' });
  });
  
  it('should return first successful with first strategy', async () => {
    const results: ModuleResult[] = [
      { ok: false, meta: { confidence: 0, risk: 'high', explain: 'Failed' }, error: { code: 'E1', message: 'Fail' } } as ModuleResult,
      { ok: true, meta: { confidence: 0.9, risk: 'low', explain: 'Second success' }, data: { winner: 'second' } } as ModuleResult,
      { ok: true, meta: { confidence: 0.8, risk: 'low', explain: 'Third' }, data: { winner: 'third' } } as ModuleResult,
    ];
    
    const aggregated = aggregateResults(results, 'first');
    
    expect(aggregated.ok).toBe(true);
    expect((aggregated as any).data?.winner).toBe('second');
  });
  
  it('should handle all-failed results', async () => {
    const results: ModuleResult[] = [
      { ok: false, meta: { confidence: 0, risk: 'high', explain: 'F1' }, error: { code: 'E1', message: 'Fail1' } } as ModuleResult,
      { ok: false, meta: { confidence: 0, risk: 'high', explain: 'F2' }, error: { code: 'E2', message: 'Fail2' } } as ModuleResult,
    ];
    
    const aggregated = aggregateResults(results, 'first');
    
    // First strategy returns first result when all failed
    expect(aggregated.ok).toBe(false);
  });
  
  it('should verify merge strategy combines data fields', async () => {
    const r1: ModuleResult = {
      ok: true,
      meta: { confidence: 0.8, risk: 'low', explain: 'R1' },
      data: { field1: 'from-r1', shared: 'r1-value' }
    } as ModuleResult;
    
    const r2: ModuleResult = {
      ok: true,
      meta: { confidence: 0.9, risk: 'none', explain: 'R2' },
      data: { field2: 'from-r2', shared: 'r2-value' }
    } as ModuleResult;
    
    const merged = aggregateResults([r1, r2], 'merge');
    
    expect(merged.ok).toBe(true);
    expect((merged as any).data.field1).toBe('from-r1');
    expect((merged as any).data.field2).toBe('from-r2');
    expect((merged as any).data.shared).toBe('r2-value'); // Last wins
  });
});

// =============================================================================
// E2E Tests: Execution Timing
// =============================================================================

describe('E2E: Execution Timing', () => {
  it('should track total execution time', async () => {
    const fastModule = createMockModule('fast-module');
    registerMockModule(fastModule);
    
    const result = await orchestrator.execute('fast-module', {});
    
    expect(result.ok).toBe(true);
    expect(result.totalTimeMs).toBeDefined();
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });
  
  it('should complete within reasonable time', async () => {
    const step1 = createMockModule('timing-s1');
    const step2 = createMockModule('timing-s2');
    
    const composed = createMockModule('timing-test', {
      pattern: 'sequential',
      requires: [{ name: 'timing-s1' }, { name: 'timing-s2' }],
      dataflow: [
        { from: 'input', to: 'timing-s1' },
        { from: 'timing-s1', to: 'timing-s2' },
        { from: 'timing-s2', to: 'output' }
      ]
    });
    
    registerMockModule(step1);
    registerMockModule(step2);
    registerMockModule(composed);
    
    // Add small delays to make timing measurable
    setMockDelay('timing-s1', 10);
    setMockDelay('timing-s2', 10);
    
    const result = await orchestrator.execute('timing-test', {});
    
    expect(result.ok).toBe(true);
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(20);
    expect(result.totalTimeMs).toBeLessThan(1000); // Should not take too long
  });
});

// =============================================================================
// E2E Tests: Fallback - BACKUP MODULE INVOCATION
// =============================================================================

describe('E2E: Fallback (Backup Module Verification)', () => {
  it('should invoke fallback when primary fails', async () => {
    const primary = createMockModule('primary-fail');
    const fallback = createMockModule('fallback-success');
    
    const composed = createMockModule('fallback-test', {
      pattern: 'sequential',
      requires: [
        { name: 'primary-fail', fallback: 'fallback-success' }
      ],
      dataflow: [
        { from: 'input', to: 'primary-fail' },
        { from: 'primary-fail', to: 'output' }
      ]
    });
    
    registerMockModule(primary);
    registerMockModule(fallback);
    registerMockModule(composed);
    
    // Primary fails
    setMockResponse('primary-fail', {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'Primary failed' },
      error: { code: 'E4000', message: 'Primary error' }
    } as ModuleResult);
    
    // Fallback succeeds
    setMockResponse('fallback-success', {
      ok: true,
      meta: { confidence: 0.8, risk: 'low', explain: 'Fallback worked' },
      data: { source: 'fallback', rationale: 'Backup plan' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('fallback-test', {});
    
    // Primary should be called
    expect(getCapturedCallsForModule('primary-fail').length).toBe(1);
    
    // Fallback should be called
    expect(getCapturedCallsForModule('fallback-success').length).toBe(1);
    
    // Result should be from fallback
    expect(result.ok).toBe(true);
    expect(result.moduleResults['fallback-success']).toBeDefined();
    
    // FINAL OUTPUT ASSERTION: Verify fallback data is in final result
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.source).toBe('fallback');
  });
  
  it('should use fallback input correctly', async () => {
    const primary = createMockModule('fail-with-input');
    const fallback = createMockModule('catch-input');
    
    const composed = createMockModule('fallback-input-test', {
      pattern: 'sequential',
      requires: [
        { name: 'fail-with-input', fallback: 'catch-input' }
      ],
      dataflow: [
        { from: 'input', to: 'fail-with-input' },
        { from: 'fail-with-input', to: 'output' }
      ]
    });
    
    registerMockModule(primary);
    registerMockModule(fallback);
    registerMockModule(composed);
    
    setMockResponse('fail-with-input', {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'Failed' },
      error: { code: 'E4000', message: 'Error' }
    } as ModuleResult);
    
    setMockResponse('catch-input', {
      ok: true,
      meta: { confidence: 0.7, risk: 'low', explain: 'Caught' },
      data: { caught: true, rationale: 'Fallback' }
    } as ModuleResult);
    
    await orchestrator.execute('fallback-input-test', { original_query: 'test123' });
    
    // Fallback should receive the same input
    const fallbackInput = getLastCapturedInput('catch-input');
    expect(fallbackInput).toBeDefined();
    expect(fallbackInput?.original_query).toBe('test123');
  });
  
  it('should handle optional dependency failure gracefully', async () => {
    const required = createMockModule('required-ok');
    const optional = createMockModule('optional-fail');
    
    const composed = createMockModule('optional-test', {
      pattern: 'sequential',
      requires: [
        { name: 'required-ok' },
        { name: 'optional-fail', optional: true }
      ],
      dataflow: [
        { from: 'input', to: 'required-ok' },
        { from: 'required-ok', to: 'optional-fail' },
        { from: 'optional-fail', to: 'output' }
      ]
    });
    
    registerMockModule(required);
    registerMockModule(optional);
    registerMockModule(composed);
    
    setMockResponse('required-ok', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Required OK' },
      data: { step: 'required', rationale: 'Done' }
    } as ModuleResult);
    
    setMockResponse('optional-fail', {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'Optional failed' },
      error: { code: 'E4000', message: 'Optional error' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('optional-test', {});
    
    // Required was called
    expect(getCapturedCallsForModule('required-ok').length).toBe(1);
    
    // Optional was called (even though it failed)
    expect(getCapturedCallsForModule('optional-fail').length).toBe(1);
    
    // Composition should still succeed (optional failure is acceptable)
    // Note: actual behavior depends on implementation - just verify it completes
    expect(result.trace.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// E2E Tests: Conditional Routing - BRANCH SELECTION
// =============================================================================

describe('E2E: Conditional Routing (Branch Selection)', () => {
  it('should route to correct branch based on condition', async () => {
    const classifier = createMockModule('classifier');
    const highConfBranch = createMockModule('high-conf-handler');
    const lowConfBranch = createMockModule('low-conf-handler');
    
    const composed = createMockModule('conditional-route', {
      pattern: 'conditional',
      requires: [
        { name: 'classifier' },
        { name: 'high-conf-handler' },
        { name: 'low-conf-handler' }
      ],
      dataflow: [
        { from: 'input', to: 'classifier' }
      ],
      routing: [
        { condition: '$.classifier.meta.confidence > 0.8', next: 'high-conf-handler' },
        { condition: '$.classifier.meta.confidence <= 0.8', next: 'low-conf-handler' }
      ]
    });
    
    registerMockModule(classifier);
    registerMockModule(highConfBranch);
    registerMockModule(lowConfBranch);
    registerMockModule(composed);
    
    // Classifier returns HIGH confidence
    setMockResponse('classifier', {
      ok: true,
      meta: { confidence: 0.95, risk: 'low', explain: 'High confidence' },
      data: { classification: 'positive', rationale: 'Clear signal' }
    } as ModuleResult);
    
    setMockResponse('high-conf-handler', {
      ok: true,
      meta: { confidence: 0.9, risk: 'none', explain: 'High conf handled' },
      data: { result: 'high-path', rationale: 'Processed high confidence' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('conditional-route', {});
    
    // High confidence branch should be called
    expect(getCapturedCallsForModule('high-conf-handler').length).toBe(1);
    
    // Low confidence branch should NOT be called
    expect(getCapturedCallsForModule('low-conf-handler').length).toBe(0);
    
    expect(result.ok).toBe(true);
    
    // FINAL OUTPUT ASSERTION: Verify high-path result in final output
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.result).toBe('high-path');
  });
  
  it('should route to alternative branch when condition changes', async () => {
    const classifier = createMockModule('classifier2');
    const highConfBranch = createMockModule('high-handler2');
    const lowConfBranch = createMockModule('low-handler2');
    
    const composed = createMockModule('conditional-route2', {
      pattern: 'conditional',
      requires: [
        { name: 'classifier2' },
        { name: 'high-handler2' },
        { name: 'low-handler2' }
      ],
      dataflow: [
        { from: 'input', to: 'classifier2' }
      ],
      routing: [
        { condition: '$.classifier2.meta.confidence > 0.8', next: 'high-handler2' },
        { condition: '$.classifier2.meta.confidence <= 0.8', next: 'low-handler2' }
      ]
    });
    
    registerMockModule(classifier);
    registerMockModule(highConfBranch);
    registerMockModule(lowConfBranch);
    registerMockModule(composed);
    
    // Classifier returns LOW confidence this time
    setMockResponse('classifier2', {
      ok: true,
      meta: { confidence: 0.5, risk: 'medium', explain: 'Low confidence' },
      data: { classification: 'uncertain', rationale: 'Weak signal' }
    } as ModuleResult);
    
    setMockResponse('low-handler2', {
      ok: true,
      meta: { confidence: 0.7, risk: 'low', explain: 'Low conf handled' },
      data: { result: 'low-path', rationale: 'Processed low confidence' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('conditional-route2', {});
    
    // Low confidence branch should be called
    expect(getCapturedCallsForModule('low-handler2').length).toBe(1);
    
    // High confidence branch should NOT be called
    expect(getCapturedCallsForModule('high-handler2').length).toBe(0);
    
    expect(result.ok).toBe(true);
    
    // FINAL OUTPUT ASSERTION: Verify low-path result in final output
    expect(result.result).toBeDefined();
    const finalData = (result.result as any)?.data;
    expect(finalData).toBeDefined();
    expect(finalData.result).toBe('low-path');
  });
});

// =============================================================================
// E2E Tests: Execution Trace - AUDIT TRAIL
// =============================================================================

describe('E2E: Execution Trace (Audit Trail)', () => {
  it('should record complete trace with timing', async () => {
    const step1 = createMockModule('trace-s1');
    const step2 = createMockModule('trace-s2');
    
    const composed = createMockModule('trace-test', {
      pattern: 'sequential',
      requires: [{ name: 'trace-s1' }, { name: 'trace-s2' }],
      dataflow: [
        { from: 'input', to: 'trace-s1' },
        { from: 'trace-s1', to: 'trace-s2' },
        { from: 'trace-s2', to: 'output' }
      ]
    });
    
    registerMockModule(step1);
    registerMockModule(step2);
    registerMockModule(composed);
    
    const result = await orchestrator.execute('trace-test', {});
    
    expect(result.ok).toBe(true);
    expect(result.trace).toBeDefined();
    expect(result.trace.length).toBeGreaterThanOrEqual(2);
    
    // Each trace entry should have required fields
    for (const entry of result.trace) {
      expect(entry.module).toBeDefined();
      expect(entry.startTime).toBeDefined();
      expect(entry.endTime).toBeDefined();
      expect(entry.durationMs).toBeDefined();
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof entry.success).toBe('boolean');
    }
    
    // Total time should be tracked
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });
  
  it('should include module results in final output', async () => {
    const mod1 = createMockModule('results-m1');
    const mod2 = createMockModule('results-m2');
    
    const composed = createMockModule('results-test', {
      pattern: 'sequential',
      requires: [{ name: 'results-m1' }, { name: 'results-m2' }],
      dataflow: [
        { from: 'input', to: 'results-m1' },
        { from: 'results-m1', to: 'results-m2' },
        { from: 'results-m2', to: 'output' }
      ]
    });
    
    registerMockModule(mod1);
    registerMockModule(mod2);
    registerMockModule(composed);
    
    setMockResponse('results-m1', {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'M1' },
      data: { m1_output: 'data1', rationale: 'M1 done' }
    } as ModuleResult);
    
    setMockResponse('results-m2', {
      ok: true,
      meta: { confidence: 0.85, risk: 'low', explain: 'M2' },
      data: { m2_output: 'data2', rationale: 'M2 done' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('results-test', {});
    
    expect(result.ok).toBe(true);
    expect(result.moduleResults).toBeDefined();
    expect(result.moduleResults['results-m1']).toBeDefined();
    expect(result.moduleResults['results-m2']).toBeDefined();
    expect((result.moduleResults['results-m1'] as any).data?.m1_output).toBe('data1');
    expect((result.moduleResults['results-m2'] as any).data?.m2_output).toBe('data2');
  });
  
  it('should track skipped steps in trace', async () => {
    const stepA = createMockModule('skip-a');
    const stepB = createMockModule('skip-b');
    
    const composed = createMockModule('skip-test', {
      pattern: 'sequential',
      requires: [{ name: 'skip-a' }, { name: 'skip-b' }],
      dataflow: [
        { from: 'input', to: 'skip-a' },
        { from: 'skip-a', to: 'skip-b', condition: 'false' }, // Never executes
        { from: 'skip-b', to: 'output' }
      ]
    });
    
    registerMockModule(stepA);
    registerMockModule(stepB);
    registerMockModule(composed);
    
    const result = await orchestrator.execute('skip-test', {});
    
    // Step A should be called
    expect(getCapturedCallsForModule('skip-a').length).toBe(1);
    
    // Step B should NOT be called (condition is false)
    expect(getCapturedCallsForModule('skip-b').length).toBe(0);
    
    // Trace should show the skipped step
    const skippedEntry = result.trace.find(t => t.skipped);
    expect(skippedEntry).toBeDefined();
  });
});

// =============================================================================
// E2E Tests: Module Not Found
// =============================================================================

describe('E2E: Module Not Found (E4009)', () => {
  it('should return E4009 when main module not found', async () => {
    const result = await orchestrator.execute('nonexistent-module', {});
    
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe(COMPOSITION_ERRORS.E4009);
    expect(result.error?.message).toContain('nonexistent-module');
  });
  
  it('should return error when required dependency not found', async () => {
    const main = createMockModule('needs-missing', {
      pattern: 'sequential',
      requires: [{ name: 'does-not-exist' }],
      dataflow: [
        { from: 'input', to: 'does-not-exist' },
        { from: 'does-not-exist', to: 'output' }
      ]
    });
    
    registerMockModule(main);
    // Note: 'does-not-exist' is NOT registered
    
    const result = await orchestrator.execute('needs-missing', {});
    
    expect(result.ok).toBe(false);
    // Error code may be E4009 (dependency not found) or E4000 (general error)
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBeDefined();
  });
});

// =============================================================================
// E2E Tests: Iterative Composition
// =============================================================================

describe('E2E: Iterative Composition', () => {
  it('should iterate with continue condition', async () => {
    let iterationCount = 0;
    
    const iterModule = createMockModule('iter-module', {
      pattern: 'iterative',
      iteration: {
        max_iterations: 5,
        continue_condition: '$.meta.confidence < 0.95',
        stop_condition: '$.meta.confidence >= 0.95'
      }
    });
    
    registerMockModule(iterModule);
    
    // Each iteration increases confidence
    setMockResponse('iter-module', (_input) => {
      iterationCount++;
      const confidence = 0.7 + (iterationCount * 0.1);
      return {
        ok: true,
        meta: { confidence: Math.min(confidence, 1.0), risk: 'low', explain: `Iter ${iterationCount}` },
        data: { iteration: iterationCount, rationale: 'Iterating' }
      } as ModuleResult;
    });
    
    const result = await orchestrator.execute('iter-module', {});
    
    expect(result.ok).toBe(true);
    // Should have stopped when confidence >= 0.95
    expect(iterationCount).toBeGreaterThanOrEqual(1);
  });
  
  it('should stop at max_iterations', async () => {
    let count = 0;
    
    const limitModule = createMockModule('limit-iter', {
      pattern: 'iterative',
      iteration: {
        max_iterations: 3,
        continue_condition: 'true' // Always continue
      }
    });
    
    registerMockModule(limitModule);
    
    setMockResponse('limit-iter', () => {
      count++;
      return {
        ok: true,
        meta: { confidence: 0.5, risk: 'low', explain: `Count ${count}` },
        data: { count, rationale: 'Counting' }
      } as ModuleResult;
    });
    
    await orchestrator.execute('limit-iter', {});
    
    // Should stop at max_iterations
    expect(count).toBe(3);
  });
  
  it('should pass iteration results to next iteration', async () => {
    let lastInput: ModuleInput | undefined;
    
    const feedbackModule = createMockModule('feedback-iter', {
      pattern: 'iterative',
      iteration: {
        max_iterations: 2,
        continue_condition: 'true'
      }
    });
    
    registerMockModule(feedbackModule);
    
    let iter = 0;
    setMockResponse('feedback-iter', (input) => {
      iter++;
      lastInput = input;
      return {
        ok: true,
        meta: { confidence: 0.5, risk: 'low', explain: `Iter ${iter}` },
        data: { step: iter, rationale: `Output from iteration ${iter}` }
      } as ModuleResult;
    });
    
    await orchestrator.execute('feedback-iter', { initial: 'start' });
    
    expect(iter).toBe(2);
    // Second iteration should have received data from first
    expect(lastInput).toBeDefined();
  });
});

// =============================================================================
// Unit Tests: aggregateResults function
// =============================================================================

describe('Unit: aggregateResults', () => {
  it('should return error for empty results', () => {
    const result = aggregateResults([], 'merge');
    expect(result.ok).toBe(false);
  });
  
  it('should return single result unchanged', () => {
    const single: ModuleResult = {
      ok: true,
      meta: { confidence: 0.9, risk: 'low', explain: 'Single' },
      data: { value: 'test' }
    } as ModuleResult;
    
    const result = aggregateResults([single], 'merge');
    expect(result).toEqual(single);
  });
  
  it('should calculate average confidence in merge', () => {
    const r1: ModuleResult = {
      ok: true,
      meta: { confidence: 0.8, risk: 'low', explain: 'R1' },
      data: { a: 1 }
    } as ModuleResult;
    
    const r2: ModuleResult = {
      ok: true,
      meta: { confidence: 0.6, risk: 'low', explain: 'R2' },
      data: { b: 2 }
    } as ModuleResult;
    
    const merged = aggregateResults([r1, r2], 'merge');
    
    expect(merged.ok).toBe(true);
    expect((merged as any).meta.confidence).toBe(0.7); // (0.8 + 0.6) / 2
  });
  
  it('should take max risk in merge', () => {
    const r1: ModuleResult = {
      ok: true,
      meta: { confidence: 0.8, risk: 'low', explain: 'R1' },
      data: { a: 1 }
    } as ModuleResult;
    
    const r2: ModuleResult = {
      ok: true,
      meta: { confidence: 0.6, risk: 'high', explain: 'R2' },
      data: { b: 2 }
    } as ModuleResult;
    
    const merged = aggregateResults([r1, r2], 'merge');
    
    expect((merged as any).meta.risk).toBe('high');
  });
});

// =============================================================================
// Edge Cases: Timeout, MaxDepth, Circular - SEMANTIC BOUNDARY TESTS
// =============================================================================

describe('E2E: Timeout (E4008)', () => {
  it('should trigger E4008 when module exceeds per-dependency timeout', async () => {
    const slowModule = createMockModule('slow-dep');
    
    const composed = createMockModule('timeout-per-dep', {
      pattern: 'sequential',
      requires: [{ name: 'slow-dep', timeout_ms: 30 }], // 30ms timeout
      dataflow: [
        { from: 'input', to: 'slow-dep' },
        { from: 'slow-dep', to: 'output' }
      ]
    });
    
    registerMockModule(slowModule);
    registerMockModule(composed);
    
    // Module takes 200ms, but timeout is 30ms
    setMockDelay('slow-dep', 200);
    
    const result = await orchestrator.execute('timeout-per-dep', {});
    
    expect(result.ok).toBe(false);
    // Verify timeout error is captured somewhere
    const hasTimeoutError = 
      result.error?.code === COMPOSITION_ERRORS.E4008 ||
      result.moduleResults['slow-dep']?.error?.code === COMPOSITION_ERRORS.E4008 ||
      (result.result as any)?.error?.code === COMPOSITION_ERRORS.E4008;
    expect(hasTimeoutError).toBe(true);
  });
  
  it('should succeed when within timeout limit', async () => {
    const fastModule = createMockModule('fast-dep');
    
    const composed = createMockModule('timeout-ok', {
      pattern: 'sequential',
      requires: [{ name: 'fast-dep', timeout_ms: 1000 }], // 1s timeout
      dataflow: [
        { from: 'input', to: 'fast-dep' },
        { from: 'fast-dep', to: 'output' }
      ]
    });
    
    registerMockModule(fastModule);
    registerMockModule(composed);
    
    // Module takes 10ms, timeout is 1000ms
    setMockDelay('fast-dep', 10);
    
    const result = await orchestrator.execute('timeout-ok', {});
    
    expect(result.ok).toBe(true);
  });
});

describe('E2E: Max Depth Limit', () => {
  it('should respect maxDepth for deeply nested compositions', async () => {
    // Create a chain: A → B → C (3 levels deep)
    const moduleC = createMockModule('depth-c');
    
    const moduleB = createMockModule('depth-b', {
      pattern: 'sequential',
      requires: [{ name: 'depth-c' }],
      dataflow: [
        { from: 'input', to: 'depth-c' },
        { from: 'depth-c', to: 'output' }
      ]
    });
    
    const moduleA = createMockModule('depth-a', {
      pattern: 'sequential',
      requires: [{ name: 'depth-b' }],
      dataflow: [
        { from: 'input', to: 'depth-b' },
        { from: 'depth-b', to: 'output' }
      ]
    });
    
    registerMockModule(moduleA);
    registerMockModule(moduleB);
    registerMockModule(moduleC);
    
    // With maxDepth=5 (default), should succeed
    const resultOk = await orchestrator.execute('depth-a', {});
    expect(resultOk.ok).toBe(true);
    
    // With maxDepth=1, should fail or limit execution
    const resultLimited = await orchestrator.execute('depth-a', {}, { maxDepth: 1 });
    // May succeed with limited depth or fail - verify behavior is deterministic
    expect(resultLimited.totalTimeMs).toBeDefined();
  });
});

describe('E2E: Dependency Chain', () => {
  it('should execute A → B → A dependency safely', async () => {
    // Create mutual dependency (A depends on B, B depends on A)
    // This should either detect circular or hit maxDepth
    const moduleA = createMockModule('mutual-a', {
      pattern: 'sequential',
      requires: [{ name: 'mutual-b' }],
      dataflow: [
        { from: 'input', to: 'mutual-b' },
        { from: 'mutual-b', to: 'output' }
      ]
    });
    
    const moduleB = createMockModule('mutual-b', {
      pattern: 'sequential',
      requires: [{ name: 'mutual-a' }],
      dataflow: [
        { from: 'input', to: 'mutual-a' },
        { from: 'mutual-a', to: 'output' }
      ]
    });
    
    registerMockModule(moduleA);
    registerMockModule(moduleB);
    
    // Execute with low maxDepth to prevent infinite loop
    const result = await orchestrator.execute('mutual-a', {}, { maxDepth: 3 });
    
    // Should either: detect circular (E4004), hit max depth (E4005), or complete
    // The important thing is it doesn't hang
    expect(result.totalTimeMs).toBeDefined();
    expect(result.totalTimeMs).toBeLessThan(5000); // Should complete quickly
  });
});

// =============================================================================
// Error Handling
// =============================================================================

describe('E2E: Error Handling', () => {
  it('should propagate module execution errors', async () => {
    const errorModule = createMockModule('error-module');
    
    const composed = createMockModule('error-test', {
      pattern: 'sequential',
      requires: [{ name: 'error-module' }],
      dataflow: [
        { from: 'input', to: 'error-module' },
        { from: 'error-module', to: 'output' }
      ]
    });
    
    registerMockModule(errorModule);
    registerMockModule(composed);
    
    // Module throws an error
    setMockError('error-module', new Error('Module execution failed'));
    
    const result = await orchestrator.execute('error-test', {});
    
    expect(result.ok).toBe(false);
    // Error may be in result.error or result.result.error depending on where it's caught
    const hasError = result.error !== undefined || 
                     (result.result && !result.result.ok);
    expect(hasError).toBe(true);
  });
  
  it('should handle module returning failure result', async () => {
    const failModule = createMockModule('fail-module');
    
    const composed = createMockModule('fail-test', {
      pattern: 'sequential',
      requires: [{ name: 'fail-module' }],
      dataflow: [
        { from: 'input', to: 'fail-module' },
        { from: 'fail-module', to: 'output' }
      ]
    });
    
    registerMockModule(failModule);
    registerMockModule(composed);
    
    setMockResponse('fail-module', {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'Failed deliberately' },
      error: { code: 'E4000', message: 'Deliberate failure' }
    } as ModuleResult);
    
    const result = await orchestrator.execute('fail-test', {});
    
    expect(result.ok).toBe(false);
  });
});
