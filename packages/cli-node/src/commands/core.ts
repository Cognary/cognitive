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
    'responsibility: "One-file core module"',
    'tier: decision',
    'excludes:',
    '  - do not make network calls',
    '  - do not write files',
    '---',
    '',
    'Return a valid v2.2 envelope JSON with meta and data.',
    '',
    'Input:',
    '- args: string (from --args)',
    '',
    'Output (requirements):',
    '- meta.confidence: 0-1',
    "- meta.risk: one of 'none' | 'low' | 'medium' | 'high' (or extensible enum when allowed)",
    '- meta.explain: <=280 chars',
    '- data: your structured fields + data.rationale',
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
  options: { dryRun?: boolean } = {}
): Promise<CommandResult> {
  const abs = path.resolve(process.cwd(), filePath);
  const mod = await loadSingleFileModule(abs);

  const targetDir = outDir ? path.resolve(process.cwd(), outDir) : defaultPromoteDir(mod.name);
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
    return { success: false, error: `Target directory already exists: ${targetDir}` };
  } catch {
    // ok
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(moduleYamlPath, moduleYaml, 'utf-8');
  await fs.writeFile(promptMdPath, promptMd, 'utf-8');
  await fs.writeFile(schemaJsonPath, schemaJson, 'utf-8');

  return {
    success: true,
    data: {
      message: `Promoted one-file module to v2 directory`,
      from: abs,
      to: targetDir,
      files,
      hint: `Run: cog run ${mod.name} --args "hello" --pretty`,
    },
  };
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
          'cog core new <file.md> [--dry-run]',
          'cog core schema <file.md> [--pretty]',
          'cog core run <file.md> [--args "..."] [--pretty] [--stream] [--no-validate]',
          'cog core promote <file.md> [outDir] [--dry-run]',
        ],
      },
    };
  }

  if (subcommand === 'new') {
    if (!target) return { success: false, error: 'Usage: cog core new <file.md>' };
    return coreNew(target, { dryRun: options.dryRun });
  }

  if (subcommand === 'schema') {
    if (!target) return { success: false, error: 'Usage: cog core schema <file.md>' };
    return coreSchema(target);
  }

  if (subcommand === 'run') {
    if (!target) return { success: false, error: 'Usage: cog core run <file.md> [--args "..."]' };
    return coreRun(target, ctx, options);
  }

  if (subcommand === 'promote') {
    if (!target) return { success: false, error: 'Usage: cog core promote <file.md> [outDir]' };
    const outDir = rest[0];
    return corePromote(target, outDir, { dryRun: options.dryRun });
  }

  return { success: false, error: `Unknown core subcommand: ${subcommand}` };
}
