/**
 * cog list - List available Cognitive Modules
 */

import type { CommandContext, CommandResult } from '../types.js';
import { listModules, getDefaultSearchPaths } from '../modules/index.js';

export async function list(ctx: CommandContext): Promise<CommandResult> {
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  const modules = await listModules(searchPaths);

  if (modules.length === 0) {
    return {
      success: true,
      data: {
        modules: [],
        message: `No modules found in: ${searchPaths.join(', ')}`,
      },
    };
  }

  return {
    success: true,
    data: {
      modules: modules.map(m => ({
        name: m.name,
        version: m.version,
        responsibility: m.responsibility,
        location: m.location,
      })),
    },
  };
}
