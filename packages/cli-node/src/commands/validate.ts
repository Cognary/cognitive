/**
 * cog validate - Validate a Cognitive Module's structure and examples
 * 
 * Aligns with Python CLI's `cog validate` command.
 */

import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths } from '../modules/index.js';
import { validateModule, type ValidationResult } from '../modules/validator.js';

export interface ValidateOptions {
  /** Enable strict v2.2 validation */
  v22?: boolean;
  /** Output format: 'text' or 'json' */
  format?: 'text' | 'json';
}

export interface ValidateResult {
  valid: boolean;
  modulePath: string;
  moduleName?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a cognitive module's structure and examples.
 * 
 * @param nameOrPath Module name or path
 * @param ctx Command context
 * @param options Validation options
 * @returns Validation result
 */
export async function validate(
  nameOrPath: string,
  ctx: CommandContext,
  options: ValidateOptions = {}
): Promise<CommandResult> {
  try {
    let modulePath: string;
    let moduleName: string | undefined;
    
    // Try to find as a named module first
    const searchPaths = getDefaultSearchPaths(ctx.cwd);
    const module = await findModule(nameOrPath, searchPaths);
    
    if (module) {
      modulePath = module.location;
      moduleName = module.name;
    } else {
      // Treat as a path
      modulePath = nameOrPath;
    }
    
    // Run validation
    const result = await validateModule(modulePath, options.v22 ?? false);
    
    const validateResult: ValidateResult = {
      valid: result.valid,
      modulePath,
      moduleName,
      errors: result.errors,
      warnings: result.warnings,
    };
    
    return {
      success: result.valid,
      data: validateResult,
      error: result.valid ? undefined : `Validation failed with ${result.errors.length} error(s)`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Validate all modules in the search paths.
 * 
 * @param ctx Command context
 * @param options Validation options
 * @returns Batch validation results
 */
export async function validateAll(
  ctx: CommandContext,
  options: ValidateOptions = {}
): Promise<CommandResult> {
  try {
    const { listModules } = await import('../modules/loader.js');
    const searchPaths = getDefaultSearchPaths(ctx.cwd);
    
    const modules = await listModules(searchPaths);
    const results: ValidateResult[] = [];
    let allValid = true;
    
    for (const module of modules) {
      const result = await validateModule(module.location, options.v22 ?? false);
      
      results.push({
        valid: result.valid,
        modulePath: module.location,
        moduleName: module.name,
        errors: result.errors,
        warnings: result.warnings,
      });
      
      if (!result.valid) {
        allValid = false;
      }
    }
    
    return {
      success: allValid,
      data: {
        total: modules.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        results,
      },
      error: allValid ? undefined : `${results.filter(r => !r.valid).length} module(s) failed validation`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
