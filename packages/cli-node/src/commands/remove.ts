/**
 * Remove command - Remove installed modules
 * 
 * cog remove code-simplifier
 */

import { existsSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CommandContext, CommandResult } from '../types.js';

const USER_MODULES_DIR = join(homedir(), '.cognitive', 'modules');
const INSTALLED_MANIFEST = join(homedir(), '.cognitive', 'installed.json');

/**
 * Remove an installed module
 */
export async function remove(
  moduleName: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const modulePath = join(USER_MODULES_DIR, moduleName);
  
  if (!existsSync(modulePath)) {
    return {
      success: false,
      error: `Module not found in global location: ${moduleName}. Only modules in ~/.cognitive/modules can be removed.`,
    };
  }
  
  try {
    // Remove module directory
    rmSync(modulePath, { recursive: true, force: true });
    
    // Remove from manifest
    if (existsSync(INSTALLED_MANIFEST)) {
      const content = await readFile(INSTALLED_MANIFEST, 'utf-8');
      const manifest = JSON.parse(content);
      delete manifest[moduleName];
      await writeFile(INSTALLED_MANIFEST, JSON.stringify(manifest, null, 2));
    }
    
    return {
      success: true,
      data: {
        message: `Removed: ${moduleName}`,
        name: moduleName,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
