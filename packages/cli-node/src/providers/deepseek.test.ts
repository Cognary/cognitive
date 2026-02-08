import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeepSeekProvider } from './deepseek.js';

describe('DeepSeekProvider request shaping (stable)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('adds response_format=json_object and appends schema guidance when jsonSchema is provided', async () => {
    const p = new DeepSeekProvider('test-key', 'deepseek-chat');

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
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      maxTokens: 10,
      jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.deepseek.com/v1/chat/completions');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(10);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages?.[0]?.content ?? '').toContain('You MUST respond with valid JSON matching this schema:');
  });
});

