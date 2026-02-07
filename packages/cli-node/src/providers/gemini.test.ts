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
});
