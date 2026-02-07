#!/usr/bin/env node
/**
 * Cognitive Modules CLI
 * 
 * cog run <module> --args "..."     - Run a module
 * cog add <url> -m <name>           - Add module from GitHub
 * cog update <module>               - Update to latest version
 * cog remove <module>               - Remove installed module
 * cog versions <url>                - List available versions
 * cog list                          - List available modules
 * cog pipe --module <name>          - Pipe mode (stdin/stdout)
 * cog doctor                        - Check configuration
 * 
 * npx cognitive-modules add ziel-io/cognitive-modules -m code-simplifier
 */

import { parseArgs } from 'node:util';
import { getProvider, listProviders } from './providers/index.js';
import { run, list, pipe, init, add, update, remove, versions, compose, composeInfo, validate, validateAll, migrate, migrateAll, test, testAll, search, listCategories, info, core } from './commands/index.js';
import { listModules, getDefaultSearchPaths } from './modules/loader.js';
import type { CommandContext } from './types.js';
import { VERSION } from './version.js';
import { resolveExecutionPolicy } from './profile.js';
import { buildRegistryAssets, verifyRegistryAssets } from './registry/assets.js';
import { DEFAULT_REGISTRY_URL } from './registry/client.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log(`Cognitive Runtime v${VERSION}`);
    process.exit(0);
  }

  // Parse common options
  const { values, positionals } = parseArgs({
    args: args.slice(1),
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      stdin: { type: 'boolean', default: false }, // core: read module prompt from stdin
      force: { type: 'boolean', default: false }, // core promote: overwrite existing target dir
      profile: { type: 'string' }, // progressive complexity profile
      validate: { type: 'string' }, // auto|on|off (overrides --no-validate)
      audit: { type: 'boolean', default: false }, // write audit record to ~/.cognitive/audit/
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

  if (values.help) {
    if (command === 'core') {
      console.log(JSON.stringify({
        usage: [
          'cog core new [file.md] [--dry-run]',
          'cog core schema <file.md> [--pretty]',
          'cog core run <file.md> [--args \"...\"] [--pretty] [--stream] [--no-validate]',
          'cog core run --stdin [--args \"...\"] [--pretty] [--stream] [--no-validate]',
          'cog core promote <file.md> [outDir] [--dry-run] [--force]',
        ],
      }, null, values.pretty ? 2 : 0));
      process.exit(0);
    }
    printHelp();
    process.exit(0);
  }

  // Guard Core-only flags so we don't silently ignore them on other commands.
  if (command !== 'core') {
    if (values.stdin) {
      console.error('Error: --stdin is only supported for `cog core run --stdin`');
      process.exit(1);
    }
    if (values.force) {
      console.error('Error: --force is only supported for `cog core promote --force`');
      process.exit(1);
    }
  }

  // Get provider
  let provider;
  try {
    provider = getProvider(values.provider, values.model);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  let policy;
  try {
    policy = resolveExecutionPolicy({
      profile: values.profile,
      validate: values.validate,
      noValidate: values['no-validate'],
      audit: values.audit,
    });
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // Progressive Complexity: `cog core ...` defaults to the `core` profile unless explicitly overridden.
  // This keeps the "5-minute path" minimal by default (no schema enforcement unless requested).
  if (command === 'core' && (values.profile === undefined || values.profile === null || String(values.profile).trim() === '')) {
    try {
      policy = resolveExecutionPolicy({
        profile: 'core',
        validate: values.validate,
        noValidate: values['no-validate'],
        audit: values.audit,
      });
    } catch (e) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  const parsePositive = (key: string, raw: unknown): number | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid --${key}: ${String(raw)} (expected a positive number)`);
    }
    return Math.floor(n);
  };

  const ctx: CommandContext = {
    cwd: process.cwd(),
    provider,
    verbose: values.verbose,
    policy,
    registryUrl: (values.registry as string | undefined) ?? undefined,
    registryTimeoutMs: parsePositive('registry-timeout-ms', values['registry-timeout-ms']),
    registryMaxBytes: parsePositive('registry-max-bytes', values['registry-max-bytes']),
  };

  try {
    switch (command) {
      case 'core': {
        const sub = positionals[0];
        const target = positionals[1];
        const rest = positionals.slice(2);
        const result = await core(sub, target, ctx, {
          args: values.args,
          input: values.input,
          noValidate: values['no-validate'],
          pretty: values.pretty,
          verbose: values.verbose,
          stream: values.stream,
          dryRun: values['dry-run'],
          stdin: values.stdin,
          force: values.force,
        }, rest);

        if (!result.success) {
          // Keep parity with `cog run`: if an error envelope exists, print it.
          // This avoids confusing "Error: undefined" when the command returns a valid envelope
          // but `error` string is not set.
          if (result.data) {
            console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
          } else {
            console.error(`Error: ${result.error ?? 'Unknown error'}`);
          }
          process.exit(1);
        }

        // Stream mode prints events as NDJSON already (via `cog run`).
        if (!(values.stream && sub === 'run')) {
          console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
        }
        break;
      }

      case 'run': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog run <module> [--args "..."]');
          process.exit(1);
        }
        
        const result = await run(moduleName, ctx, {
          args: values.args,
          input: values.input,
          // policy.validate is resolved in run(); keep legacy flag compatibility here.
          noValidate: values['no-validate'],
          pretty: values.pretty,
          verbose: values.verbose,
          stream: values.stream,
        });
        
        if (!result.success) {
          if (result.data) {
            console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
          } else {
            console.error(`Error: ${result.error}`);
          }
          process.exit(1);
        }
        
        // Stream mode prints events as NDJSON already.
        if (!values.stream) {
          console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
        }
        break;
      }

      case 'list': {
        const result = await list(ctx);
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { modules: Array<{ name: string; version: string; responsibility: string; location: string }> };
        
        if (data.modules.length === 0) {
          console.log('No modules found.');
        } else {
          console.log('Available Modules:');
          console.log('');
          for (const m of data.modules) {
            console.log(`  ${m.name} (v${m.version})`);
            console.log(`    ${m.responsibility}`);
            console.log(`    ${m.location}`);
            console.log('');
          }
        }
        break;
      }

      case 'pipe': {
        const moduleName = values.module || args[1];
        if (!moduleName) {
          console.error('Usage: cog pipe --module <name>');
          process.exit(1);
        }
        
        await pipe(ctx, {
          module: moduleName,
          noValidate: values['no-validate'],
        });
        break;
      }

      case 'init': {
        const moduleName = args[1];
        const result = await init(ctx, moduleName);
        
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { message: string; location: string; files?: string[]; hint?: string };
        console.log(data.message);
        console.log(`  Location: ${data.location}`);
        if (data.files) {
          console.log(`  Files: ${data.files.join(', ')}`);
        }
        if (data.hint) {
          console.log(`  ${data.hint}`);
        }
        break;
      }

      case 'doctor': {
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Cognitive Runtime v${VERSION} - Environment Diagnostics`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // 1. Version info
        console.log('Version Information:');
        console.log(`  Runtime: v${VERSION}`);
        console.log(`  Spec: v2.2`);
        console.log('');
        
        // 2. Provider configuration
        console.log('LLM Providers:');
        const providers = listProviders();
        let hasConfiguredProvider = false;
        for (const p of providers) {
          const status = p.configured ? '✓' : '–';
          const apiKeyStatus = p.configured ? 'API key set' : 'not configured';
          console.log(`  ${status} ${p.name}`);
          console.log(`      Model: ${p.model}`);
          console.log(`      Structured output: ${p.structuredOutput}`);
          console.log(`      Streaming: ${p.streaming ? 'yes' : 'no'}`);
          console.log(`      Status: ${apiKeyStatus}`);
          if (p.configured) hasConfiguredProvider = true;
        }
        console.log('');
        
        // 3. Active provider
        console.log('Active Provider:');
        try {
          const provider = getProvider();
          console.log(`  ✓ ${provider.name} (ready to use)`);
        } catch {
          console.log('  ✗ None configured');
          console.log('    → Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.');
        }
        console.log('');
        
        // 4. Module scan
        console.log('Module Search Paths:');
        const searchPaths = getDefaultSearchPaths(ctx.cwd);
        for (const p of searchPaths) {
          console.log(`  • ${p}`);
        }
        console.log('');
        
        // 5. Installed modules
        console.log('Installed Modules:');
        try {
          const modules = await listModules(searchPaths);
          if (modules.length === 0) {
            console.log('  – No modules found');
            console.log('    → Use `cog add <repo> -m <module>` to install modules');
          } else {
            let v22Count = 0;
            let legacyCount = 0;
            
            for (const m of modules) {
              const isV22 = m.tier !== undefined || m.formatVersion === 'v2.2';
              if (isV22) v22Count++;
              else legacyCount++;
              
              const versionBadge = isV22 ? '[v2.2]' : '[legacy]';
              const tierBadge = m.tier ? `tier:${m.tier}` : '';
              console.log(`  ✓ ${m.name} ${versionBadge} ${tierBadge}`);
              console.log(`      ${m.responsibility || 'No description'}`);
            }
            
            console.log('');
            console.log(`  Total: ${modules.length} modules (${v22Count} v2.2, ${legacyCount} legacy)`);
            
            if (legacyCount > 0) {
              console.log('');
              console.log('  ⚠ Legacy modules detected');
              console.log('    → Use `cog migrate --all` to upgrade to v2.2');
            }
          }
        } catch (e) {
          console.log(`  ✗ Error scanning modules: ${e instanceof Error ? e.message : e}`);
        }
        console.log('');
        
        // 6. Recommendations
        console.log('Recommendations:');
        const recommendations: string[] = [];
        
        if (!hasConfiguredProvider) {
          recommendations.push('Configure at least one LLM provider (e.g., OPENAI_API_KEY)');
        }
        
        try {
          const modules = await listModules(searchPaths);
          if (modules.length === 0) {
            recommendations.push('Install some modules with `cog add`');
          }
          
          // Check for modules without tests
          let modulesWithoutTests = 0;
          for (const m of modules) {
            const testsConfig = (m as unknown as { tests?: string[] }).tests;
            if (!testsConfig || testsConfig.length === 0) {
              modulesWithoutTests++;
            }
          }
          if (modulesWithoutTests > 0) {
            recommendations.push(`${modulesWithoutTests} module(s) have no tests - consider adding golden tests`);
          }
        } catch {
          // Ignore
        }
        
        if (recommendations.length === 0) {
          console.log('  ✓ All good! Your environment is properly configured.');
        } else {
          for (const rec of recommendations) {
            console.log(`  → ${rec}`);
          }
        }
        
        console.log('');
        console.log('───────────────────────────────────────────────────────────');
        console.log('For more help: cog --help');
        break;
      }

      case 'add': {
        const url = args[1];
        if (!url || url.startsWith('-')) {
          console.error('Usage: cog add <source> [--module <name>] [--tag <version>]');
          console.error('');
          console.error('Source can be:');
          console.error('  - GitHub: org/repo (e.g., ziel-io/cognitive-modules)');
          console.error('  - Registry: module-name[@version] (e.g., code-simplifier)');
          console.error('');
          console.error('Examples:');
          console.error('  cog add code-simplifier                 # From registry');
          console.error('  cog add code-reviewer@1.2.0             # Specific version');
          console.error('  cog add ziel-io/cognitive-modules -m code-simplifier');
          console.error('  cog add org/repo --module my-module --tag v1.0.0');
          process.exit(1);
        }
        
        console.log(`→ Adding module: ${url}`);
        if (values.module) console.log(`  Module path: ${values.module}`);
        if (values.tag) console.log(`  Version: ${values.tag}`);
        
        const result = await add(url, ctx, {
          module: values.module,
          name: values.name,
          tag: values.tag,
          branch: values.branch,
        });
        
        if (!result.success) {
          console.error(`✗ Failed to add module: ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { message: string; location: string; name: string };
        console.log(`✓ ${data.message}`);
        console.log(`  Location: ${data.location}`);
        console.log('');
        console.log('Run with:');
        console.log(`  cog run ${data.name} --args "your input"`);
        break;
      }

      case 'update': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog update <module> [--tag <version>]');
          process.exit(1);
        }
        
        console.log(`→ Updating module: ${moduleName}`);
        
        const result = await update(moduleName, ctx, {
          tag: values.tag,
        });
        
        if (!result.success) {
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { message: string };
        console.log(`✓ ${data.message}`);
        break;
      }

      case 'remove': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog remove <module>');
          process.exit(1);
        }
        
        const result = await remove(moduleName, ctx);
        
        if (!result.success) {
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { message: string };
        console.log(`✓ ${data.message}`);
        break;
      }

      case 'versions': {
        const url = args[1];
        if (!url || url.startsWith('-')) {
          console.error('Usage: cog versions <url>');
          console.error('');
          console.error('Examples:');
          console.error('  cog versions ziel-io/cognitive-modules');
          process.exit(1);
        }
        
        console.log(`→ Fetching versions from: ${url}\n`);
        
        const limit = values.limit ? parseInt(values.limit, 10) : 10;
        const result = await versions(url, ctx, { limit });
        
        if (!result.success) {
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as { tags: string[]; count: number };
        
        if (data.tags.length === 0) {
          console.log('No tags/versions found.');
        } else {
          console.log(`Available Versions (${data.count}):`);
          console.log('');
          for (const tag of data.tags) {
            console.log(`  ${tag}`);
            console.log(`    cog add ${url} --tag ${tag}`);
          }
        }
        break;
      }

      case 'compose': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog compose <module> [--args "..."] [--timeout <ms>] [--max-depth <n>]');
          process.exit(1);
        }
        
        const result = await compose(moduleName, ctx, {
          args: values.args,
          input: values.input,
          noValidate: values['no-validate'],
          maxDepth: values['max-depth'] ? parseInt(values['max-depth'] as string, 10) : undefined,
          timeout: values.timeout ? parseInt(values.timeout as string, 10) : undefined,
          trace: values.trace,
          pretty: values.pretty,
          verbose: values.verbose,
        });
        
        if (!result.success) {
          if (result.data) {
            console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
          } else {
            console.error(`Error: ${result.error}`);
          }
          process.exit(1);
        }
        
        console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
        break;
      }

      case 'compose-info': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog compose-info <module>');
          process.exit(1);
        }
        
        const result = await composeInfo(moduleName, ctx);
        
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        
        console.log(JSON.stringify(result.data, null, 2));
        break;
      }

      case 'serve': {
        const { serve } = await import('./server/http.js');
        const port = values.port ? parseInt(values.port as string, 10) : 8000;
        const host = (values.host as string) || '0.0.0.0';
        console.log('Starting Cognitive Modules HTTP Server...');
        await serve({ host, port, cwd: ctx.cwd });
        break;
      }

      case 'mcp': {
        try {
          const { serve: serveMcp } = await import('./mcp/server.js');
          await serveMcp();
        } catch (e) {
          if (e instanceof Error && e.message.includes('Cannot find module')) {
            console.error('MCP dependencies not installed.');
            console.error('Install with: npm install @modelcontextprotocol/sdk');
            process.exit(1);
          }
          throw e;
        }
        break;
      }

      case 'validate': {
        const target = args[1];
        
        if (values.all) {
          // Validate all modules
          console.log('→ Validating all modules...\n');
          
          const result = await validateAll(ctx, {
            v22: values.v22,
            format: (values.format as 'text' | 'json') || 'text',
          });
          
          const data = result.data as { total: number; valid: number; invalid: number; results: Array<{ moduleName?: string; valid: boolean; errors: string[]; warnings: string[] }> };
          
          if (values.format === 'json') {
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log(`Total: ${data.total}, Valid: ${data.valid}, Invalid: ${data.invalid}\n`);
            
            for (const r of data.results) {
              const status = r.valid ? '✓' : '✗';
              console.log(`${status} ${r.moduleName || 'unknown'}`);
              
              for (const err of r.errors) {
                console.log(`    Error: ${err}`);
              }
              for (const warn of r.warnings) {
                console.log(`    Warning: ${warn}`);
              }
            }
          }
          
          process.exit(result.success ? 0 : 1);
        }
        
        if (!target || target.startsWith('-')) {
          console.error('Usage: cog validate <module> [--v22] [--all]');
          process.exit(1);
        }
        
        console.log(`→ Validating module: ${target}`);
        if (values.v22) console.log('  Using strict v2.2 validation');
        console.log('');
        
        const result = await validate(target, ctx, {
          v22: values.v22,
          format: (values.format as 'text' | 'json') || 'text',
        });
        
        const data = result.data as { valid: boolean; modulePath: string; moduleName?: string; errors: string[]; warnings: string[] };
        
        if (values.format === 'json') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          if (data.valid) {
            console.log('✓ Module is valid');
          } else {
            console.log('✗ Validation failed');
            console.log('');
            for (const err of data.errors) {
              console.log(`  Error: ${err}`);
            }
          }
          
          if (data.warnings.length > 0) {
            console.log('');
            console.log('Warnings:');
            for (const warn of data.warnings) {
              console.log(`  ${warn}`);
            }
          }
        }
        
        process.exit(result.success ? 0 : 1);
      }

      case 'migrate': {
        const target = args[1];
        const dryRun = values['dry-run'];
        const backup = !values['no-backup'];
        
        if (values.all) {
          // Migrate all modules
          console.log('→ Migrating all modules to v2.2...');
          if (dryRun) console.log('  (Dry run - no changes will be made)');
          console.log('');
          
          const result = await migrateAll(ctx, { dryRun, backup });
          
          const data = result.data as { total: number; migrated: number; skipped: number; failed: number; results: Array<{ moduleName: string; success: boolean; changes: string[]; warnings: string[] }> };
          
          console.log(`Total: ${data.total}, Migrated: ${data.migrated}, Skipped: ${data.skipped}, Failed: ${data.failed}\n`);
          
          for (const r of data.results) {
            const status = r.success ? (r.changes.length > 0 ? '✓' : '–') : '✗';
            console.log(`${status} ${r.moduleName}`);
            
            for (const change of r.changes) {
              console.log(`    ${change}`);
            }
            for (const warn of r.warnings) {
              console.log(`    Warning: ${warn}`);
            }
          }
          
          process.exit(result.success ? 0 : 1);
        }
        
        if (!target || target.startsWith('-')) {
          console.error('Usage: cog migrate <module> [--dry-run] [--no-backup] [--all]');
          process.exit(1);
        }
        
        console.log(`→ Migrating module to v2.2: ${target}`);
        if (dryRun) console.log('  (Dry run - no changes will be made)');
        console.log('');
        
        const result = await migrate(target, ctx, { dryRun, backup });
        
        const data = result.data as { moduleName: string; success: boolean; changes: string[]; warnings: string[] };
        
        if (data.success) {
          if (data.changes.length > 0) {
            console.log('✓ Migration completed');
            console.log('');
            for (const change of data.changes) {
              console.log(`  ${change}`);
            }
          } else {
            console.log('– No changes needed');
          }
        } else {
          console.log('✗ Migration failed');
        }
        
        if (data.warnings.length > 0) {
          console.log('');
          console.log('Warnings:');
          for (const warn of data.warnings) {
            console.log(`  ${warn}`);
          }
        }
        
        process.exit(result.success ? 0 : 1);
      }

      case 'test': {
        const target = args[1];
        
        if (values.all) {
          // Test all modules
          console.log('→ Running tests for all modules...\n');
          
          const result = await testAll(ctx, {
            verbose: values.verbose,
            timeout: values.timeout ? parseInt(values.timeout as string, 10) : undefined,
          });
          
          const data = result.data as {
            total: number;
            passed: number;
            failed: number;
            skipped: number;
            duration_ms: number;
            modules: Array<{
              moduleName: string;
              total: number;
              passed: number;
              failed: number;
              results: Array<{ name: string; passed: boolean; error?: string }>;
            }>;
          };
          
          // Summary
          console.log('═══════════════════════════════════════════════════════════');
          console.log('Test Summary');
          console.log('═══════════════════════════════════════════════════════════');
          console.log(`Total: ${data.total}, Passed: ${data.passed}, Failed: ${data.failed}, Skipped: ${data.skipped}`);
          console.log(`Duration: ${data.duration_ms}ms\n`);
          
          // Per-module results
          for (const m of data.modules) {
            if (m.total === 0) {
              console.log(`– ${m.moduleName}: no tests`);
              continue;
            }
            
            const status = m.failed === 0 ? '✓' : '✗';
            console.log(`${status} ${m.moduleName}: ${m.passed}/${m.total} passed`);
            
            for (const r of m.results) {
              if (!r.passed) {
                console.log(`    ✗ ${r.name}: ${r.error}`);
              }
            }
          }
          
          process.exit(result.success ? 0 : 1);
        }
        
        if (!target || target.startsWith('-')) {
          console.error('Usage: cog test <module> [--all] [--verbose] [--timeout <ms>]');
          process.exit(1);
        }
        
        console.log(`→ Running tests for module: ${target}\n`);
        
        const result = await test(target, ctx, {
          verbose: values.verbose,
          timeout: values.timeout ? parseInt(values.timeout as string, 10) : undefined,
        });
        
        if (!result.success && !result.data) {
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as {
          moduleName: string;
          total: number;
          passed: number;
          failed: number;
          duration_ms: number;
          results: Array<{
            name: string;
            passed: boolean;
            duration_ms: number;
            error?: string;
            diff?: Array<{ field: string; expected: unknown; actual: unknown }>;
          }>;
        };
        
        if (data.total === 0) {
          console.log('– No tests found for this module');
          console.log('');
          console.log('To add tests, create a tests/ directory with:');
          console.log('  - tests/case1.input.json');
          console.log('  - tests/case1.expected.json');
          console.log('');
          console.log('Or define in module.yaml:');
          console.log('  tests:');
          console.log('    - tests/case1.input.json -> tests/case1.expected.json');
          process.exit(0);
        }
        
        // Results
        console.log(`Module: ${data.moduleName}`);
        console.log(`Total: ${data.total}, Passed: ${data.passed}, Failed: ${data.failed}`);
        console.log(`Duration: ${data.duration_ms}ms\n`);
        
        for (const r of data.results) {
          const status = r.passed ? '✓' : '✗';
          console.log(`${status} ${r.name} (${r.duration_ms}ms)`);
          
          if (!r.passed) {
            if (r.error) {
              console.log(`    Error: ${r.error}`);
            }
            if (r.diff && r.diff.length > 0) {
              console.log('    Differences:');
              for (const d of r.diff.slice(0, 5)) {
                console.log(`      ${d.field}:`);
                console.log(`        expected: ${JSON.stringify(d.expected)}`);
                console.log(`        actual:   ${JSON.stringify(d.actual)}`);
              }
              if (r.diff.length > 5) {
                console.log(`      ... and ${r.diff.length - 5} more`);
              }
            }
          }
        }
        
        process.exit(result.success ? 0 : 1);
      }

      case 'search': {
        // Use positionals for query (excludes options)
        const query = positionals.join(' ');
        const limit = values.limit ? parseInt(values.limit, 10) : 20;
        const category = values.category as string | undefined;
        
        const result = await search(query, ctx, { limit, category });
        
        if (!result.success) {
          console.error(`✗ ${result.error}`);
          process.exit(1);
        }
        
        const data = result.data as {
          query: string;
          total: number;
          results: Array<{ name: string; description: string; version: string; keywords: string[] }>;
        };
        
        if (data.results.length === 0) {
          if (query) {
            console.log(`No modules found for: "${query}"`);
          } else {
            console.log('No modules available in registry.');
          }
          console.log('');
          console.log('Try:');
          console.log('  cog search code review');
          console.log('  cog search task management');
        } else {
          if (query) {
            console.log(`Search results for "${query}" (${data.total} total):\n`);
          } else {
            console.log(`Available modules (${data.total} total):\n`);
          }
          
          for (const mod of data.results) {
            console.log(`  ${mod.name} (v${mod.version})`);
            console.log(`    ${mod.description}`);
            if (mod.keywords.length > 0) {
              console.log(`    Tags: ${mod.keywords.join(', ')}`);
            }
            console.log('');
          }
          
          console.log('Install with:');
          console.log(`  cog add <module-name>`);
        }
        break;
      }

      case 'registry': {
        // positionals[0] is the subcommand, positionals[1] is the argument
        const subCommand = positionals[0];
        
        if (!subCommand || subCommand === 'list') {
          // List all modules
          const result = await search('', ctx, {});
          
          if (!result.success) {
            console.error(`✗ ${result.error}`);
            process.exit(1);
          }
          
          const data = result.data as {
            total: number;
            results: Array<{ name: string; description: string; version: string }>;
          };
          
          console.log(`Registry modules (${data.total} total):\n`);
          
          for (const mod of data.results) {
            console.log(`  ${mod.name} (v${mod.version})`);
            console.log(`    ${mod.description}`);
            console.log('');
          }
        } else if (subCommand === 'categories') {
          const result = await listCategories(ctx, {});
          
          if (!result.success) {
            console.error(`✗ ${result.error}`);
            process.exit(1);
          }
          
          const data = result.data as {
            categories: Array<{ key: string; name: string; description: string; moduleCount: number }>;
          };
          
          console.log('Registry categories:\n');
          
          for (const cat of data.categories) {
            console.log(`  ${cat.key} - ${cat.name} (${cat.moduleCount} modules)`);
            console.log(`    ${cat.description}`);
            console.log('');
          }
        } else if (subCommand === 'info') {
          // positionals[1] is the module name (positionals[0] is 'info')
          const moduleName = positionals[1];
          
          if (!moduleName) {
            console.error('Usage: cog registry info <module>');
            process.exit(1);
          }
          
          const result = await info(moduleName, ctx, {});
          
          if (!result.success) {
            console.error(`✗ ${result.error}`);
            process.exit(1);
          }
          
          const data = result.data as { module: { name: string; version: string; description: string; author: string; source: string; keywords: string[]; tier?: string; license?: string; repository?: string; conformance_level?: number; verified?: boolean; deprecated?: boolean } };
          const mod = data.module;
          
          console.log(`Module: ${mod.name}\n`);
          console.log(`  Version: ${mod.version}`);
          console.log(`  Description: ${mod.description}`);
          console.log(`  Author: ${mod.author}`);
          console.log(`  Source: ${mod.source}`);
          
          if (mod.tier) console.log(`  Tier: ${mod.tier}`);
          if (mod.license) console.log(`  License: ${mod.license}`);
          if (mod.repository) console.log(`  Repository: ${mod.repository}`);
          if (mod.keywords.length > 0) console.log(`  Keywords: ${mod.keywords.join(', ')}`);
          if (mod.conformance_level) console.log(`  Conformance Level: ${mod.conformance_level}`);
          if (mod.verified !== undefined) console.log(`  Verified: ${mod.verified ? 'Yes' : 'No'}`);
          if (mod.deprecated) console.log(`  DEPRECATED: This module is deprecated`);
          
          console.log('');
          console.log('Install with:');
          console.log(`  cog add ${mod.name}`);
        } else if (subCommand === 'refresh') {
          // Force refresh the registry cache
          const { RegistryClient } = await import('./registry/client.js');
          const client = new RegistryClient();
          await client.fetchRegistry(true);
          console.log('✓ Registry cache refreshed');
        } else if (subCommand === 'build') {
          const result = await buildRegistryAssets({
            tag: values.tag ?? null,
            tarballBaseUrl: (values['tarball-base-url'] as string | undefined) ?? null,
            modulesDir: (values['modules-dir'] as string | undefined) ?? 'cognitive/modules',
            v1RegistryPath: (values['v1-registry'] as string | undefined) ?? 'cognitive-registry.json',
            outDir: (values['out-dir'] as string | undefined) ?? 'dist/registry-assets',
            registryOut: (values['registry-out'] as string | undefined) ?? 'cognitive-registry.v2.json',
            namespace: (values.namespace as string | undefined) ?? 'official',
            runtimeMin: (values['runtime-min'] as string | undefined) ?? '2.2.0',
            repository: (values.repository as string | undefined) ?? 'https://github.com/Cognary/cognitive',
            homepage: (values.homepage as string | undefined) ?? 'https://cognary.github.io/cognitive/',
            license: (values.license as string | undefined) ?? 'MIT',
            timestamp: (values.timestamp as string | undefined) ?? null,
            only: Array.isArray(values.only) ? (values.only as string[]) : (values.only ? [String(values.only)] : []),
          });
          console.log(JSON.stringify({ ok: true, ...result }, null, values.pretty ? 2 : 0));
        } else if (subCommand === 'verify') {
          const remote = Boolean(values.remote);
          const defaultIndex =
            (typeof process.env.COGNITIVE_REGISTRY_URL === 'string' && process.env.COGNITIVE_REGISTRY_URL.trim()
              ? process.env.COGNITIVE_REGISTRY_URL.trim()
              : undefined) ??
            ctx.registryUrl ??
            DEFAULT_REGISTRY_URL;
          const indexPath =
            (values.index as string | undefined) ??
            (remote ? defaultIndex : 'cognitive-registry.v2.json');
          const assetsDir = (values['assets-dir'] as string | undefined) ?? (remote ? undefined : 'dist/registry-assets');

          const fetchTimeoutMs = parsePositive('fetch-timeout-ms', values['fetch-timeout-ms']);
          const maxIndexBytes = parsePositive('max-index-bytes', values['max-index-bytes']);
          const maxTarballBytes = parsePositive('max-tarball-bytes', values['max-tarball-bytes']);
          const concurrency = parsePositive('concurrency', values.concurrency);

          const verified = await verifyRegistryAssets({
            registryIndexPath: indexPath,
            assetsDir,
            remote,
            fetchTimeoutMs,
            maxIndexBytes,
            maxTarballBytes,
            concurrency,
          });
          console.log(JSON.stringify(verified, null, values.pretty ? 2 : 0));
          if (!verified.ok) {
            process.exit(1);
          }
        } else {
          console.error(`Unknown registry subcommand: ${subCommand}`);
          console.error('');
          console.error('Usage:');
          console.error('  cog registry list        List all modules');
          console.error('  cog registry categories  List categories');
          console.error('  cog registry info <mod>  Show module details');
          console.error('  cog registry refresh     Refresh cache');
          console.error('  cog registry build       Build registry tarballs + v2 index (local)');
          console.error('  cog registry verify      Verify local tarballs against v2 index');
          console.error('  cog registry verify --remote --index <url>  Verify remote index+tarballs');
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "cog --help" for usage.');
        process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    if (values.verbose && e instanceof Error) {
      console.error(e.stack);
    }
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Cognitive Runtime v${VERSION}
Structured AI Task Execution

USAGE:
  cog <command> [options]

COMMANDS:
  core <cmd>          Minimal "one-file" workflow (new, schema, run)
  run <module>        Run a Cognitive Module
  test <module>       Run golden tests for a module
  compose <module>    Execute a composed module workflow
  compose-info <mod>  Show composition configuration
  list                List available (installed) modules
  add <source>        Add module from Registry or GitHub
  update <module>     Update module to latest version
  remove <module>     Remove installed module
  versions <url>      List available versions
  search [query]      Search modules in registry
  registry <cmd>      Registry commands (list, categories, info, refresh, build, verify)
  validate <module>   Validate module structure
  migrate <module>    Migrate module to v2.2 format
  pipe                Pipe mode (stdin/stdout)
  init [name]         Initialize project or create module
  serve               Start HTTP API server
  mcp                 Start MCP server (for Claude Code, Cursor)
  doctor              Check environment and configuration

OPTIONS:
  --profile <name>     Progressive complexity profile: core|default|strict|certified
  --validate <mode>    Validation mode: auto|on|off (overrides --no-validate)
  --audit              Write an audit record to ~/.cognitive/audit/ (stderr prints path)
  -a, --args <str>      Arguments to pass to module
  -i, --input <json>    JSON input for module
  -m, --module <name>   Module path within repo (for add)
  -n, --name <name>     Override module name (for add)
  -t, --tag <version>   Git tag/version (for add/update)
  -b, --branch <name>   Git branch (for add)
  -M, --model <name>    LLM model (e.g., gpt-4o, gemini-2.0-flash)
  -p, --provider <name> LLM provider (gemini, openai, anthropic, deepseek, minimax, moonshot, qwen, ollama)
  --pretty              Pretty-print JSON output
  -V, --verbose         Verbose output
  --no-validate         Skip schema validation
  --stdin               Read module prompt from stdin (for core run)
  --force               Overwrite target directory (for core promote)
  -H, --host <host>     Server host (default: 0.0.0.0)
  -P, --port <port>     Server port (default: 8000)
  -d, --max-depth <n>   Max composition depth (default: 5)
  -T, --timeout <ms>    Composition timeout in milliseconds
  --trace               Include execution trace (for compose)
  --v22                 Use strict v2.2 validation (for validate)
  --dry-run             Show what would be done without changes (for migrate)
  --no-backup           Skip backup before migration (for migrate)
  --all                 Process all modules (for validate/migrate)
  -f, --format <fmt>    Output format: text or json (for validate)
  -c, --category <cat>  Filter by category (for search)
  --registry <url>      Override registry index URL (or set env COGNITIVE_REGISTRY_URL)
  --registry-timeout-ms <ms>  Registry index fetch timeout (overrides env COGNITIVE_REGISTRY_TIMEOUT_MS)
  --registry-max-bytes <n>    Registry index max bytes (overrides env COGNITIVE_REGISTRY_MAX_BYTES)
  -l, --limit <n>       Limit results (for search, versions)
  -v, --version         Show version
  -h, --help            Show this help

EXAMPLES:
  # One-file Core (no registry required)
  cog core new demo.md
  cog core run demo.md --args "hello" --pretty
  cog core schema demo.md --pretty
  cog core promote demo.md
  cog core promote demo.md ./cognitive/modules/demo

  # Search and discover modules
  cog search code review           # Search by keywords
  cog search                       # List all available modules
  cog search --category code-quality  # Search within category
  cog registry categories          # View module categories
  cog registry info code-simplifier  # Module details

  # Add modules from registry or GitHub
  cog add code-simplifier                  # From registry
  cog add code-reviewer@1.2.0              # Specific version from registry
  cog add ziel-io/cognitive-modules -m code-simplifier  # From GitHub
  cog add org/repo --module my-module --tag v1.0.0

  # Version management
  cog update code-simplifier
  cog versions ziel-io/cognitive-modules
  cog remove code-simplifier

  # Validation, testing, and migration
  cog validate code-reviewer
  cog validate code-reviewer --v22
  cog validate --all
  cog test code-simplifier              # Run golden tests
  cog test code-simplifier --verbose    # With detailed output
  cog test --all                        # Test all modules
  cog migrate code-reviewer --dry-run
  cog migrate code-reviewer
  cog migrate --all --no-backup

  # Run modules
  cog run code-reviewer --args "def foo(): pass"
  cog run code-reviewer --provider openai --model gpt-4o --args "..."
  cog list

  # Compose modules (multi-step workflows)
  cog compose code-review-pipeline --args "code to review"
  cog compose smart-processor --args "input" --timeout 60000 --verbose
  cog compose-info code-review-pipeline

  # Servers
  cog serve --port 8080
  cog mcp

  # Environment check
  cog doctor                            # Full diagnostics
  echo "review this code" | cog pipe --module code-reviewer
  cog init my-module

ENVIRONMENT:
  GEMINI_API_KEY      Google Gemini
  OPENAI_API_KEY      OpenAI
  ANTHROPIC_API_KEY   Anthropic Claude
  DEEPSEEK_API_KEY    DeepSeek
  MINIMAX_API_KEY     MiniMax
  MOONSHOT_API_KEY    Moonshot (Kimi)
  DASHSCOPE_API_KEY   Alibaba Qwen (通义千问)
  OLLAMA_HOST         Ollama local (default: localhost:11434)
  COG_MODEL           Override default model for any provider
  COGNITIVE_REGISTRY_URL  Override registry index URL
  COGNITIVE_REGISTRY_TIMEOUT_MS  Registry index fetch timeout (ms)
  COGNITIVE_REGISTRY_MAX_BYTES   Registry index max bytes
`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
