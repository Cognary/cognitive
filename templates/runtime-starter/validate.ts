import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type CliArgs = {
  specDir: string;
  verbose: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let specDir = '';
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verbose' || a === '-v') {
      verbose = true;
      continue;
    }
    if (a === '--spec-dir') {
      specDir = argv[i + 1] ?? '';
      i++;
      continue;
    }
  }

  const candidates = [
    specDir ? path.resolve(specDir) : '',
    path.resolve(process.cwd(), 'spec'),
    path.resolve(process.cwd(), '..', 'spec'),
    path.resolve(process.cwd(), '..', '..', 'spec'),
  ].filter(Boolean);

  const resolved = candidates.find((p) => fs.existsSync(path.join(p, 'response-envelope.schema.json')));
  if (!resolved) {
    const tried = candidates.map((p) => `- ${p}`).join('\n');
    throw new Error(
      `Could not find spec directory (missing response-envelope.schema.json).\nTried:\n${tried}\n\n` +
        `Fix: copy the repo's spec folder next to this starter:\n` +
        `  cp -r ../spec ./spec\n` +
        `Or pass --spec-dir /path/to/spec`
    );
  }

  return { specDir: resolved, verbose };
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .sort();
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const { specDir, verbose } = parseArgs(process.argv.slice(2));

  const schemaPath = path.join(specDir, 'response-envelope.schema.json');
  const validDir = path.join(specDir, 'test-vectors', 'valid');
  const invalidDir = path.join(specDir, 'test-vectors', 'invalid');

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schema = readJson(schemaPath) as any;
  const validate = ajv.compile(schema);

  const validFiles = listJsonFiles(validDir);
  const invalidFiles = listJsonFiles(invalidDir);

  if (!validFiles.length && !invalidFiles.length) {
    throw new Error(`No test vectors found under: ${path.join(specDir, 'test-vectors')}`);
  }

  let failures = 0;

  for (const f of validFiles) {
    const data = readJson(f);
    const ok = validate(data);
    if (!ok) {
      failures++;
      console.error(`[FAIL][valid] ${path.basename(f)}`);
      if (verbose) console.error(validate.errors);
    } else if (verbose) {
      console.log(`[OK][valid] ${path.basename(f)}`);
    }
  }

  for (const f of invalidFiles) {
    const data = readJson(f);
    const ok = validate(data);
    if (ok) {
      failures++;
      console.error(`[FAIL][invalid] ${path.basename(f)} (unexpectedly passed)`);
    } else if (verbose) {
      console.log(`[OK][invalid] ${path.basename(f)} (rejected as expected)`);
    }
  }

  if (failures > 0) {
    throw new Error(`Conformance check failed: ${failures} vector(s) mismatched.`);
  }

  console.log(`Conformance check OK: ${validFiles.length} valid + ${invalidFiles.length} invalid vectors.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

