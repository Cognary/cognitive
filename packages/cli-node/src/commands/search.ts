/**
 * Search command - Search for modules in the registry
 * 
 * cog search code review
 * cog search --category code-quality
 */

import type { CommandContext, CommandResult } from '../types.js';
import { RegistryClient, type SearchResult, type ModuleInfo } from '../registry/client.js';

export interface SearchOptions {
  category?: string;
  limit?: number;
  registry?: string;
}

/**
 * Search for modules in the registry
 */
export async function search(
  query: string,
  ctx: CommandContext,
  options: SearchOptions = {}
): Promise<CommandResult> {
  const { category, limit = 20, registry } = options;
  const registryUrl = registry ?? ctx.registryUrl;
  
  try {
    const client = new RegistryClient(registryUrl);
    
    let results: SearchResult[];
    
    if (category) {
      // Search within category
      const categories = await client.getCategories();
      const cat = categories[category];
      
      if (!cat) {
        return {
          success: false,
          error: `Category not found: ${category}\nAvailable categories: ${Object.keys(categories).join(', ')}`,
        };
      }
      
      // Get modules in category
      const modules: ModuleInfo[] = [];
      for (const name of cat.modules) {
        const mod = await client.getModule(name);
        if (mod) {
          modules.push(mod);
        }
      }
      
      // If query provided, filter by query
      if (query) {
        results = modules
          .filter(m => 
            m.name.toLowerCase().includes(query.toLowerCase()) ||
            m.description.toLowerCase().includes(query.toLowerCase())
          )
          .map(m => ({
            name: m.name,
            description: m.description,
            version: m.version,
            score: 1,
            keywords: m.keywords,
          }));
      } else {
        results = modules.map(m => ({
          name: m.name,
          description: m.description,
          version: m.version,
          score: 1,
          keywords: m.keywords,
        }));
      }
    } else if (query) {
      // Search by query
      results = await client.search(query);
    } else {
      // List all modules
      const modules = await client.listModules();
      results = modules.map(m => ({
        name: m.name,
        description: m.description,
        version: m.version,
        score: 1,
        keywords: m.keywords,
      }));
    }
    
    // Apply limit
    const limited = results.slice(0, limit);
    
    return {
      success: true,
      data: {
        query,
        category,
        total: results.length,
        results: limited,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List all categories
 */
export async function listCategories(
  ctx: CommandContext,
  options: { registry?: string } = {}
): Promise<CommandResult> {
  try {
    const client = new RegistryClient(options.registry ?? ctx.registryUrl);
    const categories = await client.getCategories();
    
    return {
      success: true,
      data: {
        categories: Object.entries(categories).map(([key, cat]) => ({
          key,
          name: cat.name,
          description: cat.description,
          moduleCount: cat.modules.length,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get detailed info about a module from registry
 */
export async function info(
  moduleName: string,
  ctx: CommandContext,
  options: { registry?: string } = {}
): Promise<CommandResult> {
  try {
    const client = new RegistryClient(options.registry ?? ctx.registryUrl);
    const module = await client.getModule(moduleName);
    
    if (!module) {
      return {
        success: false,
        error: `Module not found in registry: ${moduleName}`,
      };
    }
    
    return {
      success: true,
      data: {
        module,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
