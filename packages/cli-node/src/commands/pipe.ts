/**
 * cog pipe - Pipe mode for stdin/stdout integration
 */

import * as readline from 'node:readline';
import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths, runModule } from '../modules/index.js';

export interface PipeOptions {
  module: string;
  noValidate?: boolean;
}

export async function pipe(
  ctx: CommandContext,
  options: PipeOptions
): Promise<CommandResult> {
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  
  // Find module
  const module = await findModule(options.module, searchPaths);
  if (!module) {
    return {
      success: false,
      error: `Module not found: ${options.module}`,
    };
  }

  // Read from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  
  const input = lines.join('\n');

  try {
    // Check if input is JSON
    let inputData: Record<string, unknown> | undefined;
    try {
      inputData = JSON.parse(input);
    } catch {
      // Not JSON, use as args
    }

    const result = await runModule(module, ctx.provider, {
      args: inputData ? undefined : input,
      input: inputData,
    });

    // Output envelope format to stdout
    console.log(JSON.stringify(result));

    return {
      success: result.ok,
      data: result,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    // Output error in envelope format
    console.log(JSON.stringify({
      ok: false,
      error: { code: 'RUNTIME_ERROR', message: error }
    }));
    return {
      success: false,
      error,
    };
  }
}
