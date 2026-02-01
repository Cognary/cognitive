/**
 * cog run - Run a Cognitive Module
 */

import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths, runModule } from '../modules/index.js';

export interface RunOptions {
  args?: string;
  input?: string;
  noValidate?: boolean;
  pretty?: boolean;
  verbose?: boolean;
}

export async function run(
  moduleName: string,
  ctx: CommandContext,
  options: RunOptions = {}
): Promise<CommandResult> {
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  
  // Find module
  const module = await findModule(moduleName, searchPaths);
  if (!module) {
    return {
      success: false,
      error: `Module not found: ${moduleName}\nSearch paths: ${searchPaths.join(', ')}`,
    };
  }

  try {
    // Parse input if provided as JSON
    let inputData: Record<string, unknown> | undefined;
    if (options.input) {
      try {
        inputData = JSON.parse(options.input);
      } catch {
        return {
          success: false,
          error: `Invalid JSON input: ${options.input}`,
        };
      }
    }

    // Run module
    const result = await runModule(module, ctx.provider, {
      args: options.args,
      input: inputData,
      verbose: options.verbose || ctx.verbose,
    });

    // Return envelope format or extracted data
    if (options.pretty) {
      return {
        success: result.ok,
        data: result,
      };
    } else {
      // For non-pretty mode, return data (success) or error (failure)
      if (result.ok) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: `${result.error?.code}: ${result.error?.message}`,
          data: result.partial_data,
        };
      }
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
