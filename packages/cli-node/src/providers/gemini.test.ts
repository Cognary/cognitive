import { describe, it, expect } from 'vitest';
import { GeminiProvider } from './gemini.js';

describe('GeminiProvider schema compatibility', () => {
  it('drops boolean const/enum constraints (Gemini enums appear string-only)', () => {
    const p = new GeminiProvider('test-key');
    const cleaned = (p as any).cleanSchemaForGemini({
      oneOf: [
        { type: 'object', properties: { ok: { const: true } } },
        { type: 'object', properties: { ok: { const: false } } },
      ],
    });

    expect(cleaned).toEqual({
      oneOf: [
        { type: 'object', properties: { ok: { type: 'boolean' } } },
        { type: 'object', properties: { ok: { type: 'boolean' } } },
      ],
    });
  });

  it('does not send responseSchema when jsonSchemaMode=prompt (prompt-only guidance)', () => {
    const p = new GeminiProvider('test-key');
    const body = (p as any).buildRequestBody({
      messages: [{ role: 'user', content: 'hi' }],
      jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      jsonSchemaMode: 'prompt',
    });

    expect((body.generationConfig ?? {}).responseSchema).toBeUndefined();
    expect((body.generationConfig ?? {}).responseMimeType).toBeUndefined();

    const text = body.contents?.[0]?.parts?.[0]?.text ?? '';
    expect(String(text)).toContain('You MUST respond with valid JSON matching this schema:');
  });

  it('sends responseSchema only when jsonSchemaMode=native', () => {
    const p = new GeminiProvider('test-key');
    const body = (p as any).buildRequestBody({
      messages: [{ role: 'user', content: 'hi' }],
      jsonSchema: { type: 'object', properties: { ok: { const: true } } },
      jsonSchemaMode: 'native',
    });

    expect((body.generationConfig ?? {}).responseMimeType).toEqual('application/json');
    expect((body.generationConfig ?? {}).responseSchema).toEqual({
      type: 'object',
      properties: { ok: { type: 'boolean' } },
    });
  });
});
