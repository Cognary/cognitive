/**
 * cog migrate - Migrate modules to v2.2 format
 * 
 * Aligns with Python CLI's `cog migrate` command.
 * Performs migration from v0/v1/v2.1 to v2.2 format.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { CommandContext, CommandResult } from '../types.js';
import { findModule, getDefaultSearchPaths } from '../modules/index.js';

export interface MigrateOptions {
  /** Dry run - only show what would be done */
  dryRun?: boolean;
  /** Create backup before migration */
  backup?: boolean;
  /** Migrate all modules */
  all?: boolean;
}

export interface MigrateResult {
  moduleName: string;
  modulePath: string;
  success: boolean;
  changes: string[];
  warnings: string[];
}

/**
 * Migrate a single module to v2.2 format.
 */
export async function migrate(
  nameOrPath: string,
  ctx: CommandContext,
  options: MigrateOptions = {}
): Promise<CommandResult> {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  
  try {
    let modulePath: string;
    let moduleName: string;
    
    // Try to find as a named module first
    const searchPaths = getDefaultSearchPaths(ctx.cwd);
    const module = await findModule(nameOrPath, searchPaths);
    
    if (module) {
      modulePath = module.location;
      moduleName = module.name;
    } else {
      // Treat as a path
      modulePath = nameOrPath;
      moduleName = path.basename(nameOrPath);
    }
    
    // Check if path exists
    try {
      await fs.access(modulePath);
    } catch {
      return {
        success: false,
        error: `Module not found: ${modulePath}`,
      };
    }
    
    // Detect format and migrate
    const result = await migrateModule(modulePath, moduleName, dryRun, backup);
    
    return {
      success: result.success,
      data: result,
      error: result.success ? undefined : result.warnings.join('; '),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Migrate all modules to v2.2 format.
 */
export async function migrateAll(
  ctx: CommandContext,
  options: MigrateOptions = {}
): Promise<CommandResult> {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  
  try {
    const { listModules } = await import('../modules/loader.js');
    const searchPaths = getDefaultSearchPaths(ctx.cwd);
    
    const modules = await listModules(searchPaths);
    const results: MigrateResult[] = [];
    let allSuccess = true;
    
    for (const module of modules) {
      const result = await migrateModule(
        module.location,
        module.name,
        dryRun,
        backup
      );
      results.push(result);
      
      if (!result.success) {
        allSuccess = false;
      }
    }
    
    return {
      success: allSuccess,
      data: {
        total: modules.length,
        migrated: results.filter(r => r.success && r.changes.length > 0).length,
        skipped: results.filter(r => r.success && r.changes.length === 0).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// =============================================================================
// Internal Migration Logic
// =============================================================================

async function migrateModule(
  modulePath: string,
  moduleName: string,
  dryRun: boolean,
  backup: boolean
): Promise<MigrateResult> {
  const changes: string[] = [];
  const warnings: string[] = [];
  
  // Detect format
  const format = await detectFormat(modulePath);
  
  if (!format) {
    return {
      moduleName,
      modulePath,
      success: false,
      changes: [],
      warnings: ['Could not detect module format'],
    };
  }
  
  // Check if already v2.2
  if (format === 'v2') {
    const moduleYamlPath = path.join(modulePath, 'module.yaml');
    try {
      const content = await fs.readFile(moduleYamlPath, 'utf-8');
      const manifest = yaml.load(content) as Record<string, unknown>;
      if (manifest.tier !== undefined) {
        warnings.push('Module appears to already be v2.2 format');
        return { moduleName, modulePath, success: true, changes: [], warnings };
      }
    } catch {
      // Continue with migration
    }
  }
  
  // Create backup if needed
  if (backup && !dryRun) {
    const backupPath = await createBackup(modulePath);
    changes.push(`Created backup: ${backupPath}`);
  }
  
  // Perform migration based on format
  switch (format) {
    case 'v0':
      return migrateFromV0(modulePath, moduleName, dryRun, changes, warnings);
    case 'v1':
      return migrateFromV1(modulePath, moduleName, dryRun, changes, warnings);
    case 'v2':
      return migrateFromV2(modulePath, moduleName, dryRun, changes, warnings);
    default:
      return {
        moduleName,
        modulePath,
        success: false,
        changes: [],
        warnings: [`Unknown format: ${format}`],
      };
  }
}

async function detectFormat(modulePath: string): Promise<'v0' | 'v1' | 'v2' | null> {
  const hasModuleYaml = await fileExists(path.join(modulePath, 'module.yaml'));
  const hasModuleMd = await fileExists(path.join(modulePath, 'MODULE.md'));
  const hasOldModuleMd = await fileExists(path.join(modulePath, 'module.md'));
  
  if (hasModuleYaml) return 'v2';
  if (hasModuleMd) return 'v1';
  if (hasOldModuleMd) return 'v0';
  return null;
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function createBackup(modulePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
  const backupPath = `${modulePath}_backup_${timestamp}`;
  await fs.cp(modulePath, backupPath, { recursive: true });
  return backupPath;
}

// =============================================================================
// v0 Migration (6-file format)
// =============================================================================

async function migrateFromV0(
  modulePath: string,
  moduleName: string,
  dryRun: boolean,
  changes: string[],
  warnings: string[]
): Promise<MigrateResult> {
  warnings.push('v0 format migration requires manual review');
  
  try {
    // Load module.md
    const moduleMdPath = path.join(modulePath, 'module.md');
    const moduleMdContent = await fs.readFile(moduleMdPath, 'utf-8');
    const frontmatter = parseFrontmatter(moduleMdContent);
    
    // Load prompt
    const promptPath = path.join(modulePath, 'prompt.txt');
    const prompt = await fs.readFile(promptPath, 'utf-8');
    
    // Load schemas
    const inputSchemaPath = path.join(modulePath, 'input.schema.json');
    const outputSchemaPath = path.join(modulePath, 'output.schema.json');
    const inputSchema = JSON.parse(await fs.readFile(inputSchemaPath, 'utf-8'));
    const outputSchema = JSON.parse(await fs.readFile(outputSchemaPath, 'utf-8'));
    
    // Create v2.2 manifest
    const manifest = createV22Manifest(frontmatter);
    
    // Create combined schema
    const schema = createV22Schema(inputSchema, outputSchema);
    
    // Create prompt.md
    const promptMd = createV22Prompt(frontmatter, prompt);
    
    if (dryRun) {
      changes.push('[DRY RUN] Would create module.yaml');
      changes.push('[DRY RUN] Would create schema.json (combined)');
      changes.push('[DRY RUN] Would create prompt.md');
    } else {
      await writeYaml(path.join(modulePath, 'module.yaml'), manifest);
      changes.push('Created module.yaml');
      
      await writeJson(path.join(modulePath, 'schema.json'), schema);
      changes.push('Created schema.json (combined)');
      
      await fs.writeFile(path.join(modulePath, 'prompt.md'), promptMd);
      changes.push('Created prompt.md');
    }
    
    return { moduleName, modulePath, success: true, changes, warnings };
  } catch (e) {
    warnings.push(`Migration error: ${e instanceof Error ? e.message : e}`);
    return { moduleName, modulePath, success: false, changes, warnings };
  }
}

// =============================================================================
// v1 Migration (MODULE.md + schema.json)
// =============================================================================

async function migrateFromV1(
  modulePath: string,
  moduleName: string,
  dryRun: boolean,
  changes: string[],
  warnings: string[]
): Promise<MigrateResult> {
  try {
    // Load MODULE.md
    const moduleMdPath = path.join(modulePath, 'MODULE.md');
    const moduleMdContent = await fs.readFile(moduleMdPath, 'utf-8');
    const { frontmatter, body } = parseFrontmatterWithBody(moduleMdContent);
    
    // Load schema.json if exists
    const schemaPath = path.join(modulePath, 'schema.json');
    let inputSchema: Record<string, unknown> = {};
    let outputSchema: Record<string, unknown> = {};
    
    if (await fileExists(schemaPath)) {
      const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
      inputSchema = schema.input || {};
      outputSchema = schema.output || {};
    }
    
    // Create v2.2 manifest
    const manifest = createV22Manifest(frontmatter);
    
    // Create/update schema with meta
    const newSchema = createV22Schema(inputSchema, outputSchema);
    
    // Create prompt.md
    const promptMd = createV22Prompt(frontmatter, body);
    
    if (dryRun) {
      changes.push('[DRY RUN] Would create module.yaml');
      changes.push('[DRY RUN] Would update schema.json (add meta)');
      changes.push('[DRY RUN] Would create prompt.md');
    } else {
      await writeYaml(path.join(modulePath, 'module.yaml'), manifest);
      changes.push('Created module.yaml');
      
      await writeJson(path.join(modulePath, 'schema.json'), newSchema);
      changes.push('Updated schema.json (added meta)');
      
      await fs.writeFile(path.join(modulePath, 'prompt.md'), promptMd);
      changes.push('Created prompt.md');
      
      changes.push('Preserved MODULE.md (backward compatibility)');
    }
    
    return { moduleName, modulePath, success: true, changes, warnings };
  } catch (e) {
    warnings.push(`Migration error: ${e instanceof Error ? e.message : e}`);
    return { moduleName, modulePath, success: false, changes, warnings };
  }
}

// =============================================================================
// v2.0/v2.1 Migration
// =============================================================================

async function migrateFromV2(
  modulePath: string,
  moduleName: string,
  dryRun: boolean,
  changes: string[],
  warnings: string[]
): Promise<MigrateResult> {
  try {
    // Load module.yaml
    const moduleYamlPath = path.join(modulePath, 'module.yaml');
    const manifest = yaml.load(
      await fs.readFile(moduleYamlPath, 'utf-8')
    ) as Record<string, unknown>;
    
    // Load schema.json
    const schemaPath = path.join(modulePath, 'schema.json');
    let schema: Record<string, unknown> = {};
    if (await fileExists(schemaPath)) {
      schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
    }
    
    // Load prompt.md
    const promptPath = path.join(modulePath, 'prompt.md');
    let prompt = '';
    if (await fileExists(promptPath)) {
      prompt = await fs.readFile(promptPath, 'utf-8');
    }
    
    // Track changes
    const manifestChanges: string[] = [];
    const schemaChanges: string[] = [];
    const promptChanges: string[] = [];
    
    // Upgrade manifest to v2.2
    if (!('tier' in manifest)) {
      manifest.tier = 'decision';
      manifestChanges.push('Added tier: decision');
    }
    
    if (!('schema_strictness' in manifest)) {
      manifest.schema_strictness = 'medium';
      manifestChanges.push('Added schema_strictness: medium');
    }
    
    if (!('overflow' in manifest)) {
      const schemaStrictness = (manifest.schema_strictness as string) || 'medium';
      const strictnessMaxItems: Record<string, number> = { high: 0, medium: 5, low: 20 };
      const defaultMaxItems = strictnessMaxItems[schemaStrictness] ?? 5;
      const defaultEnabled = schemaStrictness !== 'high';
      
      manifest.overflow = {
        enabled: defaultEnabled,
        recoverable: true,
        max_items: defaultMaxItems,
        require_suggested_mapping: true,
      };
      manifestChanges.push(`Added overflow config (max_items=${defaultMaxItems})`);
    }
    
    if (!('enums' in manifest)) {
      manifest.enums = { strategy: 'extensible' };
      manifestChanges.push('Added enums config');
    }
    
    if (!('compat' in manifest)) {
      manifest.compat = {
        accepts_v21_payload: true,
        runtime_auto_wrap: true,
        schema_output_alias: 'data',
      };
      manifestChanges.push('Added compat config');
    }
    
    if (!('io' in manifest)) {
      manifest.io = {
        input: './schema.json#/input',
        data: './schema.json#/data',
        meta: './schema.json#/meta',
        error: './schema.json#/error',
      };
      manifestChanges.push('Added io references');
    }
    
    // Upgrade schema to v2.2
    if (!('meta' in schema)) {
      schema.meta = createMetaSchema();
      schemaChanges.push('Added meta schema');
    }
    
    if ('output' in schema && !('data' in schema)) {
      schema.data = schema.output;
      delete schema.output;
      schemaChanges.push('Renamed output to data');
    }
    
    if ('data' in schema) {
      const dataSchema = schema.data as Record<string, unknown>;
      const dataRequired = (dataSchema.required as string[]) || [];
      if (!dataRequired.includes('rationale')) {
        dataRequired.push('rationale');
        dataSchema.required = dataRequired;
        schemaChanges.push('Added rationale to data.required');
      }
    }
    
    const overflowConfig = manifest.overflow as Record<string, unknown> | undefined;
    if (overflowConfig?.enabled && !('$defs' in schema)) {
      schema.$defs = { extensions: createExtensionsSchema() };
      schemaChanges.push('Added $defs.extensions');
    }
    
    // Update prompt if needed
    if (!prompt.toLowerCase().includes('meta') || !prompt.toLowerCase().includes('envelope')) {
      prompt = addV22InstructionsToPrompt(prompt, manifest);
      promptChanges.push('Added v2.2 envelope instructions');
    }
    
    // Apply changes
    if (dryRun) {
      if (manifestChanges.length > 0) {
        changes.push(`[DRY RUN] Would update module.yaml: ${manifestChanges.join(', ')}`);
      }
      if (schemaChanges.length > 0) {
        changes.push(`[DRY RUN] Would update schema.json: ${schemaChanges.join(', ')}`);
      }
      if (promptChanges.length > 0) {
        changes.push(`[DRY RUN] Would update prompt.md: ${promptChanges.join(', ')}`);
      }
    } else {
      if (manifestChanges.length > 0) {
        await writeYaml(moduleYamlPath, manifest);
        changes.push(`Updated module.yaml: ${manifestChanges.join(', ')}`);
      }
      
      if (schemaChanges.length > 0) {
        await writeJson(schemaPath, schema);
        changes.push(`Updated schema.json: ${schemaChanges.join(', ')}`);
      }
      
      if (promptChanges.length > 0) {
        await fs.writeFile(promptPath, prompt);
        changes.push(`Updated prompt.md: ${promptChanges.join(', ')}`);
      }
    }
    
    return { moduleName, modulePath, success: true, changes, warnings };
  } catch (e) {
    warnings.push(`Migration error: ${e instanceof Error ? e.message : e}`);
    return { moduleName, modulePath, success: false, changes, warnings };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseFrontmatter(content: string): Record<string, unknown> {
  if (!content.startsWith('---')) {
    return {};
  }
  
  const parts = content.split('---');
  if (parts.length < 3) {
    return {};
  }
  
  try {
    return yaml.load(parts[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseFrontmatterWithBody(content: string): { frontmatter: Record<string, unknown>; body: string } {
  if (!content.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }
  
  const parts = content.split('---');
  if (parts.length < 3) {
    return { frontmatter: {}, body: content };
  }
  
  try {
    return {
      frontmatter: yaml.load(parts[1]) as Record<string, unknown>,
      body: parts.slice(2).join('---').trim(),
    };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

function createV22Manifest(frontmatter: Record<string, unknown>): Record<string, unknown> {
  return {
    name: frontmatter.name || 'unknown',
    version: frontmatter.version || '2.2.0',
    responsibility: frontmatter.responsibility || '',
    tier: 'decision',
    schema_strictness: 'medium',
    excludes: frontmatter.excludes || [],
    policies: {
      network: 'deny',
      filesystem_write: 'deny',
      side_effects: 'deny',
      code_execution: 'deny',
    },
    tools: {
      policy: 'deny_by_default',
      allowed: [],
      denied: ['write_file', 'shell', 'network'],
    },
    overflow: {
      enabled: true,
      recoverable: true,
      max_items: 5,
      require_suggested_mapping: true,
    },
    enums: {
      strategy: 'extensible',
    },
    failure: {
      contract: 'error_union',
      partial_allowed: true,
      must_return_error_schema: true,
    },
    runtime_requirements: {
      structured_output: true,
      max_input_tokens: 8000,
      preferred_capabilities: ['json_mode'],
    },
    io: {
      input: './schema.json#/input',
      data: './schema.json#/data',
      meta: './schema.json#/meta',
      error: './schema.json#/error',
    },
    compat: {
      accepts_v21_payload: true,
      runtime_auto_wrap: true,
      schema_output_alias: 'data',
    },
    ...(frontmatter.constraints ? { constraints: frontmatter.constraints } : {}),
    ...(frontmatter.context ? { context: frontmatter.context } : {}),
  };
}

function createV22Schema(
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>
): Record<string, unknown> {
  return {
    $schema: 'https://ziel-io.github.io/cognitive-modules/schema/v2.2.json',
    meta: createMetaSchema(),
    input: inputSchema,
    data: addRationaleToOutput(outputSchema),
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    $defs: {
      extensions: createExtensionsSchema(),
    },
  };
}

function createMetaSchema(): Record<string, unknown> {
  return {
    type: 'object',
    required: ['confidence', 'risk', 'explain'],
    properties: {
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score, unified across all modules',
      },
      risk: {
        type: 'string',
        enum: ['none', 'low', 'medium', 'high'],
        description: 'Aggregated risk level',
      },
      explain: {
        type: 'string',
        maxLength: 280,
        description: 'Short explanation for control plane',
      },
      trace_id: { type: 'string' },
      model: { type: 'string' },
      latency_ms: { type: 'number', minimum: 0 },
    },
  };
}

function createExtensionsSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          required: ['text', 'suggested_mapping'],
          properties: {
            text: { type: 'string' },
            suggested_mapping: { type: 'string' },
            evidence: { type: 'string' },
          },
        },
      },
    },
  };
}

function addRationaleToOutput(outputSchema: Record<string, unknown>): Record<string, unknown> {
  const schema = { ...outputSchema };
  
  // Ensure required includes rationale
  const required = (schema.required as string[]) || [];
  if (!required.includes('rationale')) {
    required.push('rationale');
  }
  schema.required = required;
  
  // Ensure properties includes rationale
  const properties = (schema.properties as Record<string, unknown>) || {};
  if (!properties.rationale) {
    properties.rationale = {
      type: 'string',
      description: 'Detailed explanation for audit and human review',
    };
  }
  
  // Add extensions reference
  if (!properties.extensions) {
    properties.extensions = { $ref: '#/$defs/extensions' };
  }
  
  schema.properties = properties;
  return schema;
}

function createV22Prompt(frontmatter: Record<string, unknown>, promptBody: string): string {
  const name = (frontmatter.name as string) || 'Module';
  const title = name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return `# ${title}

${promptBody}

## Response Format (Envelope v2.2)

You MUST wrap your response in the v2.2 envelope format with separate meta and data sections.

### Success Response

\`\`\`json
{
  "ok": true,
  "meta": {
    "confidence": 0.9,
    "risk": "low",
    "explain": "Short summary (max 280 chars) for routing and UI display."
  },
  "data": {
    "...your output fields...",
    "rationale": "Detailed explanation for audit and human review..."
  }
}
\`\`\`

### Error Response

\`\`\`json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "Brief error summary."
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Detailed error description"
  }
}
\`\`\`

## Important

- \`meta.explain\` is for **quick decisions** (≤280 chars)
- \`data.rationale\` is for **audit and review** (no limit)
- Both must be present in successful responses
`;
}

function addV22InstructionsToPrompt(prompt: string, _manifest: Record<string, unknown>): string {
  const v22Section = `

## Response Format (Envelope v2.2)

You MUST wrap your response in the v2.2 envelope format with separate meta and data sections:

- Success: \`{ "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "≤280 chars" }, "data": { ...payload... } }\`
- Error: \`{ "ok": false, "meta": { ... }, "error": { "code": "...", "message": "..." } }\`

Important:
- \`meta.explain\` is for quick routing (≤280 chars)
- \`data.rationale\` is for detailed audit (no limit)
`;
  return prompt + v22Section;
}

async function writeYaml(filepath: string, data: Record<string, unknown>): Promise<void> {
  const content = '# Cognitive Module Manifest v2.2\n' + yaml.dump(data, {
    noRefs: true,
    sortKeys: false,
    lineWidth: 100,
  });
  await fs.writeFile(filepath, content);
}

async function writeJson(filepath: string, data: Record<string, unknown>): Promise<void> {
  await fs.writeFile(filepath, JSON.stringify(data, null, 2) + '\n');
}
