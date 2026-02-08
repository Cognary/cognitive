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
import { ErrorCodes, attachContext, makeErrorEnvelope } from '../errors/index.js';
import { writeAuditRecord } from '../audit.js';

function looksLikeCode(str: string): boolean {
  const codeIndicators = [
    /^(def|function|class|const|let|var|import|export|public|private)\s/,
    /[{};()]/,
    /=>/,
    /\.(py|js|ts|go|rs|java|cpp|c|rb)$/,
  ];
  return codeIndicators.some(re => re.test(str));
}

export interface ComposeOptions {
  /** Direct text input */
  args?: string;
  /** JSON input data */
  input?: string;
  /** Disable validation */
  noValidate?: boolean;
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
    const errorEnvelope = attachContext(makeErrorEnvelope({
      code: ErrorCodes.MODULE_NOT_FOUND,
      message: `Module not found: ${moduleName}\nSearch paths: ${searchPaths.join(', ')}`,
      suggestion: "Use 'cog list' to see installed modules or 'cog search' to find modules in registry",
    }), { module: moduleName, provider: ctx.provider.name });
    return {
      success: false,
      error: errorEnvelope.error.message,
      data: errorEnvelope,
    };
  }

  if (ctx.policy?.requireV22) {
    if (module.formatVersion !== 'v2.2') {
      const errorEnvelope = attachContext(makeErrorEnvelope({
        code: ErrorCodes.INVALID_INPUT,
        message: `Certified profile requires v2.2 modules; got: ${module.formatVersion ?? 'unknown'} (${module.format})`,
        suggestion: "Migrate the module to v2.2, or rerun with `--profile standard`",
      }), { module: moduleName, provider: ctx.provider.name });
      return { success: false, error: errorEnvelope.error.message, data: errorEnvelope };
    }
  }

  try {
    const policy = ctx.policy;
    const startedAt = Date.now();

    // Parse input if provided as JSON
    let inputData: Record<string, unknown> = {};
    if (options.input) {
      try {
        inputData = JSON.parse(options.input);
      } catch {
        const errorEnvelope = attachContext(makeErrorEnvelope({
          code: ErrorCodes.INVALID_INPUT,
          message: `Invalid JSON input: ${options.input}`,
          suggestion: 'Ensure input is valid JSON format',
        }), { module: moduleName, provider: ctx.provider.name });
        return {
          success: false,
          error: errorEnvelope.error.message,
          data: errorEnvelope,
        };
      }
    }
    
    // Handle --args as text input
    if (options.args) {
      if (looksLikeCode(options.args)) {
        inputData.code = options.args;
      } else {
        inputData.query = options.args;
      }
    }

    // Execute composition
    const result = await executeComposition(
      moduleName,
      inputData,
      ctx.provider,
      {
        cwd: ctx.cwd,
        maxDepth: options.maxDepth,
        timeoutMs: options.timeout,
        policy,
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

    if (!result.ok) {
      const partialData = options.trace
        ? { moduleResults: result.moduleResults, trace: result.trace }
        : { moduleResults: result.moduleResults };
      const errorEnvelope = attachContext(makeErrorEnvelope({
        code: result.error?.code ?? ErrorCodes.INTERNAL_ERROR,
        message: result.error?.message ?? 'Composition failed',
        details: result.error?.module ? { module: result.error.module } : undefined,
        partial_data: partialData,
      }), { module: moduleName, provider: ctx.provider.name });
      return {
        success: false,
        error: errorEnvelope.error.message,
        data: errorEnvelope,
      };
    }

    if (policy?.audit) {
      const rec = await writeAuditRecord({
        ts: new Date().toISOString(),
        kind: 'compose',
        policy,
        provider: ctx.provider.name,
        module: { name: module.name, version: module.version, location: module.location, formatVersion: module.formatVersion },
        input: inputData,
        result: {
          ok: result.ok,
          result: result.result,
          moduleResults: result.moduleResults,
          trace: result.trace,
          totalTimeMs: result.totalTimeMs,
          error: result.error,
        },
        notes: [`duration_ms=${Date.now() - startedAt}`],
      });
      if (rec) {
        console.error(`Audit: ${rec.path}`);
      }
    }

    // Return result
    if (options.trace) {
      // Include full result with trace
      return {
        success: true,
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
        success: true,
        data: result.result,
      };
    } else {
      // Keep compose output consistent with run/pipe: always return full v2.2 envelope
      return {
        success: true,
        data: result.result,
      };
    }
  } catch (e) {
    const errorEnvelope = attachContext(makeErrorEnvelope({
      code: ErrorCodes.INTERNAL_ERROR,
      message: e instanceof Error ? e.message : String(e),
      recoverable: false,
    }), { module: moduleName, provider: ctx.provider.name });
    return {
      success: false,
      error: errorEnvelope.error.message,
      data: errorEnvelope,
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
