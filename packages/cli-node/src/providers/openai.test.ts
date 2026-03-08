import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAIProvider } from './openai.js';

describe('OpenAIProvider request shaping (stable)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('adds response_format=json_object and appends schema guidance to the last user message', async () => {
    const p = new OpenAIProvider('test-key', 'gpt-5.2');

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
        { role: 'system', content: 'system' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'ack' },
        { role: 'user', content: 'final question' },
      ],
      temperature: 0.2,
      maxTokens: 10,
      jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-5.2');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(10);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[3].content).toContain('final question');
    expect(body.messages[3].content).toContain('You MUST respond with valid JSON matching this schema:');
  });
});
