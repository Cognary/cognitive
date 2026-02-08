import { describe, it, expect } from 'vitest';
import { extractJsonCandidate } from './json-extract.js';

describe('extractJsonCandidate', () => {
  it('returns null for empty input', () => {
    expect(extractJsonCandidate('')).toBeNull();
    expect(extractJsonCandidate('   \n')).toBeNull();
  });

  it('accepts already-valid JSON strings (as_is)', () => {
    const r = extractJsonCandidate('{ "ok": true }')!;
    expect(r.strategy).toBe('as_is');
    expect(r.json).toBe('{ "ok": true }');
  });

  it('extracts JSON from code fences', () => {
    const r = extractJsonCandidate('hello\n```json\n{ "a": 1 }\n```\nbye')!;
    expect(r.strategy).toBe('code_fence');
    expect(r.json).toBe('{ "a": 1 }');
  });

  it('extracts first balanced JSON object from noisy text', () => {
    const r = extractJsonCandidate('prefix blah { "a": 1, "b": {"c": 2} } suffix')!;
    expect(r.strategy).toBe('balanced_first');
    expect(r.json).toBe('{ "a": 1, "b": {"c": 2} }');
  });

  it('handles braces inside strings safely', () => {
    const r = extractJsonCandidate('x { "a": "}", "b": "{" , "c": [1,2] } y')!;
    expect(r.json).toBe('{ "a": "}", "b": "{" , "c": [1,2] }');
  });

  it('falls back to last balanced value when earlier start is unbalanced', () => {
    const r = extractJsonCandidate('prefix { "a": 1  \nthen later { "b": 2 } end')!;
    expect(r.strategy).toBe('balanced_first'); // first balanced start is the second object
    expect(r.json).toBe('{ "b": 2 }');
  });
});

