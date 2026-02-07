/**
 * cog run - Run a Cognitive Module
 * Always returns v2.2 envelope format for consistency
 */

import type { CommandContext, CommandResult } from '../types.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { CognitiveModule } from '../types.js';
import { findModule, getDefaultSearchPaths, loadSingleFileModule, runModule, runModuleStream } from '../modules/index.js';
import { ErrorCodes, attachContext, makeErrorEnvelope } from '../errors/index.js';

export interface RunOptions {
  args?: string;
  input?: string;
  noValidate?: boolean;
  pretty?: boolean;
  verbose?: boolean;
  stream?: boolean;
}

export async function run(
  moduleName: string,
  ctx: CommandContext,
  options: RunOptions = {}
): Promise<CommandResult> {
  // Allow "single-file modules": if moduleName resolves to a file, load it directly.
  let module: CognitiveModule | null = null;
  const candidatePath = path.resolve(ctx.cwd, moduleName);
  try {
    const st = await fs.stat(candidatePath);
    if (st.isFile()) {
      module = await loadSingleFileModule(candidatePath);
    }
  } catch {
    // Not a file path, fall back to module discovery.
  }

  const searchPaths = getDefaultSearchPaths(ctx.cwd);

  if (!module) {
    // Find module (directory-based)
    module = await findModule(moduleName, searchPaths);
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
  }

  try {
    // Parse input if provided as JSON
    let inputData: Record<string, unknown> | undefined;
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

    if (options.stream) {
      // Stream NDJSON events to stdout. Final exit code is determined by the end event.
      let finalOk: boolean | null = null;

      for await (const ev of runModuleStream(module, ctx.provider, {
        args: options.args,
        input: inputData,
        validateInput: !options.noValidate,
        validateOutput: !options.noValidate,
        useV22: true,
      })) {
        // Write each event as one JSON line (NDJSON).
        process.stdout.write(JSON.stringify(ev) + '\n');
        if (ev.type === 'end' && ev.result) {
          finalOk = Boolean((ev.result as { ok?: boolean }).ok);
        }
      }

      return {
        success: finalOk === true,
        data: { ok: finalOk === true },
      };
    } else {
      // Run module with v2.2 envelope format
      const result = await runModule(module, ctx.provider, {
        args: options.args,
        input: inputData,
        verbose: options.verbose || ctx.verbose,
        validateInput: !options.noValidate,
        validateOutput: !options.noValidate,
        useV22: true, // Always use v2.2 envelope
      });

      const output = attachContext(result as unknown as Record<string, unknown>, {
        module: moduleName,
        provider: ctx.provider.name,
      });

      // Always return full v2.2 envelope
      return {
        success: result.ok,
        data: output,
      };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const errorEnvelope = attachContext(makeErrorEnvelope({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      recoverable: false,
    }), { module: moduleName, provider: ctx.provider.name });
    return {
      success: false,
      error: message,
      data: errorEnvelope,
    };
  }
}
