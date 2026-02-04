/**
 * Module Loader - Load and parse Cognitive Modules
 * Supports v0 (6-file), v1 (MODULE.md) and v2 (module.yaml + prompt.md) formats
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { 
  CognitiveModule, 
  ModuleConstraints, 
  ModulePolicies, 
  ToolsPolicy, 
  OutputContract, 
  FailureContract, 
  RuntimeRequirements,
  OverflowConfig,
  EnumConfig,
  CompatConfig,
  MetaConfig,
  ModuleTier,
  SchemaStrictness,
  CompositionConfig,
  CompositionPattern,
  DependencyDeclaration,
  DataflowStep,
  RoutingRule,
  AggregationStrategy,
  IterationConfig
} from '../types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?/;

/**
 * Detect module format version
 */
async function detectFormat(modulePath: string): Promise<'v0' | 'v1' | 'v2'> {
  const v2Manifest = path.join(modulePath, 'module.yaml');
  const v1Module = path.join(modulePath, 'MODULE.md');
  const v0Module = path.join(modulePath, 'module.md');
  
  try {
    await fs.access(v2Manifest);
    return 'v2';
  } catch {
    try {
      await fs.access(v1Module);
      return 'v1';
    } catch {
      try {
        await fs.access(v0Module);
        return 'v0';
      } catch {
        throw new Error(`No module.yaml, MODULE.md, or module.md found in ${modulePath}`);
      }
    }
  }
}

/**
 * Detect v2.x sub-version from manifest
 */
function detectV2Version(manifest: Record<string, unknown>): string {
  if (manifest.tier || manifest.overflow || manifest.enums) {
    return 'v2.2';
  }
  if (manifest.policies || manifest.failure) {
    return 'v2.1';
  }
  return 'v2.0';
}

/**
 * Load v2 format module (module.yaml + prompt.md)
 */
async function loadModuleV2(modulePath: string): Promise<CognitiveModule> {
  const manifestFile = path.join(modulePath, 'module.yaml');
  const promptFile = path.join(modulePath, 'prompt.md');
  const schemaFile = path.join(modulePath, 'schema.json');

  // Read module.yaml
  const manifestContent = await fs.readFile(manifestFile, 'utf-8');
  const manifest = yaml.load(manifestContent) as Record<string, unknown>;

  // Detect v2.x version
  const formatVersion = detectV2Version(manifest);

  // Read prompt.md
  let prompt = '';
  try {
    prompt = await fs.readFile(promptFile, 'utf-8');
  } catch {
    // prompt.md is optional, manifest may include inline prompt
  }

  // Read schema.json
  let inputSchema: object | undefined;
  let outputSchema: object | undefined;
  let dataSchema: object | undefined;
  let metaSchema: object | undefined;
  let errorSchema: object | undefined;
  
  try {
    const schemaContent = await fs.readFile(schemaFile, 'utf-8');
    const schema = JSON.parse(schemaContent);
    inputSchema = schema.input;
    // Support both "data" (v2.2) and "output" (v2.1) aliases
    dataSchema = schema.data || schema.output;
    outputSchema = dataSchema; // Backward compat
    metaSchema = schema.meta;
    errorSchema = schema.error;
  } catch {
    // Schema file is optional but recommended
  }

  // Extract v2.2 fields
  const tier = manifest.tier as ModuleTier | undefined;
  const schemaStrictness = (manifest.schema_strictness as SchemaStrictness) || 'medium';
  
  // Determine default max_items based on strictness (SPEC-v2.2)
  const strictnessMaxItems: Record<SchemaStrictness, number> = {
    high: 0,
    medium: 5,
    low: 20
  };
  const defaultMaxItems = strictnessMaxItems[schemaStrictness] ?? 5;
  const defaultEnabled = schemaStrictness !== 'high';
  
  // Parse overflow config with strictness-based defaults
  const overflowRaw = (manifest.overflow as Record<string, unknown>) || {};
  const overflow: OverflowConfig = {
    enabled: (overflowRaw.enabled as boolean) ?? defaultEnabled,
    recoverable: (overflowRaw.recoverable as boolean) ?? true,
    max_items: (overflowRaw.max_items as number) ?? defaultMaxItems,
    require_suggested_mapping: (overflowRaw.require_suggested_mapping as boolean) ?? true
  };
  
  // Parse enums config
  const enumsRaw = (manifest.enums as Record<string, unknown>) || {};
  const enums: EnumConfig = {
    strategy: (enumsRaw.strategy as 'strict' | 'extensible') ?? 
      (tier === 'exec' ? 'strict' : 'extensible'),
    unknown_tag: (enumsRaw.unknown_tag as string) ?? 'custom'
  };
  
  // Parse compat config
  const compatRaw = (manifest.compat as Record<string, unknown>) || {};
  const compat: CompatConfig = {
    accepts_v21_payload: (compatRaw.accepts_v21_payload as boolean) ?? true,
    runtime_auto_wrap: (compatRaw.runtime_auto_wrap as boolean) ?? true,
    schema_output_alias: (compatRaw.schema_output_alias as 'data' | 'output') ?? 'data'
  };
  
  // Parse meta config (including risk_rule) with validation
  const metaRaw = (manifest.meta as Record<string, unknown>) || {};
  const rawRiskRule = metaRaw.risk_rule as string | undefined;
  const validRiskRules = ['max_changes_risk', 'max_issues_risk', 'explicit'];
  const validatedRiskRule = rawRiskRule && validRiskRules.includes(rawRiskRule)
    ? rawRiskRule as 'max_changes_risk' | 'max_issues_risk' | 'explicit'
    : undefined;
  
  const metaConfig: MetaConfig = {
    required: metaRaw.required as string[] | undefined,
    risk_rule: validatedRiskRule,
  };

  // Parse composition config (v2.2)
  const compositionRaw = manifest.composition as Record<string, unknown> | undefined;
  let composition: CompositionConfig | undefined;
  
  if (compositionRaw) {
    // Parse pattern
    const pattern = compositionRaw.pattern as CompositionPattern ?? 'sequential';
    
    // Parse requires (dependencies)
    const requiresRaw = compositionRaw.requires as Array<Record<string, unknown>> | undefined;
    const requires: DependencyDeclaration[] | undefined = requiresRaw?.map(dep => ({
      name: dep.name as string,
      version: dep.version as string | undefined,
      optional: dep.optional as boolean | undefined,
      fallback: dep.fallback as string | null | undefined,
      timeout_ms: dep.timeout_ms as number | undefined
    }));
    
    // Parse dataflow
    const dataflowRaw = compositionRaw.dataflow as Array<Record<string, unknown>> | undefined;
    const dataflow: DataflowStep[] | undefined = dataflowRaw?.map(step => ({
      from: step.from as string | string[],
      to: step.to as string | string[],
      mapping: step.mapping as Record<string, string> | undefined,
      condition: step.condition as string | undefined,
      aggregate: step.aggregate as AggregationStrategy | undefined,
      aggregator: step.aggregator as string | undefined
    }));
    
    // Parse routing rules
    const routingRaw = compositionRaw.routing as Array<Record<string, unknown>> | undefined;
    const routing: RoutingRule[] | undefined = routingRaw?.map(rule => ({
      condition: rule.condition as string,
      next: rule.next as string | null
    }));
    
    // Parse iteration config
    const iterationRaw = compositionRaw.iteration as Record<string, unknown> | undefined;
    const iteration: IterationConfig | undefined = iterationRaw ? {
      max_iterations: iterationRaw.max_iterations as number | undefined,
      continue_condition: iterationRaw.continue_condition as string | undefined,
      stop_condition: iterationRaw.stop_condition as string | undefined
    } : undefined;
    
    composition = {
      pattern,
      requires,
      dataflow,
      routing,
      max_depth: compositionRaw.max_depth as number | undefined,
      timeout_ms: compositionRaw.timeout_ms as number | undefined,
      iteration
    };
  }

  return {
    name: manifest.name as string || path.basename(modulePath),
    version: manifest.version as string || '1.0.0',
    responsibility: manifest.responsibility as string || '',
    excludes: (manifest.excludes as string[]) || [],
    constraints: manifest.constraints as ModuleConstraints | undefined,
    policies: manifest.policies as ModulePolicies | undefined,
    tools: manifest.tools as ToolsPolicy | undefined,
    output: manifest.output as OutputContract | undefined,
    failure: manifest.failure as FailureContract | undefined,
    runtimeRequirements: manifest.runtime_requirements as RuntimeRequirements | undefined,
    // v2.2 fields
    tier,
    schemaStrictness,
    overflow,
    enums,
    compat,
    metaConfig,
    composition,
    // Context and prompt
    context: manifest.context as 'fork' | 'main' | undefined,
    prompt,
    // Schemas
    inputSchema,
    outputSchema,
    dataSchema,
    metaSchema,
    errorSchema,
    // Metadata
    location: modulePath,
    format: 'v2',
    formatVersion,
  };
}

/**
 * Load v1 format module (MODULE.md with frontmatter)
 */
async function loadModuleV1(modulePath: string): Promise<CognitiveModule> {
  const moduleFile = path.join(modulePath, 'MODULE.md');
  const schemaFile = path.join(modulePath, 'schema.json');

  // Read MODULE.md
  const moduleContent = await fs.readFile(moduleFile, 'utf-8');
  
  // Parse frontmatter
  const match = moduleContent.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error(`Invalid MODULE.md: missing YAML frontmatter in ${moduleFile}`);
  }

  const frontmatter = yaml.load(match[1]) as Record<string, unknown>;
  const prompt = (match[2] || '').trim();

  // Read schema.json
  let inputSchema: object | undefined;
  let outputSchema: object | undefined;
  
  try {
    const schemaContent = await fs.readFile(schemaFile, 'utf-8');
    const schema = JSON.parse(schemaContent);
    inputSchema = schema.input;
    outputSchema = schema.output;
  } catch {
    // Schema file is optional
  }

  // Extract constraints from v1 format
  const constraints: ModuleConstraints = {};
  const v1Constraints = frontmatter.constraints as Record<string, boolean> | undefined;
  if (v1Constraints) {
    constraints.no_network = v1Constraints.no_network;
    constraints.no_side_effects = v1Constraints.no_side_effects;
    constraints.no_inventing_data = v1Constraints.no_inventing_data;
  }

  return {
    name: frontmatter.name as string || path.basename(modulePath),
    version: frontmatter.version as string || '1.0.0',
    responsibility: frontmatter.responsibility as string || '',
    excludes: (frontmatter.excludes as string[]) || [],
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    context: frontmatter.context as 'fork' | 'main' | undefined,
    prompt,
    inputSchema,
    outputSchema,
    location: modulePath,
    format: 'v1',
  };
}

/**
 * Load v0 format module (6-file format - deprecated)
 */
async function loadModuleV0(modulePath: string): Promise<CognitiveModule> {
  // Read module.md
  const moduleFile = path.join(modulePath, 'module.md');
  const moduleContent = await fs.readFile(moduleFile, 'utf-8');
  
  // Parse frontmatter
  const match = moduleContent.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error(`Invalid module.md: missing YAML frontmatter in ${moduleFile}`);
  }

  const metadata = yaml.load(match[1]) as Record<string, unknown>;
  
  // Read schemas
  const inputSchemaFile = path.join(modulePath, 'input.schema.json');
  const outputSchemaFile = path.join(modulePath, 'output.schema.json');
  const constraintsFile = path.join(modulePath, 'constraints.yaml');
  const promptFile = path.join(modulePath, 'prompt.txt');
  
  const inputSchemaContent = await fs.readFile(inputSchemaFile, 'utf-8');
  const inputSchema = JSON.parse(inputSchemaContent);
  
  const outputSchemaContent = await fs.readFile(outputSchemaFile, 'utf-8');
  const outputSchema = JSON.parse(outputSchemaContent);
  
  // Load constraints
  const constraintsContent = await fs.readFile(constraintsFile, 'utf-8');
  const constraintsRaw = yaml.load(constraintsContent) as Record<string, unknown>;
  
  // Load prompt
  const prompt = await fs.readFile(promptFile, 'utf-8');
  
  // Extract constraints
  const constraints: ModuleConstraints = {};
  if (constraintsRaw) {
    const operational = (constraintsRaw.operational as Record<string, boolean>) ?? {};
    constraints.no_network = operational.no_external_network;
    constraints.no_side_effects = operational.no_side_effects;
    constraints.no_file_write = operational.no_file_write;
    constraints.no_inventing_data = operational.no_inventing_data;
  }

  return {
    name: metadata.name as string || path.basename(modulePath),
    version: metadata.version as string || '1.0.0',
    responsibility: metadata.responsibility as string || '',
    excludes: (metadata.excludes as string[]) || [],
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    prompt,
    inputSchema,
    outputSchema,
    dataSchema: outputSchema, // Alias for v2.2 compat
    // v2.2 defaults for v0 modules
    schemaStrictness: 'medium',
    overflow: { enabled: false },
    enums: { strategy: 'strict' },
    compat: { accepts_v21_payload: true, runtime_auto_wrap: true },
    // Metadata
    location: modulePath,
    format: 'v0',
    formatVersion: 'v0.0',
  };
}

/**
 * Load a Cognitive Module (auto-detects format)
 */
export async function loadModule(modulePath: string): Promise<CognitiveModule> {
  const format = await detectFormat(modulePath);
  
  if (format === 'v2') {
    return loadModuleV2(modulePath);
  } else if (format === 'v1') {
    return loadModuleV1(modulePath);
  } else {
    return loadModuleV0(modulePath);
  }
}

/**
 * Check if a directory contains a valid module
 */
async function isValidModule(modulePath: string): Promise<boolean> {
  const v2Manifest = path.join(modulePath, 'module.yaml');
  const v1Module = path.join(modulePath, 'MODULE.md');
  const v0Module = path.join(modulePath, 'module.md');
  
  try {
    await fs.access(v2Manifest);
    return true;
  } catch {
    try {
      await fs.access(v1Module);
      return true;
    } catch {
      try {
        await fs.access(v0Module);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export async function findModule(name: string, searchPaths: string[]): Promise<CognitiveModule | null> {
  for (const basePath of searchPaths) {
    const modulePath = path.join(basePath, name);
    
    if (await isValidModule(modulePath)) {
      return await loadModule(modulePath);
    }
  }
  
  return null;
}

export async function listModules(searchPaths: string[]): Promise<CognitiveModule[]> {
  const modules: CognitiveModule[] = [];
  
  for (const basePath of searchPaths) {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const modulePath = path.join(basePath, entry.name);
          
          if (await isValidModule(modulePath)) {
            try {
              const module = await loadModule(modulePath);
              modules.push(module);
            } catch {
              // Skip invalid modules
            }
          }
        }
      }
    } catch {
      // Path doesn't exist, skip
    }
  }
  
  return modules;
}

export function getDefaultSearchPaths(cwd: string): string[] {
  const home = process.env.HOME || '';
  return [
    path.join(cwd, 'cognitive', 'modules'),
    path.join(cwd, '.cognitive', 'modules'),
    path.join(home, '.cognitive', 'modules'),
  ];
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get module tier (exec, decision, exploration).
 */
export function getModuleTier(module: CognitiveModule): ModuleTier | undefined {
  return module.tier;
}

/**
 * Get schema strictness level.
 */
export function getSchemaStrictness(module: CognitiveModule): SchemaStrictness {
  return module.schemaStrictness ?? 'medium';
}

/**
 * Check if overflow (extensions.insights) is enabled.
 */
export function isOverflowEnabled(module: CognitiveModule): boolean {
  return module.overflow?.enabled ?? false;
}

/**
 * Get enum extension strategy.
 */
export function getEnumStrategy(module: CognitiveModule): 'strict' | 'extensible' {
  return module.enums?.strategy ?? 'strict';
}

/**
 * Check if runtime should auto-wrap v2.1 to v2.2.
 */
export function shouldAutoWrap(module: CognitiveModule): boolean {
  return module.compat?.runtime_auto_wrap ?? true;
}
