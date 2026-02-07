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
