import { describe, it, expect } from 'vitest';
import { parseCalls, substituteCallResults } from './subagent.js';

describe('subagent call substitution', () => {
  it('replaces repeated identical directives at each original location', () => {
    const text = 'First: @call:child\nSecond: @call:child';
    const calls = parseCalls(text);

    expect(calls).toHaveLength(2);

    const result = substituteCallResults(text, [
      { ...calls[0], result: 'one' },
      { ...calls[1], result: 'two' },
    ]);

    expect(result).toBe(
      'First: [Result from child]:\none\nSecond: [Result from child]:\ntwo'
    );
  });

  it('keeps fallback replacement behavior for callers that only pass match text', () => {
    const text = 'Before @call:child after';
    const result = substituteCallResults(text, [
      { match: '@call:child', module: 'child', result: { ok: true } },
    ]);

    expect(result).toContain('[Result from child]:');
    expect(result).toContain('"ok": true');
  });
});
