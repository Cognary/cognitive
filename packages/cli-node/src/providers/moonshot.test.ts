import { describe, it, expect } from 'vitest';
import { MoonshotProvider } from './moonshot.js';

describe('MoonshotProvider request shaping', () => {
  it('forces temperature=1 for kimi-k2.5 (API constraint)', () => {
    const p = new MoonshotProvider('test-key', 'kimi-k2.5');
    const body = (p as any).buildRequestBody({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      maxTokens: 123,
    });

    expect(body.model).toBe('kimi-k2.5');
    expect(body.temperature).toBe(1);
    expect(body.max_tokens).toBe(123);
  });

  it('keeps caller temperature for other models', () => {
    const p = new MoonshotProvider('test-key', 'kimi-k2');
    const body = (p as any).buildRequestBody({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
    });

    expect(body.model).toBe('kimi-k2');
    expect(body.temperature).toBe(0.2);
  });
});

