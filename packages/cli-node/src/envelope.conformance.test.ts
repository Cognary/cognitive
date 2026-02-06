import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { attachContext, makeErrorEnvelope, makeSuccessEnvelope, ErrorCodes } from './errors/index.js';

function loadEnvelopeSchema(): Record<string, unknown> {
  // packages/cli-node/src -> repo root -> spec/response-envelope.schema.json
  const schemaPath = path.resolve(process.cwd(), '..', '..', 'spec', 'response-envelope.schema.json');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('CEP Envelope Conformance', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(loadEnvelopeSchema());

  function assertConforms(envelope: unknown): void {
    const ok = validate(envelope);
    if (!ok) {
      const msg = (validate.errors ?? [])
        .map(e => `${e.instancePath || '(root)'} ${e.message}`)
        .join('; ');
      throw new Error(`Envelope does not conform: ${msg}`);
    }
  }

  it('makeSuccessEnvelope conforms', () => {
    const env = makeSuccessEnvelope({
      data: { rationale: 'ok', result: 1 },
      confidence: 0.8,
      risk: 'low',
      explain: 'test',
      version: '2.2',
    });
    expect(env.ok).toBe(true);
    assertConforms(env);
  });

  it('makeErrorEnvelope conforms', () => {
    const env = makeErrorEnvelope({
      code: ErrorCodes.INVALID_INPUT,
      message: 'bad input',
      suggestion: 'fix it',
      version: '2.2',
    });
    expect(env.ok).toBe(false);
    assertConforms(env);
  });

  it('attachContext preserves conformance', () => {
    const env = attachContext(
      makeSuccessEnvelope({
        data: { rationale: 'ok' },
        version: '2.2',
      }),
      { module: 'code-reviewer', provider: 'openai' }
    );
    assertConforms(env);
  });
});

