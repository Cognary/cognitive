import { parseArgs } from 'node:util';

export type CliParseResult = {
  command?: string;
  /**
   * Positionals after the command (subcommand/module name/query words).
   * This intentionally matches the historical meaning of `positionals` in `cli.ts`
   * (i.e., it does NOT include the command itself).
   */
  positionals: string[];
  /**
   * Convenience array shaped like `process.argv.slice(2)` used to be:
   * args[0] = command, args[1] = first positional after command.
   */
  args: string[];
  values: Record<string, unknown>;
};

const KNOWN_COMMANDS = new Set([
  'run',
  'list',
  'pipe',
  'init',
  'add',
  'update',
  'remove',
  'versions',
  'compose',
  'compose-info',
  'validate',
  'migrate',
  'test',
  'conformance',
  'search',
  'categories',
  'info',
  'providers',
  'registry',
  'serve',
  'doctor',
  'mcp',
  'core',
]);

/**
 * Recover from `npx`/`npm exec` swallowing unknown flags.
 *
 * Example user intent:
 *   npx cogn@X --provider minimax --model MiniMax-M2.1 core run --stdin ...
 *
 * Some `npx` flows interpret `--provider/--model` as `npx` flags and strip them,
 * leaving the values as positionals:
 *   minimax MiniMax-M2.1 core run --stdin ...
 *
 * This normalization attempts to restore:
 * - command = core
 * - values.provider/model = prelude tokens
 * - positionals = remaining args after core
 *
 * We intentionally scope the recovery to the "core" entrypoint to avoid masking real typos.
 */
export function normalizeCliParseResult(parsed: CliParseResult): CliParseResult {
  const command = parsed.command;
  if (!command) return parsed;
  if (KNOWN_COMMANDS.has(command)) return parsed;

  const allPositionals = [command, ...parsed.positionals];
  const coreIdx = allPositionals.indexOf('core');
  if (coreIdx <= 0) return parsed;

  const prelude = allPositionals.slice(0, coreIdx);
  const rest = allPositionals.slice(coreIdx + 1);

  const values = { ...parsed.values };
  if (values.provider === undefined && prelude[0]) values.provider = prelude[0];
  if (values.model === undefined && prelude[1]) values.model = prelude[1];

  return {
    command: 'core',
    positionals: rest,
    args: ['core', ...rest],
    values,
  };
}

export function parseCliArgs(argv: string[]): CliParseResult {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      stdin: { type: 'boolean', default: false }, // core: read module prompt from stdin
      force: { type: 'boolean', default: false }, // core promote: overwrite existing target dir
      profile: { type: 'string' }, // progressive complexity profile
      validate: { type: 'string' }, // auto|on|off (overrides --no-validate)
      audit: { type: 'boolean', default: false }, // write audit record to ~/.cognitive/audit/
      structured: { type: 'string' }, // auto|off|prompt|native (provider structured output strategy)
      args: { type: 'string', short: 'a' },
      input: { type: 'string', short: 'i' },
      module: { type: 'string', short: 'm' },
      model: { type: 'string', short: 'M' },
      provider: { type: 'string', short: 'p' },
      pretty: { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'V', default: false },
      'no-validate': { type: 'boolean', default: false },
      stream: { type: 'boolean', default: false },
      // Add/update options
      name: { type: 'string', short: 'n' },
      tag: { type: 'string', short: 't' },
      branch: { type: 'string', short: 'b' },
      limit: { type: 'string', short: 'l' },
      // Server options
      host: { type: 'string', short: 'H' },
      port: { type: 'string', short: 'P' },
      // Compose options
      'max-depth': { type: 'string', short: 'd' },
      timeout: { type: 'string', short: 'T' },
      trace: { type: 'boolean', default: false },
      // Conformance (spec vectors)
      conformance: { type: 'boolean', default: false }, // test: run official spec vectors
      suite: { type: 'string' }, // envelope|stream|registry|all
      level: { type: 'string' }, // 1|2|3
      'spec-dir': { type: 'string' }, // repo root or <root>/spec
      json: { type: 'boolean', default: false }, // conformance: machine-readable output
      // Validate/migrate options
      v22: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'no-backup': { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      format: { type: 'string', short: 'f' },
      // Search options
      category: { type: 'string', short: 'c' },
      registry: { type: 'string' }, // override registry index URL (or use env COGNITIVE_REGISTRY_URL)
      'registry-timeout-ms': { type: 'string' },
      'registry-max-bytes': { type: 'string' },
      // Registry build/verify options
      'modules-dir': { type: 'string' },
      'v1-registry': { type: 'string' },
      'out-dir': { type: 'string' },
      'registry-out': { type: 'string' },
      namespace: { type: 'string' },
      'runtime-min': { type: 'string' },
      repository: { type: 'string' },
      homepage: { type: 'string' },
      license: { type: 'string' },
      timestamp: { type: 'string' },
      only: { type: 'string', multiple: true },
      index: { type: 'string' },
      'assets-dir': { type: 'string' },
      'tarball-base-url': { type: 'string' },
      remote: { type: 'boolean', default: false }, // registry verify: fetch index + tarballs over network
      'fetch-timeout-ms': { type: 'string' },
      'max-index-bytes': { type: 'string' },
      'max-tarball-bytes': { type: 'string' },
      concurrency: { type: 'string' },
    },
    allowPositionals: true,
  });

  const command = positionals[0];
  const rest = positionals.slice(1);
  return {
    command,
    positionals: rest,
    args: command ? [command, ...rest] : [],
    values: values as Record<string, unknown>,
  };
}
