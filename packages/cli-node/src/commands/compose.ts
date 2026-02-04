/**
 * cog compose - Execute a Composed Cognitive Module Workflow
 * 
 * Supports all composition patterns:
 * - Sequential: A → B → C
 * - Parallel: A → [B, C, D] → Aggregate
 * - Conditional: A → (condition) → B or C
 * - Iterative: A → (check) → A → ... → Done
 */

import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths, executeComposition } from '../modules/index.js';

export interface ComposeOptions {
  /** Direct text input */
  args?: string;
  /** JSON input data */
  input?: string;
  /** Maximum composition depth */
  maxDepth?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Include execution trace */
  trace?: boolean;
  /** Pretty print output */
  pretty?: boolean;
  /** Verbose mode */
  verbose?: boolean;
}

export async function compose(
  moduleName: string,
  ctx: CommandContext,
  options: ComposeOptions = {}
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
    let inputData: Record<string, unknown> = {};
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
    
    // Handle --args as text input
    if (options.args) {
      inputData.query = options.args;
      inputData.code = options.args;
    }

    // Execute composition
    const result = await executeComposition(
      moduleName,
      inputData,
      ctx.provider,
      {
        cwd: ctx.cwd,
        maxDepth: options.maxDepth,
        timeoutMs: options.timeout
      }
    );

    if (options.verbose) {
      console.error('--- Composition Trace ---');
      for (const entry of result.trace) {
        const status = entry.success 
          ? (entry.skipped ? '⏭️ SKIPPED' : '✅ OK') 
          : '❌ FAILED';
        console.error(`${status} ${entry.module} (${entry.durationMs}ms)`);
        if (entry.reason) {
          console.error(`   Reason: ${entry.reason}`);
        }
      }
      console.error(`--- Total: ${result.totalTimeMs}ms ---`);
    }

    // Return result
    if (options.trace) {
      // Include full result with trace
      return {
        success: result.ok,
        data: {
          ok: result.ok,
          result: result.result,
          moduleResults: result.moduleResults,
          trace: result.trace,
          totalTimeMs: result.totalTimeMs,
          error: result.error
        }
      };
    } else if (options.pretty) {
      return {
        success: result.ok,
        data: result.result,
      };
    } else {
      // For non-pretty mode, return data (success) or error (failure)
      if (result.ok && result.result) {
        return {
          success: true,
          data: (result.result as { data?: unknown }).data,
        };
      } else {
        return {
          success: false,
          error: result.error 
            ? `${result.error.code}: ${result.error.message}` 
            : 'Composition failed',
          data: result.moduleResults,
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

/**
 * Show composition info for a module
 */
export async function composeInfo(
  moduleName: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  
  const module = await findModule(moduleName, searchPaths);
  if (!module) {
    return {
      success: false,
      error: `Module not found: ${moduleName}`,
    };
  }

  const composition = module.composition;
  if (!composition) {
    return {
      success: true,
      data: {
        name: module.name,
        hasComposition: false,
        message: 'Module does not have composition configuration'
      }
    };
  }

  return {
    success: true,
    data: {
      name: module.name,
      hasComposition: true,
      pattern: composition.pattern,
      requires: composition.requires?.map(d => ({
        name: d.name,
        version: d.version,
        optional: d.optional,
        fallback: d.fallback
      })),
      dataflowSteps: composition.dataflow?.length ?? 0,
      routingRules: composition.routing?.length ?? 0,
      maxDepth: composition.max_depth,
      timeoutMs: composition.timeout_ms,
      iteration: composition.iteration
    }
  };
}
