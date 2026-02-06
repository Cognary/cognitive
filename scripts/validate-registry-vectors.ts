#!/usr/bin/env node
/**
 * CEP Registry Vector Validator (TypeScript)
 *
 * Validates registry index vectors against registry.schema.json and
 * validates each module entry against registry-entry.schema.json.
 *
 * Usage:
 *   tsx scripts/validate-registry-vectors.ts --level 3 --verbose
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface TestMeta {
  name: string;
  description?: string;
  expects: 'accept' | 'reject';
  conformance_level: number;
  error_codes?: string[];
}

interface RegistryVector {
  $test: TestMeta;
  registry: Record<string, unknown>;
}

function findJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

function main() {
  const argv = process.argv.slice(2);
  let level = 3;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--level' || argv[i] === '-l') level = parseInt(argv[++i] ?? '3', 10);
    else if (argv[i] === '--verbose' || argv[i] === '-v') verbose = true;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..');
  const specDir = path.join(repoRoot, 'spec');
  const vectorsDir = path.join(specDir, 'registry-vectors');

  const registrySchemaPath = path.join(specDir, 'registry.schema.json');
  const entrySchemaPath = path.join(specDir, 'registry-entry.schema.json');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const registrySchema = JSON.parse(fs.readFileSync(registrySchemaPath, 'utf8'));
  const entrySchema = JSON.parse(fs.readFileSync(entrySchemaPath, 'utf8'));

  // The registry schema references "registry-entry.schema.json" via a relative $ref.
  // Add aliases so Ajv resolves without network access.
  // Canonical entry schema id is registry-entry-v1.json.
  ajv.addSchema(entrySchema, 'https://cognitive-modules.dev/schema/registry-entry-v1.json');
  // Back-compat alias for any older refs.
  ajv.addSchema(entrySchema, 'registry-entry.schema.json');
  ajv.addSchema(entrySchema, 'https://cognitive-modules.dev/schema/registry-entry.schema.json');

  const validateRegistry = ajv.compile(registrySchema);
  const validateEntry = ajv.compile(entrySchema);

  const files = fs.existsSync(vectorsDir) ? findJsonFiles(vectorsDir) : [];

  let passed = 0;
  let failed = 0;

  // Also validate the repo's published registry file (if present).
  const publishedRegistryPath = path.join(repoRoot, 'cognitive-registry.v2.json');
  if (fs.existsSync(publishedRegistryPath)) {
    files.unshift(publishedRegistryPath);
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as any;

    // Two modes:
    // - vector file: { $test, registry }
    // - published registry file: raw registry object
    const isVector = parsed && typeof parsed === 'object' && '$test' in parsed && 'registry' in parsed;
    const vector = (isVector ? (parsed as RegistryVector) : null);
    const meta = (vector?.$test ?? ({ name: path.basename(file), expects: 'accept', conformance_level: 1 } as TestMeta));
    const expects = meta.expects ?? 'accept';
    const vecLevel = meta.conformance_level ?? 1;

    if (vecLevel > level) continue;

    let ok = true;
    let errMsg = '';

    try {
      const registryObj = isVector ? vector!.registry : parsed;
      if (!registryObj || typeof registryObj !== 'object') {
        throw new Error('registry must be an object');
      }

      const validReg = validateRegistry(registryObj);
      if (!validReg) {
        const msg = (validateRegistry.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ');
        throw new Error(`registry invalid: ${msg}`);
      }

      // Also validate each entry explicitly for clearer errors.
      const modules = (registryObj as { modules?: Record<string, unknown> }).modules ?? {};
      if (typeof modules !== 'object' || Array.isArray(modules)) {
        throw new Error('registry.modules must be an object map');
      }
      for (const [name, entry] of Object.entries(modules)) {
        const validEnt = validateEntry(entry);
        if (!validEnt) {
          const msg = (validateEntry.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ');
          throw new Error(`entry '${name}' invalid: ${msg}`);
        }
      }
    } catch (e) {
      ok = false;
      errMsg = e instanceof Error ? e.message : String(e);
    }

    const passedThis = expects === 'accept' ? ok : !ok;
    if (passedThis) passed++;
    else failed++;

    if (verbose && !passedThis) {
      // eslint-disable-next-line no-console
      console.error(`FAIL: ${meta.name ?? path.basename(file)} (${expects}) -> ${errMsg}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`CEP Registry Vectors: ${passed}/${passed + failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
