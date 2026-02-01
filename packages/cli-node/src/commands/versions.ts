/**
 * Versions command - List available versions from GitHub
 * 
 * cog versions ziel-io/cognitive-modules
 */

import type { CommandContext, CommandResult } from '../types.js';

export interface VersionsOptions {
  limit?: number;
}

/**
 * Parse GitHub URL or shorthand
 */
function parseGitHubUrl(url: string): { org: string; repo: string } {
  if (!url.startsWith('http')) {
    url = `https://github.com/${url}`;
  }
  
  const match = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  
  return {
    org: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

/**
 * List available versions (tags) from GitHub
 */
export async function versions(
  url: string,
  ctx: CommandContext,
  options: VersionsOptions = {}
): Promise<CommandResult> {
  const { limit = 10 } = options;
  
  try {
    const { org, repo } = parseGitHubUrl(url);
    
    // Fetch tags from GitHub API
    const apiUrl = `https://api.github.com/repos/${org}/${repo}/tags?per_page=${limit}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'cognitive-runtime/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository not found: ${org}/${repo}`);
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json() as Array<{ name: string }>;
    const tags = data.map(t => t.name);
    
    return {
      success: true,
      data: {
        repository: `${org}/${repo}`,
        tags,
        count: tags.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
