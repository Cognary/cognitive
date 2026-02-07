import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { coreNew, coreSchema } from './core.js';

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
      expect(content).toContain('Return a valid v2.2 envelope JSON');
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
      expect((result.data as { preview?: string }).preview).toContain('Return a valid v2.2 envelope JSON');
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
});

