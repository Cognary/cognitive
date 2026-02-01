/**
 * Update command - Update installed modules to latest version
 * 
 * cog update code-simplifier
 * cog update code-simplifier --tag v2.0.0
 */

import { existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CommandContext, CommandResult } from '../types.js';
import { add, getInstallInfo } from './add.js';

const USER_MODULES_DIR = join(homedir(), '.cognitive', 'modules');

export interface UpdateOptions {
  tag?: string;
}

/**
 * Get module version from installed module
 */
async function getInstalledVersion(moduleName: string): Promise<string | undefined> {
  const modulePath = join(USER_MODULES_DIR, moduleName);
  
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
  // Get installation info
  const info = await getInstallInfo(moduleName);
  
  if (!info) {
    return {
      success: false,
      error: `Module not found or not installed from GitHub: ${moduleName}. Only modules installed with 'cog add' can be updated.`,
    };
  }
  
  if (!info.githubUrl) {
    return {
      success: false,
      error: `Module was not installed from GitHub: ${moduleName}`,
    };
  }
  
  // Get current version
  const oldVersion = await getInstalledVersion(moduleName);
  
  // Determine what ref to use
  const tag = options.tag || info.tag;
  const branch = info.branch || 'main';
  
  // Re-install from source
  const result = await add(info.githubUrl, ctx, {
    module: info.modulePath,
    name: moduleName,
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
      message = `Already up to date: ${moduleName} v${newVersion}`;
    } else {
      message = `Updated: ${moduleName} v${oldVersion} → v${newVersion}`;
    }
  } else if (newVersion) {
    message = `Updated: ${moduleName} to v${newVersion}`;
  } else {
    message = `Updated: ${moduleName}`;
  }
  
  return {
    success: true,
    data: {
      message,
      name: moduleName,
      oldVersion,
      newVersion,
    },
  };
}
