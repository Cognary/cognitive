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
// Integration Test Placeholders
// =============================================================================

describe('CompositionOrchestrator', () => {
  // Note: Full integration tests require mocking Provider and modules
  // These are placeholder tests that should be expanded with proper mocks

  it.skip('should execute sequential composition', async () => {
    // TODO: Add integration test with mocked provider
  });

  it.skip('should execute parallel composition', async () => {
    // TODO: Add integration test with mocked provider
  });

  it.skip('should execute conditional composition', async () => {
    // TODO: Add integration test with mocked provider
  });

  it.skip('should execute iterative composition', async () => {
    // TODO: Add integration test with mocked provider
  });

  it.skip('should handle timeouts', async () => {
    // TODO: Add timeout test
  });

  it.skip('should detect circular dependencies', async () => {
    // TODO: Add circular dependency test
  });

  it.skip('should use fallback modules', async () => {
    // TODO: Add fallback test
  });
});
