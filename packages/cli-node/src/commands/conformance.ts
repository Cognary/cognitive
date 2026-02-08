/**
 * Conformance Command
 *
 * Goal: make "official vectors" runnable as a stable contract surface.
 * This is intentionally offline and deterministic: it validates static vectors
 * against the JSON Schemas in `spec/`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import _Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
const Ajv = _Ajv.default || _Ajv;
import _addFormats from 'ajv-formats';
const addFormats = (_addFormats as any).default || _addFormats;
import type { CommandContext, CommandResult } from '../types.js';

type ConformanceLevel = 1 | 2 | 3;
type ConformanceSuite = 'envelope' | 'stream' | 'registry' | 'all';

export type ConformanceFailurePhase =
  | 'read'
  | 'parse'
  | 'schema'
  | 'entry'
  | 'event'
  | 'end.result';

export type ConformanceVectorResult = {
  file: string;
  name: string;
  expects: 'accept' | 'reject';
  level: number;
  passed: boolean;
  isValid: boolean;
  phase?: ConformanceFailurePhase;
  error?: string;
};

export type ConformanceRunResult = {
  spec_dir: string;
  suite: ConformanceSuite;
  level: ConformanceLevel;
  total: number;
  passed: number;
  failed: number;
  results: ConformanceVectorResult[];
};

export type ConformanceOptions = {
  specDir?: string;
  suite?: ConformanceSuite;
  level?: number;
  verbose?: boolean;
  json?: boolean;
};

function findJsonFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

function detectSpecDir(startCwd: string): string | null {
  // Search upward for `<root>/spec/response-envelope.schema.json`.
  let cur = startCwd;
  for (let i = 0; i < 20; i++) {
    const specDir = path.join(cur, 'spec');
    const schema = path.join(specDir, 'response-envelope.schema.json');
    if (fs.existsSync(schema)) return specDir;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function normalizeSpecDir(specDirRaw: string): string {
  const p = path.resolve(specDirRaw);
  // Accept either `<root>/spec` or `<root>` (and normalize to `<root>/spec`).
  if (path.basename(p) !== 'spec') {
    const candidate = path.join(p, 'spec');
    if (fs.existsSync(path.join(candidate, 'response-envelope.schema.json'))) return candidate;
  }
  return p;
}

function readJson(p: string): unknown {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function relFromSpec(specDir: string, file: string): string {
  // Prefer paths like `spec/test-vectors/...` instead of absolute paths.
  const root = path.dirname(specDir);
  return path.relative(root, file);
}

function clampLevel(n: number | undefined): ConformanceLevel {
  const v = Number(n ?? 1);
  if (v === 1 || v === 2 || v === 3) return v;
  throw new Error(`Invalid conformance level: ${String(n)} (expected 1|2|3)`);
}

function clampSuite(s: string | undefined): ConformanceSuite {
  const v = (s ?? 'envelope').trim();
  if (v === 'envelope' || v === 'stream' || v === 'registry' || v === 'all') return v;
  throw new Error(`Invalid --suite: ${v} (expected envelope|stream|registry|all)`);
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  const list = errors ?? [];
  return list.map(e => `${e.instancePath ?? ''} ${e.message ?? ''}`.trim()).join('; ');
}

function validateEnvelopeVectors(specDir: string, level: ConformanceLevel): ConformanceVectorResult[] {
  const schemaPath = path.join(specDir, 'response-envelope.schema.json');
  const vectorsDir = path.join(specDir, 'test-vectors');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = readJson(schemaPath) as any;
  const validate = ajv.compile(schema);

  const files = fs.existsSync(vectorsDir) ? findJsonFiles(vectorsDir) : [];
  const results: ConformanceVectorResult[] = [];

  for (const file of files) {
    let meta: any;
    let envelope: any;
    try {
      const parsed = readJson(file) as any;
      meta = parsed?.$test ?? {};
      envelope = parsed?.envelope ?? {};
    } catch (e) {
      results.push({
        file: relFromSpec(specDir, file),
        name: path.basename(file),
        expects: 'reject',
        level: 1,
        passed: false,
        isValid: false,
        phase: 'parse',
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const vecLevel = Number(meta?.conformance_level ?? 1);
    if (vecLevel > level) continue;

    const expects = (meta?.expects ?? 'accept') as 'accept' | 'reject';
    const name = (meta?.name ?? path.basename(file, '.json')) as string;

    const valid = Boolean(validate(envelope));
    const error = valid ? undefined : formatAjvErrors(validate.errors);
    const passed = expects === 'accept' ? valid : !valid;

    results.push({
      file: relFromSpec(specDir, file),
      name,
      expects,
      level: vecLevel,
      passed,
      isValid: valid,
      phase: valid ? undefined : 'schema',
      error,
    });
  }

  return results;
}

function validateStreamVectors(specDir: string, level: ConformanceLevel): ConformanceVectorResult[] {
  const eventsSchemaPath = path.join(specDir, 'stream-events.schema.json');
  const envelopeSchemaPath = path.join(specDir, 'response-envelope.schema.json');
  const vectorsDir = path.join(specDir, 'stream-vectors');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const eventsSchema = readJson(eventsSchemaPath) as any;
  const envelopeSchema = readJson(envelopeSchemaPath) as any;
  const validateEvent = ajv.compile(eventsSchema);
  const validateEnvelope = ajv.compile(envelopeSchema);

  const files = fs.existsSync(vectorsDir) ? findJsonFiles(vectorsDir) : [];
  const results: ConformanceVectorResult[] = [];

  for (const file of files) {
    let vector: any;
    try {
      vector = readJson(file) as any;
    } catch (e) {
      results.push({
        file: relFromSpec(specDir, file),
        name: path.basename(file),
        expects: 'reject',
        level: 1,
        passed: false,
        isValid: false,
        phase: 'parse',
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const meta = vector?.$test ?? {};
    const expects = (meta?.expects ?? 'accept') as 'accept' | 'reject';
    const vecLevel = Number(meta?.conformance_level ?? 1);
    if (vecLevel > level) continue;
    const name = (meta?.name ?? path.basename(file, '.json')) as string;

    let ok = true;
    let err = '';
    let phase: ConformanceFailurePhase | undefined;

    try {
      if (!Array.isArray(vector?.events)) {
        throw new Error('events must be an array');
      }
      for (const ev of vector.events as Array<Record<string, unknown>>) {
        if (!validateEvent(ev)) {
          phase = 'event';
          throw new Error(`event invalid: ${formatAjvErrors(validateEvent.errors)}`);
        }
        const evAny = ev as any;
        if (evAny?.type === 'end') {
          const env = evAny?.result;
          if (!validateEnvelope(env)) {
            phase = 'end.result';
            throw new Error(`end.result invalid envelope: ${formatAjvErrors(validateEnvelope.errors)}`);
          }
        }
      }
    } catch (e) {
      ok = false;
      err = e instanceof Error ? e.message : String(e);
    }

    const passed = expects === 'accept' ? ok : !ok;
    results.push({
      file: relFromSpec(specDir, file),
      name,
      expects,
      level: vecLevel,
      passed,
      isValid: ok,
      phase: ok ? undefined : (phase ?? 'schema'),
      error: ok ? undefined : err,
    });
  }

  return results;
}

function validateRegistryVectors(specDir: string, level: ConformanceLevel): ConformanceVectorResult[] {
  const registrySchemaPath = path.join(specDir, 'registry.schema.json');
  const entrySchemaPath = path.join(specDir, 'registry-entry.schema.json');
  const vectorsDir = path.join(specDir, 'registry-vectors');
  const repoRoot = path.dirname(specDir);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const registrySchema = readJson(registrySchemaPath) as any;
  const entrySchema = readJson(entrySchemaPath) as any;

  // The registry schema references the entry schema via $ref. Add aliases so Ajv resolves offline.
  ajv.addSchema(entrySchema, 'https://cognitive-modules.dev/schema/registry-entry-v1.json');
  ajv.addSchema(entrySchema, 'registry-entry.schema.json');
  ajv.addSchema(entrySchema, 'https://cognitive-modules.dev/schema/registry-entry.schema.json');

  const validateRegistry = ajv.compile(registrySchema);
  const validateEntry = ajv.compile(entrySchema);

  const files = fs.existsSync(vectorsDir) ? findJsonFiles(vectorsDir) : [];

  // Also validate the repo's published registry file (if present).
  const publishedRegistryPath = path.join(repoRoot, 'cognitive-registry.v2.json');
  if (fs.existsSync(publishedRegistryPath)) files.unshift(publishedRegistryPath);

  const results: ConformanceVectorResult[] = [];

  for (const file of files) {
    let parsed: any;
    try {
      parsed = readJson(file) as any;
    } catch (e) {
      results.push({
        file: relFromSpec(specDir, file),
        name: path.basename(file),
        expects: 'reject',
        level: 1,
        passed: false,
        isValid: false,
        phase: 'parse',
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const isVector = parsed && typeof parsed === 'object' && '$test' in parsed && 'registry' in parsed;
    const meta = (isVector ? parsed.$test : null) ?? { name: path.basename(file), expects: 'accept', conformance_level: 1 };
    const expects = (meta?.expects ?? 'accept') as 'accept' | 'reject';
    const vecLevel = Number(meta?.conformance_level ?? 1);
    if (vecLevel > level) continue;
    const name = (meta?.name ?? path.basename(file, '.json')) as string;

    let ok = true;
    let err = '';
    let phase: ConformanceFailurePhase | undefined;

    try {
      const registryObj = isVector ? parsed.registry : parsed;
      if (!registryObj || typeof registryObj !== 'object') throw new Error('registry must be an object');

      if (!validateRegistry(registryObj)) {
        phase = 'schema';
        throw new Error(`registry invalid: ${formatAjvErrors(validateRegistry.errors)}`);
      }

      const modules = (registryObj as { modules?: Record<string, unknown> }).modules ?? {};
      if (typeof modules !== 'object' || Array.isArray(modules)) {
        phase = 'schema';
        throw new Error('registry.modules must be an object map');
      }

      for (const [modName, entry] of Object.entries(modules)) {
        if (!validateEntry(entry)) {
          phase = 'entry';
          throw new Error(`entry '${modName}' invalid: ${formatAjvErrors(validateEntry.errors)}`);
        }
      }
    } catch (e) {
      ok = false;
      err = e instanceof Error ? e.message : String(e);
    }

    const passed = expects === 'accept' ? ok : !ok;
    results.push({
      file: relFromSpec(specDir, file),
      name,
      expects,
      level: vecLevel,
      passed,
      isValid: ok,
      phase: ok ? undefined : (phase ?? 'schema'),
      error: ok ? undefined : err,
    });
  }

  return results;
}

export async function conformance(ctx: CommandContext, options: ConformanceOptions = {}): Promise<CommandResult> {
  const suite = clampSuite(options.suite);
  const level = clampLevel(options.level);

  const specDir =
    options.specDir ? normalizeSpecDir(options.specDir) : (detectSpecDir(ctx.cwd) ?? '');

  if (!specDir) {
    return {
      success: false,
      error: 'Spec directory not found. Run from a repo checkout or pass --spec-dir <path-to-repo-or-spec>.',
    };
  }

  const envelopeSchema = path.join(specDir, 'response-envelope.schema.json');
  if (!fs.existsSync(envelopeSchema)) {
    return {
      success: false,
      error: `Spec directory is missing response-envelope.schema.json: ${specDir}`,
    };
  }

  let results: ConformanceVectorResult[] = [];
  try {
    if (suite === 'envelope' || suite === 'all') {
      results = results.concat(validateEnvelopeVectors(specDir, level));
    }
    if (suite === 'stream' || suite === 'all') {
      results = results.concat(validateStreamVectors(specDir, level));
    }
    if (suite === 'registry' || suite === 'all') {
      results = results.concat(validateRegistryVectors(specDir, level));
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  const data: ConformanceRunResult = {
    spec_dir: specDir,
    suite,
    level,
    total: results.length,
    passed,
    failed,
    results,
  };

  if (options.verbose && failed > 0) {
    for (const r of results) {
      if (r.passed) continue;
      // eslint-disable-next-line no-console
      console.error(`FAIL [${r.phase ?? 'unknown'}] ${r.file}: ${r.error ?? 'invalid'}`);
    }
  }

  return {
    success: failed === 0,
    data,
    error: failed === 0 ? undefined : `${failed} conformance vector(s) failed`,
  };
}
