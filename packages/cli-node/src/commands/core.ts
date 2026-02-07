/**
 * cog core - Minimal "one-file" Core workflow
 *
 * Goals:
 * - A single Markdown file can be a runnable module (optional frontmatter + prompt body)
 * - Runtime generates loose schemas and always returns a v2.2 envelope on execution
 * - No registry / conformance / certification required to get started
 */

import type { CommandContext, CommandResult } from '../types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import yaml from 'js-yaml';
import { loadSingleFileModule } from '../modules/loader.js';
import { run } from './run.js';

export interface CoreOptions {
  args?: string;
  input?: string;
  noValidate?: boolean;
  pretty?: boolean;
  verbose?: boolean;
  stream?: boolean;
  dryRun?: boolean;
  stdin?: boolean;
  force?: boolean;
}

function ensureMdPath(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return p;
  return `${p}.md`;
}

function toSafeName(base: string): string {
  // Keep it predictable and filesystem-friendly.
  const s = base.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '-');
  const collapsed = s.replace(/-+/g, '-').replace(/^\-+|\-+$/g, '');
  return collapsed.length > 0 ? collapsed : 'core-module';
}

function coreTemplate(name: string): string {
  return [
    '---',
    `name: ${name}`,
    'version: 0.1.0',
    'responsibility: "One-file core module (5-minute path)"',
    'tier: decision',
    'schema_strictness: low',
    'excludes:',
    '  - do not make network calls',
    '  - do not write files',
    '---',
    '',
    'You are a Cognitive Module. Return JSON only (no markdown).',
    'Return a valid v2.2 envelope with meta + data.',
    '',
    'INPUT (provided by runtime):',
    '- query: natural language input (when --args looks like text)',
    '- code: code input (when --args looks like code)',
    '',
    'You MUST treat missing fields as empty.',
    '',
    'INPUT VALUES:',
    'query:',
    '{{QUERY}}',
    '',
    'code:',
    '{{CODE}}',
    '',
    'Output (requirements):',
    '- ok: true',
    '- meta.confidence: 0-1',
    "- meta.risk: one of 'none' | 'low' | 'medium' | 'high' (or extensible enum when allowed)",
    '- meta.explain: <=280 chars',
    '- data.rationale: string (long-form explanation for auditing)',
    '- data: your structured fields (plus data.rationale)',
    '',
    'Minimal example (shape only):',
    '{ "ok": true, "meta": { "confidence": 0.8, "risk": "low", "explain": "..." }, "data": { "rationale": "...", "result": "..." } }',
    '',
  ].join('\n');
}

function defaultErrorSchema(): object {
  return {
    type: 'object',
    additionalProperties: true,
    required: ['code', 'message'],
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      recoverable: { type: 'boolean' },
    },
  };
}

export async function coreNew(
  filePath: string,
  options: { dryRun?: boolean } = {}
): Promise<CommandResult> {
  const abs = path.resolve(process.cwd(), ensureMdPath(filePath));
  const name = toSafeName(path.basename(abs, path.extname(abs)));
  const content = coreTemplate(name);

  if (options.dryRun) {
    return {
      success: true,
      data: {
        message: `Dry run: would create ${abs}`,
        location: abs,
        preview: content,
      },
    };
  }

  try {
    await fs.stat(abs);
    return { success: false, error: `File already exists: ${abs}` };
  } catch {
    // ok
  }

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf-8');

  return {
    success: true,
    data: {
      message: `Created one-file module: ${abs}`,
      location: abs,
      hint: `Run: cog run ${abs} --args "hello" --pretty`,
    },
  };
}

export async function coreSchema(filePath: string): Promise<CommandResult> {
  const abs = path.resolve(process.cwd(), filePath);
  const mod = await loadSingleFileModule(abs);

  return {
    success: true,
    data: {
      name: mod.name,
      version: mod.version,
      location: mod.location,
      schema: {
        meta: mod.metaSchema ?? {},
        input: mod.inputSchema ?? {},
        data: mod.dataSchema ?? {},
        error: mod.errorSchema ?? defaultErrorSchema(),
      },
    },
  };
}

function defaultPromoteDir(moduleName: string): string {
  return path.resolve(process.cwd(), 'cognitive', 'modules', moduleName);
}

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(root + path.sep);
}

function schemaJsonForV22(mod: Awaited<ReturnType<typeof loadSingleFileModule>>): object {
  return {
    meta: mod.metaSchema ?? {},
    input: mod.inputSchema ?? {},
    data: mod.dataSchema ?? {},
    error: mod.errorSchema ?? defaultErrorSchema(),
  };
}

function moduleYamlForV22(mod: Awaited<ReturnType<typeof loadSingleFileModule>>): string {
  const manifest: Record<string, unknown> = {
    name: mod.name,
    version: mod.version,
    responsibility: mod.responsibility,
    tier: mod.tier ?? 'decision',
    excludes: mod.excludes ?? [],
    schema_strictness: mod.schemaStrictness ?? 'low',
    overflow: mod.overflow ?? undefined,
    enums: mod.enums ?? undefined,
    compat: mod.compat ?? undefined,
    meta: mod.metaConfig ?? undefined,
  };

  // Remove undefined keys for cleaner output.
  for (const k of Object.keys(manifest)) {
    if (manifest[k] === undefined) delete manifest[k];
  }

  return yaml.dump(manifest, { noRefs: true, lineWidth: 120 }).trimEnd() + '\n';
}

export async function corePromote(
  filePath: string,
  outDir?: string,
  options: { dryRun?: boolean; force?: boolean } = {}
): Promise<CommandResult> {
  const abs = path.resolve(process.cwd(), filePath);
  const mod = await loadSingleFileModule(abs);

  const targetDir = outDir ? path.resolve(process.cwd(), outDir) : defaultPromoteDir(mod.name);
  const cwd = process.cwd();
  // Promote is meant to generate a project-local v2 module directory. Refuse to write outside cwd
  // (and especially refuse `--force` deletes) to prevent footguns like `--force /`.
  if (!isPathWithinRoot(cwd, targetDir) || path.resolve(targetDir) === path.resolve(cwd)) {
    return { success: false, error: `Refusing to promote outside current directory: ${targetDir}` };
  }
  const moduleYamlPath = path.join(targetDir, 'module.yaml');
  const promptMdPath = path.join(targetDir, 'prompt.md');
  const schemaJsonPath = path.join(targetDir, 'schema.json');

  const moduleYaml = moduleYamlForV22(mod);
  const promptMd = (mod.prompt ?? '').trim() + '\n';
  const schemaJson = JSON.stringify(schemaJsonForV22(mod), null, 2) + '\n';

  const files = [moduleYamlPath, promptMdPath, schemaJsonPath];

  if (options.dryRun) {
    return {
      success: true,
      data: {
        message: `Dry run: would promote ${abs} to v2 module directory`,
        from: abs,
        to: targetDir,
        files,
        preview: {
          'module.yaml': moduleYaml,
          'prompt.md': promptMd,
          'schema.json': schemaJson,
        },
      },
    };
  }

  // Avoid overwriting an existing module directory silently.
  try {
    await fs.stat(targetDir);
    if (!options.force) {
      return { success: false, error: `Target directory already exists: ${targetDir} (use --force to overwrite)` };
    }
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {
    // ok
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(moduleYamlPath, moduleYaml, 'utf-8');
  await fs.writeFile(promptMdPath, promptMd, 'utf-8');
  await fs.writeFile(schemaJsonPath, schemaJson, 'utf-8');

  // Add minimal golden tests (schema validation mode) so `cog test <module>` works out of the box.
  const testsDir = path.join(targetDir, 'tests');
  await fs.mkdir(testsDir, { recursive: true });
  const inputPath = path.join(testsDir, 'smoke.input.json');
  const expectedPath = path.join(testsDir, 'smoke.expected.json');

  const smokeInput = {
    query: 'hello',
  };

  const smokeExpected = {
    $validate: {
      type: 'object',
      required: ['ok', 'meta', 'data'],
      properties: {
        ok: { const: true },
        meta: {
          type: 'object',
          required: ['confidence', 'risk', 'explain'],
          properties: {
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            risk: { type: 'string' },
            explain: { type: 'string', maxLength: 280 },
          },
        },
        data: {
          type: 'object',
          required: ['rationale'],
          properties: {
            rationale: { type: 'string' },
          },
        },
      },
    },
  };

  await fs.writeFile(inputPath, JSON.stringify(smokeInput, null, 2) + '\n', 'utf-8');
  await fs.writeFile(expectedPath, JSON.stringify(smokeExpected, null, 2) + '\n', 'utf-8');

  return {
    success: true,
    data: {
      message: `Promoted one-file module to v2 directory`,
      from: abs,
      to: targetDir,
      files: [...files, inputPath, expectedPath],
      hint: `Run: cog run ${mod.name} --args "hello" --pretty`,
    },
  };
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
    // Ensure flow mode.
    if (typeof (stream as unknown as { resume?: () => void }).resume === 'function') {
      (stream as unknown as { resume: () => void }).resume();
    }
  });
}

export async function coreRunText(
  markdownOrPrompt: string,
  ctx: CommandContext,
  options: CoreOptions = {}
): Promise<CommandResult> {
  const raw = markdownOrPrompt.trim();
  const content = raw.startsWith('---') ? raw + '\n' : (coreTemplate('stdin-core') + '\n' + raw + '\n');

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cog-core-stdin-'));
  const file = path.join(dir, 'stdin.md');
  await fs.writeFile(file, content, 'utf-8');

  try {
    return await coreRun(file, ctx, options);
  } finally {
    // Best-effort cleanup.
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function coreRun(
  filePath: string,
  ctx: CommandContext,
  options: CoreOptions = {}
): Promise<CommandResult> {
  // Delegate to `cog run` which already supports file paths.
  return run(filePath, ctx, {
    args: options.args,
    input: options.input,
    noValidate: options.noValidate,
    pretty: options.pretty,
    verbose: options.verbose,
    stream: options.stream,
  });
}

export async function core(
  subcommand: string | undefined,
  target: string | undefined,
  ctx: CommandContext,
  options: CoreOptions = {},
  rest: string[] = []
): Promise<CommandResult> {
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    return {
      success: true,
      data: {
        usage: [
          'cog core new [file.md] [--dry-run]',
          'cog core schema <file.md> [--pretty]',
          'cog core run <file.md> [--args "..."] [--pretty] [--stream] [--no-validate]',
          'cog core run --stdin [--args "..."] [--pretty] [--stream] [--no-validate]',
          'cog core promote <file.md> [outDir] [--dry-run] [--force]',
        ],
      },
    };
  }

  if (subcommand === 'new') {
    const file = target || 'demo.md';
    return coreNew(file, { dryRun: options.dryRun });
  }

  if (subcommand === 'schema') {
    if (!target) return { success: false, error: 'Usage: cog core schema <file.md>' };
    return coreSchema(target);
  }

  if (subcommand === 'run') {
    if (options.stdin) {
      const inputText = await readAll(process.stdin);
      return coreRunText(inputText, ctx, options);
    }
    if (!target) return { success: false, error: 'Usage: cog core run <file.md> [--args "..."] (or use --stdin)' };
    return coreRun(target, ctx, options);
  }

  if (subcommand === 'promote') {
    if (!target) return { success: false, error: 'Usage: cog core promote <file.md> [outDir]' };
    const outDir = rest[0];
    return corePromote(target, outDir, { dryRun: options.dryRun, force: options.force });
  }

  return { success: false, error: `Unknown core subcommand: ${subcommand}` };
}
