import { describe, it, expect } from 'vitest';
import type { CognitiveModule, ExecutionPolicy, InvokeParams, InvokeResult, Provider } from '../types.js';
import { runModule, runModuleStream } from './runner.js';

function makePolicy(overrides: Partial<ExecutionPolicy> = {}): ExecutionPolicy {
  return {
    profile: 'standard',
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
  it('auto(validate=auto): tier=exploration disables provider schema hints but keeps post-hoc output validation', async () => {
    const provider = new SchemaSensitiveProvider();
    const module = makeModule();
    module.tier = 'exploration';
    const policy = makePolicy({ validate: 'auto', structured: 'auto' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(1);
    expect(provider.calls[0].jsonSchema).toBeUndefined();
    expect(provider.calls[0].jsonSchemaMode).toBeUndefined();

    const metaPolicy = (res as any).meta?.policy;
    expect(metaPolicy?.structured?.resolved).toBe('off');
    expect(metaPolicy?.structured?.planned).toBe('off');
    expect(metaPolicy?.structured?.applied).toBe('off');
    expect(metaPolicy?.structured?.downgraded).toBe(false);
    expect(metaPolicy?.structured?.fallback?.attempted).toBe(false);
    expect(metaPolicy?.validation?.output).toBe(true);
    expect(metaPolicy?.validation?.input).toBe(false);
  });

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

    const metaPolicy = (res as any).meta?.policy;
    expect(metaPolicy?.structured?.resolved).toBe('native');
    expect(metaPolicy?.structured?.applied).toBe('prompt');
    expect(metaPolicy?.structured?.downgraded).toBe(true);
    expect(metaPolicy?.structured?.fallback?.attempted).toBe(true);
    expect(String(metaPolicy?.structured?.fallback?.reason ?? '')).toContain('Invalid JSON payload');
  });

  it('native: still falls back native -> prompt on schema compatibility error (UX over fail-fast)', async () => {
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

    const metaPolicy = (res as any).meta?.policy;
    expect(metaPolicy?.structured?.resolved).toBe('native');
    expect(metaPolicy?.structured?.applied).toBe('prompt');
    expect(metaPolicy?.structured?.downgraded).toBe(true);
    expect(metaPolicy?.structured?.fallback?.attempted).toBe(true);
  });

  it('native: downgrades to prompt when provider native dialect is not JSON Schema', async () => {
    class NonJsonDialectProvider extends SchemaSensitiveProvider {
      getCapabilities() {
        return { structuredOutput: 'native' as const, streaming: false, nativeSchemaDialect: 'gemini-responseSchema' as const };
      }
      async invoke(params: InvokeParams): Promise<InvokeResult> {
        this.calls.push(params);
        // When the user explicitly requests structured=native, the runner should still attempt the
        // provider-native dialect and rely on the compatibility retry (native -> prompt) for UX.
        expect(params.jsonSchemaMode).toBe('native');
        return {
          content: JSON.stringify({
            ok: true,
            meta: { confidence: 1, risk: 'none', explain: 'ok' },
            data: { rationale: 'r', result: 'x' },
          }),
        };
      }
    }

    const provider = new NonJsonDialectProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'native' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      validateOutput: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(1);
    expect(provider.calls[0].jsonSchemaMode).toBe('native');
  });

  it('auto: downgrades native -> prompt when schema exceeds maxNativeSchemaBytes', async () => {
    class SmallCapProvider extends SchemaSensitiveProvider {
      getCapabilities() {
        return { structuredOutput: 'native' as const, streaming: false, nativeSchemaDialect: 'json-schema' as const, maxNativeSchemaBytes: 10 };
      }
      async invoke(params: InvokeParams): Promise<InvokeResult> {
        this.calls.push(params);
        expect(params.jsonSchemaMode).toBe('prompt');
        return {
          content: JSON.stringify({
            ok: true,
            meta: { confidence: 1, risk: 'none', explain: 'ok' },
            data: { rationale: 'r', result: 'x' },
          }),
        };
      }
    }

    const provider = new SmallCapProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'auto' });

    const res = await runModule(module, provider, {
      args: 'hello',
      useV22: true,
      validateOutput: true,
      policy,
    });

    expect(res.ok).toBe(true);
    expect(provider.calls.length).toBe(1);
    expect(provider.calls[0].jsonSchemaMode).toBe('prompt');
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

  it('streaming: falls back native -> prompt on schema compatibility error and records applied mode', async () => {
    class StreamSchemaSensitiveProvider extends SchemaSensitiveProvider {
      supportsStreaming() {
        return true;
      }
      getCapabilities() {
        return { structuredOutput: 'native' as const, streaming: true };
      }
      async *invokeStream(params: InvokeParams): AsyncGenerator<string, InvokeResult> {
        this.calls.push(params);
        if (params.jsonSchemaMode === 'native') {
          throw new Error(
            'Gemini API error: 400 - Invalid JSON payload received. Unknown name "const" at generation_config.response_schema'
          );
        }
        // For prompt mode, emit one delta and return a final JSON envelope.
        yield '{"ok": true,';
        return {
          content: JSON.stringify({
            ok: true,
            meta: { confidence: 1, risk: 'none', explain: 'ok' },
            data: { rationale: 'r', result: 'x' },
          }),
        };
      }
    }

    const provider = new StreamSchemaSensitiveProvider();
    const module = makeModule();
    const policy = makePolicy({ structured: 'auto' });

    let final: any = null;
    for await (const ev of runModuleStream(module, provider, { args: 'hello', useV22: true, validateOutput: true, policy })) {
      if (ev.type === 'end') final = ev.result;
    }

    expect(final?.ok).toBe(true);
    expect(provider.calls.length).toBe(2);
    expect(provider.calls[0].jsonSchemaMode).toBe('native');
    expect(provider.calls[1].jsonSchemaMode).toBe('prompt');

    const metaPolicy = final?.meta?.policy;
    expect(metaPolicy?.structured?.resolved).toBe('native');
    expect(metaPolicy?.structured?.applied).toBe('prompt');
    expect(metaPolicy?.structured?.downgraded).toBe(true);
    expect(metaPolicy?.structured?.fallback?.attempted).toBe(true);
  });
});
