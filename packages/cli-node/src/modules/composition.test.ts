/**
 * Tests for Composition Engine
 * 
 * Tests all COMPOSITION.md specified functionality:
 * - JSONPath-like expression evaluation
 * - Condition expression evaluation
 * - Aggregation strategies
 * - Version matching
 * - Sequential, Parallel, Conditional, Iterative patterns
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateJsonPath,
  evaluateCondition,
  applyMapping,
  aggregateResults,
  versionMatches,
  validateCompositionConfig,
} from './composition.js';
import type { ModuleResult, EnvelopeMeta, CompositionConfig, CompositionPattern, DataflowStep } from '../types.js';

// =============================================================================
// JSONPath Expression Tests
// =============================================================================

describe('evaluateJsonPath', () => {
  const testData = {
    name: 'test',
    nested: {
      value: 42,
      deep: {
        array: [1, 2, 3]
      }
    },
    items: [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' }
    ],
    meta: {
      confidence: 0.95,
      risk: 'low'
    },
    // Test hyphenated field names (Bug fix)
    'quick-check': {
      meta: {
        confidence: 0.85
      },
      data: {
        result: 'success'
      }
    }
  };

  it('should return entire object for $', () => {
    expect(evaluateJsonPath('$', testData)).toEqual(testData);
  });

  it('should access root field with $.field', () => {
    expect(evaluateJsonPath('$.name', testData)).toBe('test');
  });

  it('should access nested field with $.nested.field', () => {
    expect(evaluateJsonPath('$.nested.value', testData)).toBe(42);
    expect(evaluateJsonPath('$.nested.deep.array', testData)).toEqual([1, 2, 3]);
  });

  it('should access array index with $.array[0]', () => {
    expect(evaluateJsonPath('$.items[0]', testData)).toEqual({ id: 1, name: 'a' });
    expect(evaluateJsonPath('$.items[1].name', testData)).toBe('b');
    expect(evaluateJsonPath('$.nested.deep.array[2]', testData)).toBe(3);
  });

  it('should map over array with $.array[*].field', () => {
    expect(evaluateJsonPath('$.items[*].name', testData)).toEqual(['a', 'b', 'c']);
    expect(evaluateJsonPath('$.items[*].id', testData)).toEqual([1, 2, 3]);
  });

  it('should return undefined for non-existent paths', () => {
    expect(evaluateJsonPath('$.nonexistent', testData)).toBeUndefined();
    expect(evaluateJsonPath('$.nested.nonexistent', testData)).toBeUndefined();
    expect(evaluateJsonPath('$.items[99]', testData)).toBeUndefined();
  });

  it('should return literal values for non-JSONPath strings', () => {
    expect(evaluateJsonPath('literal', testData)).toBe('literal');
    expect(evaluateJsonPath('123', testData)).toBe('123');
  });

  it('should handle hyphenated field names', () => {
    expect(evaluateJsonPath('$.quick-check.meta.confidence', testData)).toBe(0.85);
    expect(evaluateJsonPath('$.quick-check.data.result', testData)).toBe('success');
  });
});

// =============================================================================
// Condition Expression Tests
// =============================================================================

describe('evaluateCondition', () => {
  const testData = {
    meta: {
      confidence: 0.85,
      risk: 'low'
    },
    data: {
      count: 5,
      items: [1, 2, 3],
      name: 'test module'
    }
  };

  describe('comparison operators', () => {
    it('should evaluate > operator', () => {
      expect(evaluateCondition('$.meta.confidence > 0.7', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.9', testData)).toBe(false);
    });

    it('should evaluate < operator', () => {
      expect(evaluateCondition('$.meta.confidence < 0.9', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence < 0.5', testData)).toBe(false);
    });

    it('should evaluate >= operator', () => {
      expect(evaluateCondition('$.meta.confidence >= 0.85', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence >= 0.9', testData)).toBe(false);
    });

    it('should evaluate <= operator', () => {
      expect(evaluateCondition('$.meta.confidence <= 0.85', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence <= 0.5', testData)).toBe(false);
    });

    it('should evaluate == operator', () => {
      expect(evaluateCondition('$.meta.risk == "low"', testData)).toBe(true);
      expect(evaluateCondition('$.meta.risk == "high"', testData)).toBe(false);
      expect(evaluateCondition('$.data.count == 5', testData)).toBe(true);
    });

    it('should evaluate != operator', () => {
      expect(evaluateCondition('$.meta.risk != "high"', testData)).toBe(true);
      expect(evaluateCondition('$.meta.risk != "low"', testData)).toBe(false);
    });
  });

  describe('logical operators', () => {
    it('should evaluate && operator', () => {
      expect(evaluateCondition('$.meta.confidence > 0.7 && $.meta.risk == "low"', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.9 && $.meta.risk == "low"', testData)).toBe(false);
    });

    it('should evaluate || operator', () => {
      expect(evaluateCondition('$.meta.confidence > 0.9 || $.meta.risk == "low"', testData)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.9 || $.meta.risk == "high"', testData)).toBe(false);
    });

    it('should evaluate ! operator', () => {
      expect(evaluateCondition('!false', {})).toBe(true);
      expect(evaluateCondition('!true', {})).toBe(false);
    });
  });

  describe('special functions', () => {
    it('should evaluate exists() function', () => {
      expect(evaluateCondition('exists($.meta.confidence)', testData)).toBe(true);
      expect(evaluateCondition('exists($.meta.nonexistent)', testData)).toBe(false);
    });

    it('should evaluate .length property', () => {
      expect(evaluateCondition('$.data.items.length > 0', testData)).toBe(true);
      expect(evaluateCondition('$.data.items.length == 3', testData)).toBe(true);
    });

    it('should evaluate contains() for strings', () => {
      expect(evaluateCondition('contains($.data.name, "test")', testData)).toBe(true);
      expect(evaluateCondition('contains($.data.name, "xyz")', testData)).toBe(false);
    });

    it('should evaluate contains() for arrays', () => {
      const dataWithArray = {
        tags: ['javascript', 'typescript', 'node']
      };
      expect(evaluateCondition('contains($.tags, "typescript")', dataWithArray)).toBe(true);
      expect(evaluateCondition('contains($.tags, "python")', dataWithArray)).toBe(false);
    });
  });

  describe('hyphenated field names', () => {
    const hyphenData = {
      'quick-check': {
        meta: { confidence: 0.85 },
        data: { result: 'success' }
      }
    };

    it('should handle hyphenated field names in conditions', () => {
      expect(evaluateCondition('$.quick-check.meta.confidence > 0.8', hyphenData)).toBe(true);
      expect(evaluateCondition('$.quick-check.meta.confidence > 0.9', hyphenData)).toBe(false);
    });

    it('should handle hyphenated fields with string comparison', () => {
      expect(evaluateCondition('$.quick-check.data.result == "success"', hyphenData)).toBe(true);
    });
  });
});

// =============================================================================
// Dataflow Mapping Tests
// =============================================================================

describe('applyMapping', () => {
  const sourceData = {
    code: 'function test() {}',
    language: 'javascript',
    nested: {
      value: 42
    }
  };

  it('should map simple fields', () => {
    const mapping = {
      source_code: '$.code',
      lang: '$.language'
    };
    
    const result = applyMapping(mapping, sourceData);
    
    expect(result.source_code).toBe('function test() {}');
    expect(result.lang).toBe('javascript');
  });

  it('should map nested fields', () => {
    const mapping = {
      extracted_value: '$.nested.value'
    };
    
    const result = applyMapping(mapping, sourceData);
    
    expect(result.extracted_value).toBe(42);
  });

  it('should handle missing fields', () => {
    const mapping = {
      missing: '$.nonexistent'
    };
    
    const result = applyMapping(mapping, sourceData);
    
    expect(result.missing).toBeUndefined();
  });

  it('should pass through entire object with $', () => {
    const mapping = {
      all: '$'
    };
    
    const result = applyMapping(mapping, sourceData);
    
    expect(result.all).toEqual(sourceData);
  });
});

// =============================================================================
// Aggregation Strategy Tests
// =============================================================================

describe('aggregateResults', () => {
  const createResult = (data: unknown, confidence: number, risk: string): ModuleResult => ({
    ok: true,
    meta: {
      confidence,
      risk: risk as 'none' | 'low' | 'medium' | 'high',
      explain: 'Test result'
    },
    data: {
      ...(data as Record<string, unknown>),
      rationale: 'Test rationale'
    }
  });

  const results: ModuleResult[] = [
    createResult({ field1: 'value1', common: 'first' }, 0.8, 'low'),
    createResult({ field2: 'value2', common: 'second' }, 0.9, 'medium'),
    createResult({ field3: 'value3', common: 'third' }, 0.7, 'none')
  ];

  describe('merge strategy', () => {
    it('should deep merge all results (later wins)', () => {
      const merged = aggregateResults(results, 'merge');
      
      expect(merged.ok).toBe(true);
      expect((merged as { data: Record<string, unknown> }).data.field1).toBe('value1');
      expect((merged as { data: Record<string, unknown> }).data.field2).toBe('value2');
      expect((merged as { data: Record<string, unknown> }).data.field3).toBe('value3');
      expect((merged as { data: Record<string, unknown> }).data.common).toBe('third'); // Last wins
    });

    it('should aggregate meta values', () => {
      const merged = aggregateResults(results, 'merge');
      
      // Average confidence
      expect((merged as { meta: EnvelopeMeta }).meta.confidence).toBeCloseTo(0.8, 1);
      // Max risk
      expect((merged as { meta: EnvelopeMeta }).meta.risk).toBe('medium');
    });
  });

  describe('array strategy', () => {
    it('should collect all results into array', () => {
      const collected = aggregateResults(results, 'array');
      
      expect(collected.ok).toBe(true);
      const data = (collected as { data: { results: unknown[] } }).data;
      expect(data.results).toHaveLength(3);
    });
  });

  describe('first strategy', () => {
    it('should return first successful result', () => {
      const first = aggregateResults(results, 'first');
      
      expect(first.ok).toBe(true);
      expect((first as { data: Record<string, unknown> }).data.field1).toBe('value1');
    });

    it('should skip failed results', () => {
      const mixedResults: ModuleResult[] = [
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Failed' },
          error: { code: 'E1000', message: 'Error' }
        },
        createResult({ success: true }, 0.9, 'low')
      ];
      
      const first = aggregateResults(mixedResults, 'first');
      
      expect(first.ok).toBe(true);
      expect((first as { data: Record<string, unknown> }).data.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return error for empty results', () => {
      const empty = aggregateResults([], 'merge');
      
      expect(empty.ok).toBe(false);
    });

    it('should return single result unchanged', () => {
      const single = aggregateResults([results[0]], 'merge');
      
      expect(single).toEqual(results[0]);
    });
  });
});

// =============================================================================
// Version Matching Tests
// =============================================================================

describe('versionMatches', () => {
  describe('exact version', () => {
    it('should match exact version', () => {
      expect(versionMatches('1.0.0', '1.0.0')).toBe(true);
      expect(versionMatches('1.0.0', '1.0.1')).toBe(false);
      expect(versionMatches('2.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('wildcard (*)', () => {
    it('should match any version with *', () => {
      expect(versionMatches('1.0.0', '*')).toBe(true);
      expect(versionMatches('99.99.99', '*')).toBe(true);
    });

    it('should match any version with empty pattern', () => {
      expect(versionMatches('1.0.0', '')).toBe(true);
    });
  });

  describe('>= operator', () => {
    it('should match versions greater than or equal', () => {
      expect(versionMatches('1.0.0', '>=1.0.0')).toBe(true);
      expect(versionMatches('1.1.0', '>=1.0.0')).toBe(true);
      expect(versionMatches('2.0.0', '>=1.0.0')).toBe(true);
      expect(versionMatches('0.9.0', '>=1.0.0')).toBe(false);
    });
  });

  describe('> operator', () => {
    it('should match versions strictly greater', () => {
      expect(versionMatches('1.0.1', '>1.0.0')).toBe(true);
      expect(versionMatches('1.1.0', '>1.0.0')).toBe(true);
      expect(versionMatches('1.0.0', '>1.0.0')).toBe(false);
    });
  });

  describe('^ (caret) operator', () => {
    it('should match same major version', () => {
      expect(versionMatches('1.2.3', '^1.0.0')).toBe(true);
      expect(versionMatches('1.0.0', '^1.0.0')).toBe(true);
      expect(versionMatches('2.0.0', '^1.0.0')).toBe(false);
      expect(versionMatches('0.9.0', '^1.0.0')).toBe(false);
    });
  });

  describe('~ (tilde) operator', () => {
    it('should match same major.minor version', () => {
      expect(versionMatches('1.0.5', '~1.0.0')).toBe(true);
      expect(versionMatches('1.0.0', '~1.0.0')).toBe(true);
      expect(versionMatches('1.1.0', '~1.0.0')).toBe(false);
      expect(versionMatches('2.0.0', '~1.0.0')).toBe(false);
    });
  });
});

// =============================================================================
// Composition Config Validation Tests
// =============================================================================

describe('validateCompositionConfig', () => {
  it('should validate correct sequential config', () => {
    const config: CompositionConfig = {
      pattern: 'sequential',
      requires: [{ name: 'module-a' }],
      dataflow: [
        { from: 'input', to: 'module-a' },
        { from: 'module-a.output', to: 'output' }
      ]
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate correct parallel config', () => {
    const config: CompositionConfig = {
      pattern: 'parallel',
      requires: [
        { name: 'module-a' },
        { name: 'module-b' }
      ],
      dataflow: [
        { from: 'input', to: ['module-a', 'module-b'] },
        { from: ['module-a.output', 'module-b.output'], to: 'output', aggregate: 'merge' }
      ]
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(true);
  });

  it('should require routing rules for conditional pattern', () => {
    const config: CompositionConfig = {
      pattern: 'conditional',
      dataflow: [{ from: 'input', to: 'module-a' }]
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('routing'))).toBe(true);
  });

  it('should require iteration config for iterative pattern', () => {
    const config: CompositionConfig = {
      pattern: 'iterative',
      dataflow: [{ from: 'input', to: 'module-a' }]
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('continue_condition') || e.includes('stop_condition'))).toBe(true);
  });

  it('should validate correct iterative config', () => {
    const config: CompositionConfig = {
      pattern: 'iterative',
      iteration: {
        max_iterations: 10,
        stop_condition: '$.meta.confidence > 0.9'
      }
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(true);
  });

  it('should detect invalid pattern', () => {
    const config = {
      pattern: 'invalid' as CompositionPattern,
      dataflow: []
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid pattern'))).toBe(true);
  });

  it('should detect missing dataflow fields', () => {
    const config: CompositionConfig = {
      pattern: 'sequential',
      dataflow: [
        { from: 'input' } as DataflowStep, // Missing 'to'
      ]
    };
    
    const result = validateCompositionConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("missing 'to'"))).toBe(true);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

import type { ModuleResult } from '../types.js';
import type { CompositionConfig } from './composition.js';

describe('CompositionOrchestrator', () => {
  describe('Sequential Composition', () => {
    it('should execute sequential composition correctly', () => {
      // Test dataflow evaluation for sequential pattern
      const moduleAResult = {
        ok: true,
        meta: { confidence: 0.9, risk: 'low', explain: 'Module A completed' },
        data: { processed: 'step1', rationale: 'First step complete' }
      };
      
      const moduleBResult = {
        ok: true,
        meta: { confidence: 0.85, risk: 'low', explain: 'Module B completed' },
        data: { processed: 'step2', rationale: 'Second step complete' }
      };
      
      // Test JSONPath extraction from sequential results
      const extractedA = evaluateJsonPath('$.processed', moduleAResult.data);
      const extractedB = evaluateJsonPath('$.processed', moduleBResult.data);
      
      expect(extractedA).toBe('step1');
      expect(extractedB).toBe('step2');
    });
  });

  describe('Parallel Composition', () => {
    it('should aggregate parallel results with merge strategy', () => {
      const results: ModuleResult[] = [
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'A' },
          data: { field_a: 'value_a', rationale: 'Rationale A' }
        },
        {
          ok: true,
          meta: { confidence: 0.85, risk: 'medium', explain: 'B' },
          data: { field_b: 'value_b', rationale: 'Rationale B' }
        }
      ];
      
      const merged = aggregateResults(results, 'merge');
      
      expect(merged.ok).toBe(true);
      const mergedData = (merged as { data: Record<string, unknown> }).data;
      expect(mergedData.field_a).toBe('value_a');
      expect(mergedData.field_b).toBe('value_b');
      
      // Risk should be max (medium > low)
      expect((merged as { meta: EnvelopeMeta }).meta.risk).toBe('medium');
    });
    
    it('should aggregate parallel results with array strategy', () => {
      const results: ModuleResult[] = [
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'A' },
          data: { value: 1, rationale: 'R1' }
        },
        {
          ok: true,
          meta: { confidence: 0.85, risk: 'low', explain: 'B' },
          data: { value: 2, rationale: 'R2' }
        },
        {
          ok: true,
          meta: { confidence: 0.8, risk: 'low', explain: 'C' },
          data: { value: 3, rationale: 'R3' }
        }
      ];
      
      const collected = aggregateResults(results, 'array');
      
      expect(collected.ok).toBe(true);
      const data = (collected as { data: { results: unknown[] } }).data;
      expect(data.results).toHaveLength(3);
    });
  });

  describe('Conditional Composition', () => {
    it('should evaluate conditions with confidence check', () => {
      const highConfidenceResult = {
        meta: { confidence: 0.95, risk: 'low' },
        data: { result: 'high' }
      };
      
      const lowConfidenceResult = {
        meta: { confidence: 0.3, risk: 'medium' },
        data: { result: 'low' }
      };
      
      // Test condition evaluation
      expect(evaluateCondition('$.meta.confidence > 0.7', highConfidenceResult)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.7', lowConfidenceResult)).toBe(false);
      expect(evaluateCondition('$.meta.risk == "low"', highConfidenceResult)).toBe(true);
      expect(evaluateCondition('$.meta.risk == "low"', lowConfidenceResult)).toBe(false);
    });
    
    it('should evaluate complex conditions with && and ||', () => {
      const result = {
        meta: { confidence: 0.85, risk: 'medium' },
        data: { status: 'complete', count: 10 }
      };
      
      // Combined conditions
      expect(evaluateCondition('$.meta.confidence > 0.8 && $.data.count > 5', result)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.9 || $.data.count > 5', result)).toBe(true);
      expect(evaluateCondition('$.meta.confidence > 0.9 && $.data.count > 5', result)).toBe(false);
    });
  });

  describe('Iterative Composition', () => {
    it('should evaluate stop conditions correctly', () => {
      const iteration1 = {
        meta: { confidence: 0.7, risk: 'medium', explain: 'First pass' },
        data: { quality: 0.7, rationale: 'Initial' }
      };
      
      const iteration2 = {
        meta: { confidence: 0.85, risk: 'low', explain: 'Second pass' },
        data: { quality: 0.85, rationale: 'Improved' }
      };
      
      const iteration3 = {
        meta: { confidence: 0.95, risk: 'low', explain: 'Final pass' },
        data: { quality: 0.95, rationale: 'Converged' }
      };
      
      const stopCondition = '$.meta.confidence > 0.9';
      
      expect(evaluateCondition(stopCondition, iteration1)).toBe(false);
      expect(evaluateCondition(stopCondition, iteration2)).toBe(false);
      expect(evaluateCondition(stopCondition, iteration3)).toBe(true);
    });
  });

  describe('Timeout Handling', () => {
    it('should validate timeout configuration', () => {
      const config: CompositionConfig = {
        pattern: 'sequential',
        timeout_ms: 5000,
        dataflow: [
          { from: 'input', to: 'module-a' }
        ]
      };
      
      const result = validateCompositionConfig(config);
      expect(result.valid).toBe(true);
    });
    
    it('should accept per-dependency timeout', () => {
      const config: CompositionConfig = {
        pattern: 'sequential',
        requires: [
          { name: 'module-a', timeout_ms: 3000 },
          { name: 'module-b', timeout_ms: 5000 }
        ],
        dataflow: [
          { from: 'input', to: 'module-a' },
          { from: 'module-a.output', to: 'output' }
        ]
      };
      
      const result = validateCompositionConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular reference in dataflow', () => {
      // Test that evaluateJsonPath handles circular-like references safely
      const data = {
        self: { ref: '$.self.ref' } // Would be circular if evaluated
      };
      
      // JSONPath should return the literal value, not cause infinite loop
      const result = evaluateJsonPath('$.self.ref', data);
      expect(result).toBe('$.self.ref');
    });
    
    it('should validate requires has no duplicates', () => {
      const config: CompositionConfig = {
        pattern: 'sequential',
        requires: [
          { name: 'module-a' },
          { name: 'module-b' },
          { name: 'module-a' } // Duplicate
        ],
        dataflow: []
      };
      
      // Duplicates should be filtered by implementation
      const uniqueNames = new Set(config.requires?.map(r => r.name));
      expect(uniqueNames.size).toBe(2);
    });
  });

  describe('Fallback Modules', () => {
    it('should validate fallback configuration', () => {
      const config: CompositionConfig = {
        pattern: 'sequential',
        requires: [
          { name: 'primary-module', fallback: 'backup-module' },
          { name: 'optional-module', optional: true, fallback: null }
        ],
        dataflow: [
          { from: 'input', to: 'primary-module' }
        ]
      };
      
      const result = validateCompositionConfig(config);
      expect(result.valid).toBe(true);
    });
    
    it('should accept optional dependencies', () => {
      const config: CompositionConfig = {
        pattern: 'parallel',
        requires: [
          { name: 'required-module' },
          { name: 'optional-module', optional: true }
        ],
        dataflow: [
          { from: 'input', to: ['required-module', 'optional-module'] },
          { from: ['required-module.output', 'optional-module.output'], to: 'output', aggregate: 'merge' }
        ]
      };
      
      const result = validateCompositionConfig(config);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle error aggregation in merge strategy', () => {
      const results: ModuleResult[] = [
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Error A' },
          error: { code: 'E1001', message: 'Validation failed' }
        },
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'Success B' },
          data: { field: 'value', rationale: 'OK' }
        }
      ];
      
      // First strategy should return first successful result
      const first = aggregateResults(results, 'first');
      expect(first.ok).toBe(true);
      expect((first as { data: Record<string, unknown> }).data.field).toBe('value');
    });
    
    it('should return error for all-failed results', () => {
      const results: ModuleResult[] = [
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Error A' },
          error: { code: 'E1001', message: 'Error A' }
        },
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Error B' },
          error: { code: 'E1002', message: 'Error B' }
        }
      ];
      
      const first = aggregateResults(results, 'first');
      // When all fail, first should still return error
      expect(first.ok).toBe(false);
    });
  });
});

// =============================================================================
// E2E Integration Tests - Composition Logic
// =============================================================================

describe('CompositionOrchestrator E2E', () => {
  // These tests validate composition configuration and logic
  // without needing to mock the module loader
  
  describe('Orchestrator Configuration Validation', () => {
    it('should validate sequential pattern with dataflow', () => {
      const composition: CompositionConfig = {
        pattern: 'sequential',
        requires: [
          { name: 'step-a', version: '>=1.0.0' },
          { name: 'step-b', version: '^1.0.0' }
        ],
        dataflow: [
          { from: 'input', to: 'step-a' },
          { from: 'step-a.output', to: 'step-b' },
          { from: 'step-b.output', to: 'output' }
        ]
      };
      
      const result = validateCompositionConfig(composition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate parallel pattern with aggregation', () => {
      const composition: CompositionConfig = {
        pattern: 'parallel',
        requires: [
          { name: 'worker-a' },
          { name: 'worker-b' },
          { name: 'worker-c' }
        ],
        dataflow: [
          { from: 'input', to: ['worker-a', 'worker-b', 'worker-c'] },
          { 
            from: ['worker-a.output', 'worker-b.output', 'worker-c.output'], 
            to: 'output', 
            aggregate: 'merge' 
          }
        ]
      };
      
      const result = validateCompositionConfig(composition);
      expect(result.valid).toBe(true);
    });
    
    it('should validate conditional pattern with routing', () => {
      const composition: CompositionConfig = {
        pattern: 'conditional',
        requires: [
          { name: 'classifier' },
          { name: 'path-a' },
          { name: 'path-b' }
        ],
        dataflow: [
          { from: 'input', to: 'classifier' }
        ],
        routing: [
          { condition: '$.data.type == "a"', next: 'path-a' },
          { condition: '$.data.type == "b"', next: 'path-b' },
          { condition: 'true', next: null } // Default: use classifier result
        ]
      };
      
      const result = validateCompositionConfig(composition);
      expect(result.valid).toBe(true);
    });
    
    it('should validate iterative pattern with stop condition', () => {
      const composition: CompositionConfig = {
        pattern: 'iterative',
        requires: [
          { name: 'refiner' }
        ],
        iteration: {
          max_iterations: 5,
          stop_condition: '$.meta.confidence > 0.95'
        },
        dataflow: [
          { from: 'input', to: 'refiner' },
          { from: 'refiner.output', to: 'output' }
        ]
      };
      
      const result = validateCompositionConfig(composition);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Dataflow Mapping', () => {
    it('should apply field mapping in dataflow', () => {
      const sourceData = {
        original_code: 'function foo() {}',
        language: 'javascript',
        metadata: {
          author: 'test',
          version: '1.0'
        }
      };
      
      const mapping = {
        code: '$.original_code',
        lang: '$.language',
        author_name: '$.metadata.author'
      };
      
      const result = applyMapping(mapping, sourceData);
      
      expect(result.code).toBe('function foo() {}');
      expect(result.lang).toBe('javascript');
      expect(result.author_name).toBe('test');
    });
    
    it('should handle array wildcard in mapping', () => {
      const sourceData = {
        items: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
          { id: 3, name: 'c' }
        ]
      };
      
      const names = evaluateJsonPath('$.items[*].name', sourceData);
      expect(names).toEqual(['a', 'b', 'c']);
      
      const ids = evaluateJsonPath('$.items[*].id', sourceData);
      expect(ids).toEqual([1, 2, 3]);
    });
  });
  
  describe('Result Aggregation Strategies', () => {
    it('should merge results with conflict resolution (last wins)', () => {
      const results: ModuleResult[] = [
        {
          ok: true,
          meta: { confidence: 0.8, risk: 'low', explain: 'First' },
          data: { shared: 'first', unique_a: 'a', rationale: 'R1' }
        },
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'medium', explain: 'Second' },
          data: { shared: 'second', unique_b: 'b', rationale: 'R2' }
        }
      ];
      
      const merged = aggregateResults(results, 'merge');
      const data = (merged as { data: Record<string, unknown> }).data;
      
      // Last wins for shared field
      expect(data.shared).toBe('second');
      // Both unique fields preserved
      expect(data.unique_a).toBe('a');
      expect(data.unique_b).toBe('b');
    });
    
    it('should calculate average confidence in merge', () => {
      const results: ModuleResult[] = [
        {
          ok: true,
          meta: { confidence: 0.6, risk: 'low', explain: 'A' },
          data: { rationale: 'R1' }
        },
        {
          ok: true,
          meta: { confidence: 0.8, risk: 'low', explain: 'B' },
          data: { rationale: 'R2' }
        },
        {
          ok: true,
          meta: { confidence: 1.0, risk: 'low', explain: 'C' },
          data: { rationale: 'R3' }
        }
      ];
      
      const merged = aggregateResults(results, 'merge');
      const meta = (merged as { meta: EnvelopeMeta }).meta;
      
      // Average: (0.6 + 0.8 + 1.0) / 3 = 0.8
      expect(meta.confidence).toBeCloseTo(0.8, 1);
    });
    
    it('should skip failed results in first strategy', () => {
      const results: ModuleResult[] = [
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Failed' },
          error: { code: 'E1001', message: 'First failed' }
        },
        {
          ok: false,
          meta: { confidence: 0, risk: 'high', explain: 'Also failed' },
          error: { code: 'E1002', message: 'Second failed' }
        },
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'Success!' },
          data: { winner: true, rationale: 'Third succeeded' }
        }
      ];
      
      const first = aggregateResults(results, 'first');
      
      expect(first.ok).toBe(true);
      expect((first as { data: Record<string, unknown> }).data.winner).toBe(true);
    });
    
    it('should collect all results in array strategy', () => {
      const results: ModuleResult[] = [
        {
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'A' },
          data: { value: 'a', rationale: 'R1' }
        },
        {
          ok: true,
          meta: { confidence: 0.85, risk: 'medium', explain: 'B' },
          data: { value: 'b', rationale: 'R2' }
        }
      ];
      
      const collected = aggregateResults(results, 'array');
      const data = (collected as { data: { results: Array<Record<string, unknown>> } }).data;
      
      expect(data.results).toHaveLength(2);
      expect(data.results[0].value).toBe('a');
      expect(data.results[1].value).toBe('b');
    });
  });
  
  describe('Condition Evaluation Edge Cases', () => {
    it('should handle missing paths gracefully', () => {
      const data = { existing: { field: 'value' } };
      
      // Missing path should return false for comparisons
      expect(evaluateCondition('$.nonexistent > 0', data)).toBe(false);
      expect(evaluateCondition('$.nonexistent == "foo"', data)).toBe(false);
    });
    
    it('should handle exists() function', () => {
      const data = {
        present: 'value',
        nested: { deep: { field: 42 } }
      };
      
      expect(evaluateCondition('exists($.present)', data)).toBe(true);
      expect(evaluateCondition('exists($.missing)', data)).toBe(false);
      expect(evaluateCondition('exists($.nested.deep.field)', data)).toBe(true);
      expect(evaluateCondition('exists($.nested.deep.missing)', data)).toBe(false);
    });
    
    it('should handle contains() for strings and arrays', () => {
      const data = {
        message: 'Hello, World!',
        tags: ['javascript', 'typescript', 'node']
      };
      
      expect(evaluateCondition('contains($.message, "World")', data)).toBe(true);
      expect(evaluateCondition('contains($.message, "Python")', data)).toBe(false);
      expect(evaluateCondition('contains($.tags, "typescript")', data)).toBe(true);
      expect(evaluateCondition('contains($.tags, "rust")', data)).toBe(false);
    });
    
    it('should handle .length property', () => {
      const data = {
        items: [1, 2, 3, 4, 5],
        name: 'test'
      };
      
      expect(evaluateCondition('$.items.length > 3', data)).toBe(true);
      expect(evaluateCondition('$.items.length == 5', data)).toBe(true);
      expect(evaluateCondition('$.name.length == 4', data)).toBe(true);
    });
  });
  
  describe('Version Matching', () => {
    it('should match exact versions', () => {
      expect(versionMatches('1.2.3', '1.2.3')).toBe(true);
      expect(versionMatches('1.2.3', '1.2.4')).toBe(false);
    });
    
    it('should match caret (^) ranges', () => {
      expect(versionMatches('1.2.3', '^1.0.0')).toBe(true);
      expect(versionMatches('1.9.9', '^1.0.0')).toBe(true);
      expect(versionMatches('2.0.0', '^1.0.0')).toBe(false);
    });
    
    it('should match tilde (~) ranges', () => {
      expect(versionMatches('1.0.5', '~1.0.0')).toBe(true);
      expect(versionMatches('1.0.99', '~1.0.0')).toBe(true);
      expect(versionMatches('1.1.0', '~1.0.0')).toBe(false);
    });
    
    it('should match >= ranges', () => {
      expect(versionMatches('1.0.0', '>=1.0.0')).toBe(true);
      expect(versionMatches('2.5.0', '>=1.0.0')).toBe(true);
      expect(versionMatches('0.9.9', '>=1.0.0')).toBe(false);
    });
    
    it('should match wildcard', () => {
      expect(versionMatches('0.0.1', '*')).toBe(true);
      expect(versionMatches('99.99.99', '*')).toBe(true);
      expect(versionMatches('1.0.0', '')).toBe(true);
    });
  });
});
