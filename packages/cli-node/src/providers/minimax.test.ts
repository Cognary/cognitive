import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniMaxProvider } from './minimax.js';

describe('MiniMaxProvider request shaping (stable)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('appends schema guidance to the last user message when jsonSchema is provided', async () => {
    const p = new MiniMaxProvider('test-key', 'MiniMax-M2.1');

    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    });

    await p.invoke({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'ack' },
        { role: 'user', content: 'final question' },
      ],
      temperature: 0.2,
      maxTokens: 10,
      jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('MiniMax-M2.1');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(10);
    expect(body.messages[2].content).toContain('final question');
    expect(body.messages[2].content).toContain('You MUST respond with valid JSON matching this schema:');
  });
});
