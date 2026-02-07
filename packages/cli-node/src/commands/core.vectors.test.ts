import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { coreNew, coreSchema, corePromote } from './core.js';
import { loadModule } from '../modules/loader.js';

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../../');
}

async function readText(p: string): Promise<string> {
  const s = await fs.readFile(p, 'utf-8');
  return s.replace(/\r\n/g, '\n');
}

function normalizeText(s: string): string {
  // Conformance vectors should be stable across editors/OSes.
  // We enforce: normalized newlines and exactly one trailing newline.
  return s.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

describe('core conformance vectors', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cog-core-vectors-'));
  });

  it('core new/schema/promote match spec/core-vectors', async () => {
    const prevCwd = process.cwd();
    const root = repoRootFromHere();
    const vectors = path.join(root, 'spec', 'core-vectors');
    try {
      process.chdir(tempDir);

      // 1) core new
      const newRes = await coreNew('demo.md');
      expect(newRes.success).toBe(true);

      const demoActual = await readText(path.join(tempDir, 'demo.md'));
      const demoExpected = await readText(path.join(vectors, 'demo.md'));
      expect(normalizeText(demoActual)).toBe(normalizeText(demoExpected));

      // 2) core schema
      const schemaRes = await coreSchema('demo.md');
      expect(schemaRes.success).toBe(true);
      const schemaActual = (schemaRes.data as any).schema;
      const schemaExpected = JSON.parse(await readText(path.join(vectors, 'schema.json')));
      expect(schemaActual).toEqual(schemaExpected);

      // 3) core promote
      const promoteRes = await corePromote('demo.md');
      expect(promoteRes.success).toBe(true);
      const to = (promoteRes.data as any).to as string;

      const moduleYamlActual = await readText(path.join(to, 'module.yaml'));
      const promptMdActual = await readText(path.join(to, 'prompt.md'));
      const schemaJsonActual = JSON.parse(await readText(path.join(to, 'schema.json')));
      const smokeInputActual = JSON.parse(await readText(path.join(to, 'tests', 'smoke.input.json')));
      const smokeExpectedActual = JSON.parse(await readText(path.join(to, 'tests', 'smoke.expected.json')));

      const moduleYamlExpected = await readText(path.join(vectors, 'promoted', 'module.yaml'));
      const promptMdExpected = await readText(path.join(vectors, 'promoted', 'prompt.md'));
      const schemaJsonExpected = JSON.parse(await readText(path.join(vectors, 'promoted', 'schema.json')));
      const smokeInputExpected = JSON.parse(await readText(path.join(vectors, 'promoted', 'tests', 'smoke.input.json')));
      const smokeExpectedExpected = JSON.parse(await readText(path.join(vectors, 'promoted', 'tests', 'smoke.expected.json')));

      expect(normalizeText(moduleYamlActual)).toBe(normalizeText(moduleYamlExpected));
      expect(normalizeText(promptMdActual)).toBe(normalizeText(promptMdExpected));
      expect(schemaJsonActual).toEqual(schemaJsonExpected);
      expect(smokeInputActual).toEqual(smokeInputExpected);
      expect(smokeExpectedActual).toEqual(smokeExpectedExpected);

      // Ensure the promoted module remains loadable by the v2 loader.
      const loaded = await loadModule(to);
      expect(loaded.name).toBe('demo');
      expect(loaded.formatVersion).toBe('v2.2');
    } finally {
      process.chdir(prevCwd);
    }
  });
});
