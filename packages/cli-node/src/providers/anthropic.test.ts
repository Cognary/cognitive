import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicProvider } from './anthropic.js';

describe('AnthropicProvider request shaping and streaming usage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('keeps system content separate and appends schema guidance to the last user message', () => {
    const p = new AnthropicProvider('test-key');
    const built = (p as any).buildRequestBody(
      {
        messages: [
          { role: 'system', content: 'system rules' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ack' },
          { role: 'user', content: 'final question' },
        ],
        jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
        maxTokens: 99,
      },
      false
    );

    expect(built.body.system).toBe('system rules');
    expect(built.body.max_tokens).toBe(99);
    expect(built.body.messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'ack' },
      {
        role: 'user',
        content: expect.stringContaining('final question'),
      },
    ]);
    expect(
      String((built.body.messages as Array<{ content: string }>)[2].content)
    ).toContain('You MUST respond with valid JSON matching this schema:');
  });

  it('preserves input tokens from message_start when message_delta only reports output tokens', async () => {
    const p = new AnthropicProvider('test-key');
    const encoder = new TextEncoder();
    const sse = [
      'data: {"type":"message_start","message":{"usage":{"input_tokens":12}}}',
      '',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"ok\\":"}}',
      '',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"true}"}}',
      '',
      'data: {"type":"message_delta","usage":{"output_tokens":7}}',
      '',
    ].join('\n');

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sse));
          controller.close();
        },
      }),
    });

    const stream = p.invokeStream({
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 10,
    } as any);

    const chunks: string[] = [];
    let final:
      | {
          content: string;
          usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
        }
      | undefined;

    while (true) {
      const next = await stream.next();
      if (next.done) {
        final = next.value;
        break;
      }
      chunks.push(next.value);
    }

    expect(chunks.join('')).toBe('{"ok":true}');
    expect(final?.usage).toEqual({
      promptTokens: 12,
      completionTokens: 7,
      totalTokens: 19,
    });
  });
});
