/**
 * cog pipe - Pipe mode for stdin/stdout integration
 * Always returns v2.2 envelope format for consistency
 */

import * as readline from 'node:readline';
import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths, runModule } from '../modules/index.js';
import { ErrorCodes, attachContext, makeErrorEnvelope } from '../errors/index.js';
import { writeAuditRecord } from '../audit.js';

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
    const errorEnvelope = attachContext(makeErrorEnvelope({
      code: ErrorCodes.MODULE_NOT_FOUND,
      message: `Module not found: ${options.module}`,
      suggestion: "Use 'cog list' to see installed modules",
    }), { module: options.module, provider: ctx.provider.name });
    console.log(JSON.stringify(errorEnvelope));
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
      }), { module: options.module, provider: ctx.provider.name });
      console.log(JSON.stringify(errorEnvelope));
      return { success: false, error: errorEnvelope.error.message, data: errorEnvelope };
    }
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
    const policy = ctx.policy;
    const startedAt = Date.now();

    // Check if input is JSON
    let inputData: Record<string, unknown> | undefined;
    try {
      inputData = JSON.parse(input);
    } catch {
      // Not JSON, use as args
    }

    // Run module with v2.2 envelope format
    const result = await runModule(module, ctx.provider, {
      args: inputData ? undefined : input,
      input: inputData,
      useV22: true,  // Always use v2.2 envelope
      policy,
    });

    const output = attachContext(result as unknown as Record<string, unknown>, {
      module: options.module,
      provider: ctx.provider.name,
    });

    if (policy?.audit) {
      const rec = await writeAuditRecord({
        ts: new Date().toISOString(),
        kind: 'pipe',
        policy,
        provider: ctx.provider.name,
        module: { name: module.name, version: module.version, location: module.location, formatVersion: module.formatVersion },
        input: { raw: input, parsed: inputData },
        result: output,
        notes: [`duration_ms=${Date.now() - startedAt}`],
      });
      if (rec) {
        console.error(`Audit: ${rec.path}`);
      }
    }

    // Output v2.2 envelope format to stdout
    console.log(JSON.stringify(output));

    return {
      success: result.ok,
      data: output,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Output v2.2 compliant error envelope
    const errorEnvelope = attachContext(makeErrorEnvelope({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      recoverable: false,
    }), { module: options.module, provider: ctx.provider.name });
    console.log(JSON.stringify(errorEnvelope));
    return {
      success: false,
      error: message,
      data: errorEnvelope,
    };
  }
}
