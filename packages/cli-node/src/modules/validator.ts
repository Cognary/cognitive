/**
 * Module Validator - Validate cognitive module structure and examples.
 * Supports v0, v1, v2.1, and v2.2 module formats.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import yaml from 'js-yaml';
import _Ajv from 'ajv';
const Ajv = _Ajv.default || _Ajv;
import type { RiskLevel } from '../types.js';

const ajv = new Ajv({ allErrors: true, strict: false });

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Main Validation Entry Point
// =============================================================================

/**
 * Validate a cognitive module's structure and examples.
 * Supports all formats.
 * 
 * @param nameOrPath Module name or path
 * @param v22 If true, validate v2.2 specific requirements
 * @returns Validation result with errors and warnings
 */
export async function validateModule(
  modulePath: string,
  v22: boolean = false
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if path exists
  try {
    await fs.access(modulePath);
  } catch {
    return { valid: false, errors: [`Module not found: ${modulePath}`], warnings: [] };
  }
  
  // Detect format
  const hasModuleYaml = await fileExists(path.join(modulePath, 'module.yaml'));
  const hasModuleMd = await fileExists(path.join(modulePath, 'MODULE.md'));
  const hasOldModuleMd = await fileExists(path.join(modulePath, 'module.md'));
  
  if (hasModuleYaml) {
    // v2.x format
    if (v22) {
      return validateV22Format(modulePath);
    } else {
      return validateV2Format(modulePath);
    }
  } else if (hasModuleMd) {
    // v1 format
    if (v22) {
      errors.push("Module is v1 format. Use 'cogn migrate' to upgrade to v2.2");
      return { valid: false, errors, warnings };
    }
    return validateV1Format(modulePath);
  } else if (hasOldModuleMd) {
    // v0 format
    if (v22) {
      errors.push("Module is v0 format. Use 'cogn migrate' to upgrade to v2.2");
      return { valid: false, errors, warnings };
    }
    return validateV0Format(modulePath);
  } else {
    return { valid: false, errors: ['Missing module.yaml, MODULE.md, or module.md'], warnings: [] };
  }
}

// =============================================================================
// v2.2 Validation
// =============================================================================

async function validateV22Format(modulePath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check module.yaml
  const moduleYamlPath = path.join(modulePath, 'module.yaml');
  let manifest: Record<string, unknown>;
  
  try {
    const content = await fs.readFile(moduleYamlPath, 'utf-8');
    manifest = yaml.load(content) as Record<string, unknown>;
  } catch (e) {
    errors.push(`Invalid YAML in module.yaml: ${(e as Error).message}`);
    return { valid: false, errors, warnings };
  }
  
  // Check v2.2 required fields
  const v22RequiredFields = ['name', 'version', 'responsibility'];
  for (const field of v22RequiredFields) {
    if (!(field in manifest)) {
      errors.push(`module.yaml missing required field: ${field}`);
    }
  }
  
  // Check tier (v2.2 specific)
  const tier = manifest.tier as string | undefined;
  if (!tier) {
    warnings.push("module.yaml missing 'tier' (recommended: exec | decision | exploration)");
  } else if (!['exec', 'decision', 'exploration'].includes(tier)) {
    errors.push(`Invalid tier: ${tier}. Must be exec | decision | exploration`);
  }
  
  // Check schema_strictness
  const schemaStrictness = manifest.schema_strictness as string | undefined;
  if (schemaStrictness && !['high', 'medium', 'low'].includes(schemaStrictness)) {
    errors.push(`Invalid schema_strictness: ${schemaStrictness}. Must be high | medium | low`);
  }
  
  // Check overflow config
  const overflow = (manifest.overflow as Record<string, unknown>) ?? {};
  if (overflow.enabled) {
    if (overflow.require_suggested_mapping === undefined) {
      warnings.push("overflow.require_suggested_mapping not set (recommended for recoverable insights)");
    }
  }
  
  // Check enums config
  const enums = (manifest.enums as Record<string, unknown>) ?? {};
  const strategy = enums.strategy as string | undefined;
  if (strategy && !['strict', 'extensible'].includes(strategy)) {
    errors.push(`Invalid enums.strategy: ${strategy}. Must be strict | extensible`);
  }
  
  // Check compat config
  const compat = manifest.compat as Record<string, unknown> | undefined;
  if (!compat) {
    warnings.push("module.yaml missing 'compat' section (recommended for migration)");
  }
  
  // Check excludes
  const excludes = (manifest.excludes as string[]) ?? [];
  if (excludes.length === 0) {
    warnings.push("'excludes' list is empty (should list what module won't do)");
  }
  
  // Check prompt.md
  const promptPath = path.join(modulePath, 'prompt.md');
  if (!await fileExists(promptPath)) {
    errors.push("Missing prompt.md (required for v2.2)");
  } else {
    const prompt = await fs.readFile(promptPath, 'utf-8');
    
    // Check for v2.2 envelope format instructions
    if (!prompt.toLowerCase().includes('meta') && !prompt.toLowerCase().includes('envelope')) {
      warnings.push("prompt.md should mention v2.2 envelope format with meta/data separation");
    }
    
    if (prompt.length < 100) {
      warnings.push("prompt.md seems too short (< 100 chars)");
    }
  }
  
  // Check schema.json
  const schemaPath = path.join(modulePath, 'schema.json');
  if (!await fileExists(schemaPath)) {
    errors.push("Missing schema.json (required for v2.2)");
  } else {
    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent) as Record<string, unknown>;
      
      // Check for meta schema (v2.2 required)
      if (!('meta' in schema)) {
        errors.push("schema.json missing 'meta' schema (required for v2.2)");
      } else {
        const metaSchema = schema.meta as Record<string, unknown>;
        const metaRequired = (metaSchema.required as string[]) ?? [];
        
        if (!metaRequired.includes('confidence')) {
          errors.push("meta schema must require 'confidence'");
        }
        if (!metaRequired.includes('risk')) {
          errors.push("meta schema must require 'risk'");
        }
        if (!metaRequired.includes('explain')) {
          errors.push("meta schema must require 'explain'");
        }
        
        // Check explain maxLength
        const properties = (metaSchema.properties as Record<string, unknown>) ?? {};
        const explainProps = (properties.explain as Record<string, unknown>) ?? {};
        const maxLength = (explainProps.maxLength as number) ?? 999;
        if (maxLength > 280) {
          warnings.push("meta.explain should have maxLength <= 280");
        }
      }
      
      // Check for input schema
      if (!('input' in schema)) {
        warnings.push("schema.json missing 'input' definition");
      }
      
      // Check for data schema (v2.2 uses 'data' instead of 'output')
      if (!('data' in schema) && !('output' in schema)) {
        errors.push("schema.json missing 'data' (or 'output') definition");
      } else if ('data' in schema) {
        const dataSchema = schema.data as Record<string, unknown>;
        const dataRequired = (dataSchema.required as string[]) ?? [];
        
        if (!dataRequired.includes('rationale')) {
          warnings.push("data schema should require 'rationale' for audit");
        }
      }
      
      // Check for error schema
      if (!('error' in schema)) {
        warnings.push("schema.json missing 'error' definition");
      }
      
      // Check for $defs/extensions (v2.2 overflow)
      if (overflow.enabled) {
        const defs = (schema.$defs as Record<string, unknown>) ?? {};
        if (!('extensions' in defs)) {
          warnings.push("schema.json missing '$defs.extensions' (needed for overflow)");
        }
      }
      
    } catch (e) {
      errors.push(`Invalid JSON in schema.json: ${(e as Error).message}`);
    }
  }
  
  // Check tests directory
  const testsPath = path.join(modulePath, 'tests');
  if (!await fileExists(testsPath)) {
    warnings.push("Missing tests directory (recommended)");
  } else {
    // Check for v2.2 format in expected files
    try {
      const entries = await fs.readdir(testsPath);
      for (const entry of entries) {
        if (entry.endsWith('.expected.json')) {
          try {
            const expectedContent = await fs.readFile(path.join(testsPath, entry), 'utf-8');
            const expected = JSON.parse(expectedContent) as Record<string, unknown>;
            
            // Check if example uses v2.2 format
            const example = (expected.$example as Record<string, unknown>) ?? {};
            if (example.ok === true && !('meta' in example)) {
              warnings.push(`${entry}: $example missing 'meta' (v2.2 format)`);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch {
      // Skip if can't read tests directory
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// v2.x (non-strict) Validation
// =============================================================================

async function validateV2Format(modulePath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check module.yaml
  const moduleYamlPath = path.join(modulePath, 'module.yaml');
  let manifest: Record<string, unknown>;
  
  try {
    const content = await fs.readFile(moduleYamlPath, 'utf-8');
    manifest = yaml.load(content) as Record<string, unknown>;
  } catch (e) {
    errors.push(`Invalid YAML in module.yaml: ${(e as Error).message}`);
    return { valid: false, errors, warnings };
  }
  
  // Check required fields
  const requiredFields = ['name', 'version', 'responsibility'];
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      errors.push(`module.yaml missing required field: ${field}`);
    }
  }
  
  // Check excludes
  const excludes = (manifest.excludes as string[]) ?? [];
  if (excludes.length === 0) {
    warnings.push("'excludes' list is empty");
  }
  
  // Check prompt.md or MODULE.md
  const promptPath = path.join(modulePath, 'prompt.md');
  const moduleMdPath = path.join(modulePath, 'MODULE.md');
  
  if (!await fileExists(promptPath) && !await fileExists(moduleMdPath)) {
    errors.push("Missing prompt.md or MODULE.md");
  } else if (await fileExists(promptPath)) {
    const prompt = await fs.readFile(promptPath, 'utf-8');
    if (prompt.length < 50) {
      warnings.push("prompt.md seems too short (< 50 chars)");
    }
  }
  
  // Check schema.json
  const schemaPath = path.join(modulePath, 'schema.json');
  if (!await fileExists(schemaPath)) {
    warnings.push("Missing schema.json (recommended)");
  } else {
    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent) as Record<string, unknown>;
      
      if (!('input' in schema)) {
        warnings.push("schema.json missing 'input' definition");
      }
      
      // Accept both 'data' and 'output'
      if (!('data' in schema) && !('output' in schema)) {
        warnings.push("schema.json missing 'data' or 'output' definition");
      }
      
    } catch (e) {
      errors.push(`Invalid JSON in schema.json: ${(e as Error).message}`);
    }
  }
  
  // Check for v2.2 features and suggest upgrade
  if (!manifest.tier) {
    warnings.push("Consider adding 'tier' for v2.2 (use 'cogn validate --v22' for full check)");
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// v1 Format Validation (MODULE.md + schema.json)
// =============================================================================

async function validateV1Format(modulePath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check MODULE.md
  const moduleMdPath = path.join(modulePath, 'MODULE.md');
  
  try {
    const content = await fs.readFile(moduleMdPath, 'utf-8');
    
    if (content.length === 0) {
      errors.push("MODULE.md is empty");
      return { valid: false, errors, warnings };
    }
    
    // Parse frontmatter
    if (!content.startsWith('---')) {
      errors.push("MODULE.md must start with YAML frontmatter (---)");
    } else {
      const parts = content.split('---');
      if (parts.length < 3) {
        errors.push("MODULE.md frontmatter not properly closed");
      } else {
        try {
          const frontmatter = yaml.load(parts[1]) as Record<string, unknown>;
          const body = parts.slice(2).join('---').trim();
          
          // Check required fields
          const requiredFields = ['name', 'version', 'responsibility', 'excludes'];
          for (const field of requiredFields) {
            if (!(field in frontmatter)) {
              errors.push(`MODULE.md missing required field: ${field}`);
            }
          }
          
          if ('excludes' in frontmatter) {
            if (!Array.isArray(frontmatter.excludes)) {
              errors.push("'excludes' must be a list");
            } else if (frontmatter.excludes.length === 0) {
              warnings.push("'excludes' list is empty");
            }
          }
          
          // Check body has content
          if (body.length < 50) {
            warnings.push("MODULE.md body seems too short (< 50 chars)");
          }
          
        } catch (e) {
          errors.push(`Invalid YAML in MODULE.md: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Cannot read MODULE.md: ${(e as Error).message}`);
    return { valid: false, errors, warnings };
  }
  
  // Check schema.json
  const schemaPath = path.join(modulePath, 'schema.json');
  if (!await fileExists(schemaPath)) {
    warnings.push("Missing schema.json (recommended for validation)");
  } else {
    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent) as Record<string, unknown>;
      
      if (!('input' in schema)) {
        warnings.push("schema.json missing 'input' definition");
      }
      if (!('output' in schema)) {
        warnings.push("schema.json missing 'output' definition");
      }
      
      // Check output has required fields
      const output = (schema.output as Record<string, unknown>) ?? {};
      const required = (output.required as string[]) ?? [];
      if (!required.includes('confidence')) {
        warnings.push("output schema should require 'confidence'");
      }
      if (!required.includes('rationale')) {
        warnings.push("output schema should require 'rationale'");
      }
      
    } catch (e) {
      errors.push(`Invalid JSON in schema.json: ${(e as Error).message}`);
    }
  }
  
  // Check examples
  const examplesPath = path.join(modulePath, 'examples');
  if (!await fileExists(examplesPath)) {
    warnings.push("Missing examples directory (recommended)");
  } else {
    await validateExamples(examplesPath, path.join(modulePath, 'schema.json'), errors, warnings);
  }
  
  // Suggest v2.2 upgrade
  warnings.push("Consider upgrading to v2.2 format for better Control/Data separation");
  
  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// v0 Format Validation (6-file format)
// =============================================================================

async function validateV0Format(modulePath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required files
  const requiredFiles = [
    'module.md',
    'input.schema.json',
    'output.schema.json',
    'constraints.yaml',
    'prompt.txt',
  ];
  
  for (const filename of requiredFiles) {
    const filepath = path.join(modulePath, filename);
    if (!await fileExists(filepath)) {
      errors.push(`Missing required file: ${filename}`);
    } else {
      const stat = await fs.stat(filepath);
      if (stat.size === 0) {
        errors.push(`File is empty: ${filename}`);
      }
    }
  }
  
  // Check examples directory
  const examplesPath = path.join(modulePath, 'examples');
  if (!await fileExists(examplesPath)) {
    errors.push("Missing examples directory");
  } else {
    if (!await fileExists(path.join(examplesPath, 'input.json'))) {
      errors.push("Missing examples/input.json");
    }
    if (!await fileExists(path.join(examplesPath, 'output.json'))) {
      errors.push("Missing examples/output.json");
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // Validate module.md frontmatter
  try {
    const content = await fs.readFile(path.join(modulePath, 'module.md'), 'utf-8');
    
    if (!content.startsWith('---')) {
      errors.push("module.md must start with YAML frontmatter (---)");
    } else {
      const parts = content.split('---');
      if (parts.length < 3) {
        errors.push("module.md frontmatter not properly closed");
      } else {
        try {
          const frontmatter = yaml.load(parts[1]) as Record<string, unknown>;
          
          const requiredFields = ['name', 'version', 'responsibility', 'excludes'];
          for (const field of requiredFields) {
            if (!(field in frontmatter)) {
              errors.push(`module.md missing required field: ${field}`);
            }
          }
          
          if ('excludes' in frontmatter) {
            if (!Array.isArray(frontmatter.excludes)) {
              errors.push("'excludes' must be a list");
            } else if (frontmatter.excludes.length === 0) {
              warnings.push("'excludes' list is empty");
            }
          }
          
        } catch (e) {
          errors.push(`Invalid YAML in module.md: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Cannot read module.md: ${(e as Error).message}`);
  }
  
  // Suggest v2.2 upgrade
  warnings.push("v0 format is deprecated. Consider upgrading to v2.2");
  
  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Helper Functions
// =============================================================================

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function validateExamples(
  examplesPath: string,
  schemaPath: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  if (!await fileExists(path.join(examplesPath, 'input.json'))) {
    warnings.push("Missing examples/input.json");
  }
  if (!await fileExists(path.join(examplesPath, 'output.json'))) {
    warnings.push("Missing examples/output.json");
  }
  
  // Validate examples against schema if both exist
  if (await fileExists(schemaPath)) {
    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent) as Record<string, unknown>;
      
      // Validate input example
      const inputExamplePath = path.join(examplesPath, 'input.json');
      if (await fileExists(inputExamplePath) && 'input' in schema) {
        try {
          const inputContent = await fs.readFile(inputExamplePath, 'utf-8');
          const inputExample = JSON.parse(inputContent);
          
          const validate = ajv.compile(schema.input as object);
          const valid = validate(inputExample);
          if (!valid && validate.errors) {
            errors.push(`Example input fails schema: ${validate.errors[0]?.message}`);
          }
        } catch (e) {
          errors.push(`Invalid JSON in examples/input.json: ${(e as Error).message}`);
        }
      }
      
      // Validate output example
      const outputExamplePath = path.join(examplesPath, 'output.json');
      const outputSchema = (schema.output || schema.data) as object | undefined;
      if (await fileExists(outputExamplePath) && outputSchema) {
        try {
          const outputContent = await fs.readFile(outputExamplePath, 'utf-8');
          const outputExample = JSON.parse(outputContent) as Record<string, unknown>;
          
          const validate = ajv.compile(outputSchema);
          const valid = validate(outputExample);
          if (!valid && validate.errors) {
            errors.push(`Example output fails schema: ${validate.errors[0]?.message}`);
          }
          
          // Check confidence
          if ('confidence' in outputExample) {
            const conf = outputExample.confidence as number;
            if (conf < 0 || conf > 1) {
              errors.push(`Confidence must be 0-1, got: ${conf}`);
            }
          }
        } catch (e) {
          errors.push(`Invalid JSON in examples/output.json: ${(e as Error).message}`);
        }
      }
      
    } catch {
      // Skip if schema can't be read
    }
  }
}

// =============================================================================
// Envelope Validation
// =============================================================================

/**
 * Validate a response against v2.2 envelope format.
 * 
 * @param response The response dict to validate
 * @returns Validation result
 */
export function validateV22Envelope(response: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check ok field
  if (!('ok' in response)) {
    errors.push("Missing 'ok' field");
    return { valid: false, errors };
  }
  
  // Check meta
  if (!('meta' in response)) {
    errors.push("Missing 'meta' field (required for v2.2)");
  } else {
    const meta = response.meta as Record<string, unknown>;
    
    if (!('confidence' in meta)) {
      errors.push("meta missing 'confidence'");
    } else if (typeof meta.confidence !== 'number') {
      errors.push("meta.confidence must be a number");
    } else if (meta.confidence < 0 || meta.confidence > 1) {
      errors.push("meta.confidence must be between 0 and 1");
    }
    
    if (!('risk' in meta)) {
      errors.push("meta missing 'risk'");
    } else {
      const validRisks: RiskLevel[] = ['none', 'low', 'medium', 'high'];
      if (!validRisks.includes(meta.risk as RiskLevel)) {
        errors.push(`meta.risk must be none|low|medium|high, got: ${meta.risk}`);
      }
    }
    
    if (!('explain' in meta)) {
      errors.push("meta missing 'explain'");
    } else {
      const explain = (meta.explain as string) ?? '';
      if (explain.length > 280) {
        errors.push(`meta.explain exceeds 280 chars (${explain.length} chars)`);
      }
    }
  }
  
  // Check data or error
  if (response.ok) {
    if (!('data' in response)) {
      errors.push("Success response missing 'data' field");
    }
    // Note: data.rationale is recommended but not required by v2.2 envelope spec
    // The data schema validation will enforce it if the module specifies it as required
  } else {
    if (!('error' in response)) {
      errors.push("Error response missing 'error' field");
    } else {
      const error = response.error as Record<string, unknown>;
      if (!('code' in error)) {
        errors.push("error missing 'code'");
      }
      if (!('message' in error)) {
        errors.push("error missing 'message'");
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
