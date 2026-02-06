import { describe, it, expect } from 'vitest';
import { encodeSseFrame } from './sse.js';

describe('encodeSseFrame', () => {
  it('encodes event/data with trailing blank line', () => {
    const frame = encodeSseFrame({ a: 1 }, { event: 'delta', id: 3, retryMs: 1000 });
    expect(frame).toContain('retry: 1000\n');
    expect(frame).toContain('id: 3\n');
    expect(frame).toContain('event: delta\n');
    expect(frame).toContain('data: {"a":1}\n');
    expect(frame.endsWith('\n\n')).toBe(true);
  });
});

