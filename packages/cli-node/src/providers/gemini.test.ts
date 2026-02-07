import { describe, it, expect } from 'vitest';
import { GeminiProvider } from './gemini.js';

describe('GeminiProvider schema compatibility', () => {
  it('converts JSON-Schema `const` into `enum` for responseSchema', () => {
    const p = new GeminiProvider('test-key');
    const cleaned = (p as any).cleanSchemaForGemini({
      oneOf: [
        { type: 'object', properties: { ok: { const: true } } },
        { type: 'object', properties: { ok: { const: false } } },
      ],
    });

    expect(cleaned).toEqual({
      oneOf: [
        { type: 'object', properties: { ok: { enum: [true] } } },
        { type: 'object', properties: { ok: { enum: [false] } } },
      ],
    });
  });
});

