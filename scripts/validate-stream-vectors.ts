#!/usr/bin/env node
/**
 * CEP Stream Vector Validator (TypeScript)
 *
 * Validates streaming event sequences against stream-events.schema.json
 * and validates terminal end.result envelopes against response-envelope.schema.json.
 *
 * Usage:
 *   node scripts/validate-stream-vectors.ts --level 3 --verbose
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

interface StreamVector {
  $test: TestMeta;
  events: Array<Record<string, unknown>>;
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
  const vectorsDir = path.join(specDir, 'stream-vectors');

  const eventsSchemaPath = path.join(specDir, 'stream-events.schema.json');
  const envelopeSchemaPath = path.join(specDir, 'response-envelope.schema.json');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const eventsSchema = JSON.parse(fs.readFileSync(eventsSchemaPath, 'utf8'));
  const envelopeSchema = JSON.parse(fs.readFileSync(envelopeSchemaPath, 'utf8'));

  const validateEvent = ajv.compile(eventsSchema);
  const validateEnvelope = ajv.compile(envelopeSchema);

  const files = findJsonFiles(vectorsDir);

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const vector = JSON.parse(raw) as StreamVector;
    const meta = vector.$test ?? ({} as TestMeta);
    const expects = meta.expects ?? 'accept';
    const vecLevel = meta.conformance_level ?? 1;

    if (vecLevel > level) continue;

    let ok = true;
    let errMsg = '';

    try {
      if (!Array.isArray(vector.events)) {
        throw new Error('events must be an array');
      }
      for (const ev of vector.events) {
        const validEv = validateEvent(ev);
        if (!validEv) {
          const msg = (validateEvent.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ');
          throw new Error(`event invalid: ${msg}`);
        }
        if (ev.type === 'end') {
          const env = (ev as { result?: unknown }).result;
          const validEnv = validateEnvelope(env);
          if (!validEnv) {
            const msg = (validateEnvelope.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ');
            throw new Error(`end.result invalid envelope: ${msg}`);
          }
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
  console.log(`CEP Stream Vectors: ${passed}/${passed + failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
