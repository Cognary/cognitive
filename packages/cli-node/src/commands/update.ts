/**
 * Update command - Update installed modules to latest version
 * 
 * cog update code-simplifier
 * cog update code-simplifier --tag v2.0.0
 */

import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import type { CommandContext, CommandResult } from '../types.js';
import { add, addFromRegistry, getInstallInfo, type InstallInfo } from './add.js';
import { RegistryClient } from '../registry/client.js';

const USER_MODULES_DIR = join(homedir(), '.cognitive', 'modules');

export interface UpdateOptions {
  tag?: string;
  registry?: string;
}

function assertSafeModuleName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Invalid module name: empty');
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`Invalid module name: ${name}`);
  }
  if (isAbsolute(trimmed)) {
    throw new Error(`Invalid module name (absolute path not allowed): ${name}`);
  }
  return trimmed;
}

function resolveModuleTarget(moduleName: string): string {
  const safeName = assertSafeModuleName(moduleName);
  const targetPath = resolve(USER_MODULES_DIR, safeName);
  const root = resolve(USER_MODULES_DIR) + sep;
  if (!targetPath.startsWith(root)) {
    throw new Error(`Invalid module name (path traversal): ${moduleName}`);
  }
  return targetPath;
}

/**
 * Get module version from installed module
 */
async function getInstalledVersion(moduleName: string): Promise<string | undefined> {
  const modulePath = resolveModuleTarget(moduleName);
  
  if (!existsSync(modulePath)) {
    return undefined;
  }
  
  const yaml = await import('js-yaml');
  
  // Try v2 format
  const yamlPath = join(modulePath, 'module.yaml');
  if (existsSync(yamlPath)) {
    const content = await readFile(yamlPath, 'utf-8');
    const data = yaml.load(content) as { version?: string };
    return data?.version;
  }
  
  // Try v1 format
  const mdPath = existsSync(join(modulePath, 'MODULE.md'))
    ? join(modulePath, 'MODULE.md')
    : join(modulePath, 'module.md');
  
  if (existsSync(mdPath)) {
    const content = await readFile(mdPath, 'utf-8');
    if (content.startsWith('---')) {
      const parts = content.split('---');
      if (parts.length >= 3) {
        const meta = yaml.load(parts[1]) as { version?: string };
        return meta?.version;
      }
    }
  }
  
  return undefined;
}

/**
 * Update an installed module
 */
export async function update(
  moduleName: string,
  ctx: CommandContext,
  options: UpdateOptions = {}
): Promise<CommandResult> {
  let safeName: string;
  try {
    safeName = assertSafeModuleName(moduleName);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Get installation info
  const info = await getInstallInfo(safeName);
  
  if (!info) {
    return {
      success: false,
      error: `Module not found or not installed with 'cog add': ${safeName}. Only modules installed with 'cog add' can be updated.`,
    };
  }
  
  // Get current version
  const oldVersion = await getInstalledVersion(safeName);
  
  // Check if module was installed from registry
  if (info.registryModule) {
    const registryModule = info.registryModule;
    // Use undefined instead of empty string for default registry URL
    const registryUrl = info.registryUrl || undefined;
    
    // Check registry for latest version
    const client = new RegistryClient(registryUrl);
    const registryInfo = await client.getModule(registryModule);
    
    if (!registryInfo) {
      return {
        success: false,
        error: `Module '${registryModule}' is no longer available in the registry.`,
      };
    }
    
    // Warn if deprecated
    if (registryInfo.deprecated) {
      console.warn(`Warning: Module '${registryModule}' is deprecated.`);
    }
    
    const targetVersion = options.tag || registryInfo.version;
    
    // Re-install from registry with optional version
    const moduleSpec = options.tag ? `${registryModule}@${options.tag}` : registryModule;
    const result = await addFromRegistry(moduleSpec, ctx, {
      name: safeName,
      registry: registryUrl,
    });
    
    if (!result.success) {
      return result;
    }
    
    const data = result.data as { version?: string };
    const newVersion = data.version || targetVersion;
    
    // Determine message
    let message: string;
    if (oldVersion && newVersion) {
      if (oldVersion === newVersion) {
        message = `Already up to date: ${safeName} v${newVersion}`;
      } else {
        message = `Updated: ${safeName} v${oldVersion} → v${newVersion}`;
      }
    } else if (newVersion) {
      message = `Updated: ${safeName} to v${newVersion}`;
    } else {
      message = `Updated: ${safeName}`;
    }
    
    return {
      success: true,
      data: {
        message,
        name: safeName,
        oldVersion,
        newVersion,
        source: 'registry',
      },
    };
  }
  
  // GitHub-based update
  if (!info.githubUrl) {
    return {
      success: false,
      error: `Module was not installed from GitHub or registry: ${moduleName}`,
    };
  }
  
  // Determine what ref to use
  const tag = options.tag || info.tag;
  const branch = info.branch || 'main';
  
  // Re-install from source
  const result = await add(info.githubUrl, ctx, {
    module: info.modulePath,
    name: safeName,
    tag,
    branch: tag ? undefined : branch,
  });
  
  if (!result.success) {
    return result;
  }
  
  const data = result.data as { version?: string };
  const newVersion = data.version;
  
  // Determine message
  let message: string;
  if (oldVersion && newVersion) {
    if (oldVersion === newVersion) {
      message = `Already up to date: ${safeName} v${newVersion}`;
    } else {
      message = `Updated: ${safeName} v${oldVersion} → v${newVersion}`;
    }
  } else if (newVersion) {
    message = `Updated: ${safeName} to v${newVersion}`;
  } else {
    message = `Updated: ${safeName}`;
  }
  
  return {
    success: true,
    data: {
      message,
      name: safeName,
      oldVersion,
      newVersion,
      source: 'github',
    },
  };
}
