/**
 * Module Loader - Load and parse Cognitive Modules
 * Supports both v1 (MODULE.md) and v2 (module.yaml + prompt.md) formats
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import yaml from 'js-yaml';
import type { CognitiveModule, ModuleConstraints, ModulePolicies, ToolsPolicy, OutputContract, FailureContract, RuntimeRequirements } from '../types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?/;

/**
 * Detect module format version
 */
async function detectFormat(modulePath: string): Promise<'v1' | 'v2'> {
  const v2Manifest = path.join(modulePath, 'module.yaml');
  try {
    await fs.access(v2Manifest);
    return 'v2';
  } catch {
    return 'v1';
  }
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
  let errorSchema: object | undefined;
  
  try {
    const schemaContent = await fs.readFile(schemaFile, 'utf-8');
    const schema = JSON.parse(schemaContent);
    inputSchema = schema.input;
    outputSchema = schema.output;
    errorSchema = schema.error;
  } catch {
    // Schema file is optional but recommended
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
    context: manifest.context as 'fork' | 'main' | undefined,
    prompt,
    inputSchema,
    outputSchema,
    errorSchema,
    location: modulePath,
    format: 'v2',
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
 * Load a Cognitive Module (auto-detects format)
 */
export async function loadModule(modulePath: string): Promise<CognitiveModule> {
  const format = await detectFormat(modulePath);
  
  if (format === 'v2') {
    return loadModuleV2(modulePath);
  } else {
    return loadModuleV1(modulePath);
  }
}

/**
 * Check if a directory contains a valid module
 */
async function isValidModule(modulePath: string): Promise<boolean> {
  const v2Manifest = path.join(modulePath, 'module.yaml');
  const v1Module = path.join(modulePath, 'MODULE.md');
  
  try {
    await fs.access(v2Manifest);
    return true;
  } catch {
    try {
      await fs.access(v1Module);
      return true;
    } catch {
      return false;
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
