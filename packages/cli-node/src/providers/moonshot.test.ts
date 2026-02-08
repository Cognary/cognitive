import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MoonshotProvider } from './moonshot.js';

describe('MoonshotProvider request shaping', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Ensure each test can stub fetch independently.
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

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

  it('retries once with required temperature when API rejects temperature param', async () => {
    // Use a model that is not hard-coded to force temperature=1, so the retry logic is exercised.
    const p = new MoonshotProvider('test-key', 'kimi-k2');

    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: { message: 'invalid temperature: only 1 is allowed for this model' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ ok: true, meta: { confidence: 1, risk: 'none', explain: 'ok' }, data: { rationale: 'r', result: 'x' } }) } }],
        }),
      });

    const res = await p.invoke({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      maxTokens: 10,
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstBody.temperature).toBe(0.2);
    expect(secondBody.temperature).toBe(1);
    expect(String(res.content)).toContain('"ok":true');
  });
});
