import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { coreNew, coreSchema, corePromote, coreRunText } from './core.js';
import { loadModule } from '../modules/loader.js';
import type { Provider } from '../types.js';

describe('cog core', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cog-core-'));
  });

  it('coreNew should create a one-file module template', async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const result = await coreNew('demo.md');
      expect(result.success).toBe(true);
      const filePath = path.join(tempDir, 'demo.md');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('name: demo');
      expect(content).toContain('tier: decision');
      expect(content).toContain('Return a valid v2.2 envelope with meta + data');
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('coreNew --dry-run should not write a file', async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(tempDir);
      const result = await coreNew('demo.md', { dryRun: true });
      expect(result.success).toBe(true);
      await expect(fs.readFile(path.join(tempDir, 'demo.md'), 'utf-8')).rejects.toBeTruthy();
      expect((result.data as { preview?: string }).preview).toContain('Return a valid v2.2 envelope with meta + data');
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('coreSchema should return generated schemas for a one-file module', async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await coreNew('demo.md');
      const result = await coreSchema('demo.md');
      expect(result.success).toBe(true);
      const data = result.data as { schema: { meta: unknown; input: unknown; data: unknown; error: unknown } };
      expect(data.schema).toBeTruthy();
      expect(data.schema.meta).toBeTruthy();
      expect(data.schema.input).toBeTruthy();
      expect(data.schema.data).toBeTruthy();
      expect(data.schema.error).toBeTruthy();
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('corePromote should create a v2 module directory that the loader can read', async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await coreNew('demo.md');

      const promoteResult = await corePromote('demo.md');
      expect(promoteResult.success).toBe(true);
      const to = (promoteResult.data as { to: string }).to;
      const moduleYaml = await fs.readFile(path.join(to, 'module.yaml'), 'utf-8');
      const promptMd = await fs.readFile(path.join(to, 'prompt.md'), 'utf-8');
      const schemaJson = await fs.readFile(path.join(to, 'schema.json'), 'utf-8');
      expect(moduleYaml).toContain('name: demo');
      expect(promptMd).toContain('Return a valid v2.2 envelope with meta + data');
      expect(schemaJson).toContain('"meta"');

      const loaded = await loadModule(to);
      expect(loaded.name).toBe('demo');
      expect(loaded.formatVersion).toBe('v2.2');
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('corePromote --force should overwrite an existing target directory', async () => {
    const prevCwd = process.cwd();
    try {
      process.chdir(tempDir);
      await coreNew('demo.md');

      const first = await corePromote('demo.md');
      expect(first.success).toBe(true);
      const to = (first.data as { to: string }).to;

      const second = await corePromote('demo.md', to, { force: true });
      expect(second.success).toBe(true);
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('coreRunText should execute an ad-hoc module from text (stdin path)', async () => {
    const provider: Provider = {
      name: 'core-test',
      isConfigured: () => true,
      supportsStreaming: () => false,
      invoke: async () => ({
        content: JSON.stringify({
          ok: true,
          meta: { confidence: 0.9, risk: 'low', explain: 'ok' },
          data: { rationale: 'because', result: 'hello' },
        }),
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    };

    const result = await coreRunText('Return a valid v2.2 envelope.', {
      cwd: tempDir,
      provider,
      verbose: false,
    }, { args: 'hello', pretty: false });

    expect(result.success).toBe(true);
    const data = result.data as { ok?: boolean };
    expect(data.ok).toBe(true);
  });
});
