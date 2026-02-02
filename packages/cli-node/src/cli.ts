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
import { run, list, pipe, init, add, update, remove, versions } from './commands/index.js';
import type { CommandContext } from './types.js';

const VERSION = '1.2.0';

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
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      args: { type: 'string', short: 'a' },
      input: { type: 'string', short: 'i' },
      module: { type: 'string', short: 'm' },
      model: { type: 'string', short: 'M' },
      provider: { type: 'string', short: 'p' },
      pretty: { type: 'boolean', default: false },
      verbose: { type: 'boolean', short: 'V', default: false },
      'no-validate': { type: 'boolean', default: false },
      // Add/update options
      name: { type: 'string', short: 'n' },
      tag: { type: 'string', short: 't' },
      branch: { type: 'string', short: 'b' },
      limit: { type: 'string', short: 'l' },
      // Server options
      host: { type: 'string', short: 'H' },
      port: { type: 'string', short: 'P' },
    },
    allowPositionals: true,
  });

  // Get provider
  let provider;
  try {
    provider = getProvider(values.provider, values.model);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  const ctx: CommandContext = {
    cwd: process.cwd(),
    provider,
    verbose: values.verbose,
  };

  try {
    switch (command) {
      case 'run': {
        const moduleName = args[1];
        if (!moduleName || moduleName.startsWith('-')) {
          console.error('Usage: cog run <module> [--args "..."]');
          process.exit(1);
        }
        
        const result = await run(moduleName, ctx, {
          args: values.args,
          input: values.input,
          noValidate: values['no-validate'],
          pretty: values.pretty,
          verbose: values.verbose,
        });
        
        if (!result.success) {
          console.error(`Error: ${result.error}`);
          process.exit(1);
        }
        
        console.log(JSON.stringify(result.data, null, values.pretty ? 2 : 0));
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
        console.log('Cognitive Runtime - Environment Check\n');
        
        console.log('Providers:');
        for (const p of listProviders()) {
          const status = p.configured ? '✓ configured' : '– not configured';
          console.log(`  ${p.name}: ${status} (${p.model})`);
        }
        console.log('');
        
        try {
          const provider = getProvider();
          console.log(`Active provider: ${provider.name}`);
        } catch {
          console.log('Active provider: none (set an API key)');
        }
        break;
      }

      case 'add': {
        const url = args[1];
        if (!url || url.startsWith('-')) {
          console.error('Usage: cog add <url> [--module <name>] [--tag <version>]');
          console.error('');
          console.error('Examples:');
          console.error('  cog add ziel-io/cognitive-modules -m code-simplifier');
          console.error('  cog add org/repo --module my-module --tag v1.0.0');
          process.exit(1);
        }
        
        console.log(`→ Adding module from: ${url}`);
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
  run <module>      Run a Cognitive Module
  list              List available modules
  add <url>         Add module from GitHub
  update <module>   Update module to latest version
  remove <module>   Remove installed module
  versions <url>    List available versions
  pipe              Pipe mode (stdin/stdout)
  init [name]       Initialize project or create module
  serve             Start HTTP API server
  mcp               Start MCP server (for Claude Code, Cursor)
  doctor            Check configuration

OPTIONS:
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
  -H, --host <host>     Server host (default: 0.0.0.0)
  -P, --port <port>     Server port (default: 8000)
  -v, --version         Show version
  -h, --help            Show this help

EXAMPLES:
  # Add modules from GitHub
  npx cognitive-modules-cli add ziel-io/cognitive-modules -m code-simplifier
  cog add org/repo --module my-module --tag v1.0.0

  # Version management
  cog update code-simplifier
  cog versions ziel-io/cognitive-modules
  cog remove code-simplifier

  # Run modules
  cog run code-reviewer --args "def foo(): pass"
  cog run code-reviewer --provider openai --model gpt-4o --args "..."
  cog list

  # Servers
  cog serve --port 8080
  cog mcp

  # Other
  echo "review this code" | cog pipe --module code-reviewer
  cog init my-module
  cog doctor

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
`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
