import { describe, it, expect } from 'vitest';
import type { CognitiveModule, ExecutionPolicy, InvokeParams, InvokeResult, Provider } from '../types.js';
import { runModule } from './runner.js';

function makePolicy(overrides: Partial<ExecutionPolicy> = {}): ExecutionPolicy {
  return {
    profile: 'default',
    validate: 'on',
    audit: false,
    enableRepair: true,
    structured: 'auto',
    requireV22: false,
    ...overrides,
  };
}

function makeModule(): CognitiveModule {
  return {
    name: 'demo',
    version: '1.0.0',
    responsibility: 'demo',
    excludes: [],
    prompt: 'Return JSON only.',
    outputSchema: {
      type: 'object',
      additionalProperties: true,
    },
    location: '/tmp/demo',
    format: 'v2',
    formatVersion: 'v2.2',
    tier: 'decision',
  };
}

class SchemaSensitiveProvider implements Provider {
  name = 'schema-sensitive';
  calls: InvokeParams[] = [];

  isConfigured(): boolean {
    return true;
  }

  getCapabilities() {
    return { structuredOutput: 'native' as const, streaming: false };
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    this.calls.push(params);
    if (params.jsonSchemaMode === 'native') {
      throw new Error(
        'Gemini API error: 400 - Invalid JSON payload received. Unknown name "const" at generation_config.response_schema'
      );
    }
    return {
      content: JSON.stringify({
        ok: true,
        meta: { confidence: 1, risk: 'none', explain: 'ok' },
        data: { rationale: 'r', result: 'x' },
      }),
    };
  }
}

describe('runner structured output preference', () => {
  it('auto: falls back native -> prompt on schema compatibility error', async () => {
    const provider = new SchemaSensitiveProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'auto' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      validateOutput: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(2);
    expect(provider.calls[0].jsonSchemaMode).toBe('native');
    expect(provider.calls[1].jsonSchemaMode).toBe('prompt');
  });

  it('native: does not fall back (fails fast)', async () => {
    const provider = new SchemaSensitiveProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'native' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      validateOutput: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(2);
    expect(provider.calls[0].jsonSchemaMode).toBe('native');
    expect(provider.calls[1].jsonSchemaMode).toBe('prompt');
  });

  it('off: does not pass schema to provider', async () => {
    const provider = new SchemaSensitiveProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'off' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      validateOutput: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(1);
    expect(provider.calls[0].jsonSchema).toBeUndefined();
    expect(provider.calls[0].jsonSchemaMode).toBeUndefined();
  });
});
