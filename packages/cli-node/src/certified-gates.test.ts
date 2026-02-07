import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Provider, InvokeParams, InvokeResult, ExecutionPolicy } from './types.js';
import { loadModule } from './modules/loader.js';
import { runModule } from './modules/runner.js';
import { PROVENANCE_SPEC, computeModuleIntegrity, writeModuleProvenance } from './provenance.js';

const certifiedPolicy: ExecutionPolicy = {
  profile: 'certified',
  validate: 'on',
  audit: true,
  enableRepair: false,
  requireV22: true,
};

function makeTmpDir(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function writeV22Module(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'module.yaml'),
    [
      'name: demo',
      'version: 1.0.0',
      'responsibility: demo module',
      'tier: exec',
    ].join('\n') + '\n',
    'utf-8'
  );
  await fs.writeFile(path.join(dir, 'prompt.md'), '# Demo\n', 'utf-8');
  await fs.writeFile(
    path.join(dir, 'schema.json'),
    JSON.stringify(
      {
        input: { type: 'object', additionalProperties: true },
        data: { type: 'object', additionalProperties: true },
        meta: {
          type: 'object',
          additionalProperties: true,
          required: ['confidence', 'risk', 'explain'],
          properties: {
            confidence: { type: 'number' },
            risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
            explain: { type: 'string' },
          },
        },
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );
}

class NeverInvokeProvider implements Provider {
  name = 'never';
  async invoke(_params: InvokeParams): Promise<InvokeResult> {
    throw new Error('provider should not be invoked');
  }
}

class SimpleProvider implements Provider {
  name = 'simple';
  async invoke(_params: InvokeParams): Promise<InvokeResult> {
    return {
      content: JSON.stringify({
        ok: true,
        version: '2.2',
        meta: { confidence: 0.9, risk: 'low', explain: 'ok' },
        data: { hello: 'world', confidence: 0.9, rationale: 'ok' },
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  }
}

describe('certified policy gates', () => {
  it('refuses modules without provenance.json', async () => {
    const root = makeTmpDir('cog-cert-no-prov');
    try {
      await writeV22Module(root);
      const mod = await loadModule(root);
      const res = await runModule(mod, new NeverInvokeProvider(), { useV22: true, policy: certifiedPolicy });
      expect(res.ok).toBe(false);
      expect((res as any).error?.code).toBe('E4007');
      expect(String((res as any).error?.message)).toContain('provenance.json');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('runs when provenance + integrity are present', async () => {
    const root = makeTmpDir('cog-cert-ok');
    try {
      await writeV22Module(root);
      const integrity = await computeModuleIntegrity(root);
      await writeModuleProvenance(root, {
        spec: PROVENANCE_SPEC,
        createdAt: new Date().toISOString(),
        source: {
          type: 'registry',
          registryUrl: 'https://example.com/registry.json',
          moduleName: 'demo',
          requestedVersion: null,
          resolvedVersion: '1.0.0',
          tarballUrl: 'https://example.com/demo.tgz',
          checksum: 'sha256:' + 'a'.repeat(64),
          sha256: 'a'.repeat(64),
        },
        integrity,
      });

      const mod = await loadModule(root);
      const res = await runModule(mod, new SimpleProvider(), { useV22: true, policy: certifiedPolicy });
      expect(res.ok).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('detects tampering via integrity mismatch', async () => {
    const root = makeTmpDir('cog-cert-tamper');
    try {
      await writeV22Module(root);
      const integrity = await computeModuleIntegrity(root);
      await writeModuleProvenance(root, {
        spec: PROVENANCE_SPEC,
        createdAt: new Date().toISOString(),
        source: {
          type: 'registry',
          registryUrl: 'https://example.com/registry.json',
          moduleName: 'demo',
          requestedVersion: null,
          resolvedVersion: '1.0.0',
          tarballUrl: 'https://example.com/demo.tgz',
          checksum: 'sha256:' + 'b'.repeat(64),
          sha256: 'b'.repeat(64),
        },
        integrity,
      });

      // Tamper after provenance was written.
      await fs.appendFile(path.join(root, 'prompt.md'), 'tampered\n', 'utf-8');

      const mod = await loadModule(root);
      const res = await runModule(mod, new NeverInvokeProvider(), { useV22: true, policy: certifiedPolicy });
      expect(res.ok).toBe(false);
      expect((res as any).error?.code).toBe('E4007');
      expect(String((res as any).error?.message)).toContain('Integrity');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

