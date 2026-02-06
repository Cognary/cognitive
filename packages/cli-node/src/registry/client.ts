/**
 * Registry Client - Fetch and manage modules from Cognitive Modules Registry
 * 
 * Supports both v1 and v2 registry formats.
 * 
 * Usage:
 *   const client = new RegistryClient();
 *   const modules = await client.listModules();
 *   const module = await client.getModule('code-reviewer');
 */

import { existsSync, statSync } from 'node:fs';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

// =============================================================================
// Types
// =============================================================================

/** v1 Registry Format (current cognitive-registry.json) */
export interface RegistryV1 {
  $schema?: string;
  version: string;
  updated: string;
  modules: {
    [name: string]: {
      description: string;
      version: string;
      source: string;  // e.g., "github:ziel-io/cognitive-modules/cognitive/modules/code-reviewer"
      tags: string[];
      author: string;
    };
  };
  categories?: {
    [key: string]: {
      name: string;
      description: string;
      modules: string[];
    };
  };
}

/** v2 Registry Format (new format per REGISTRY-PROTOCOL.md) */
export interface RegistryV2 {
  $schema?: string;
  version: string;
  updated: string;
  modules: {
    [name: string]: RegistryEntryV2;
  };
  categories?: {
    [key: string]: {
      name: string;
      name_zh?: string;
      description: string;
      modules: string[];
    };
  };
  featured?: string[];
  stats?: {
    total_modules: number;
    total_downloads: number;
    last_updated: string;
  };
}

/** v2 Registry Entry */
export interface RegistryEntryV2 {
  identity: {
    name: string;
    namespace: string;
    version: string;
    spec_version: string;
  };
  metadata: {
    description: string;
    description_zh?: string;
    author: string;
    license?: string;
    repository?: string;
    documentation?: string;
    homepage?: string;
    keywords?: string[];
    tier?: 'exec' | 'decision' | 'exploration';
  };
  quality?: {
    conformance_level?: number;
    test_coverage?: number;
    test_vector_pass?: boolean;
    verified?: boolean;
    verified_by?: string;
    verified_at?: string;
    downloads_30d?: number;
    stars?: number;
    badges?: string[];
    deprecated?: boolean;
    successor?: string;
    deprecation_reason?: string;
  };
  dependencies: {
    runtime_min: string;
    modules: Array<{
      name: string;
      version?: string;
      optional?: boolean;
    }>;
  };
  distribution: {
    tarball: string;
    checksum: string;
    size_bytes?: number;
    files?: string[];
    signature?: string;
    signing_key?: string;
  };
  timestamps?: {
    created_at?: string;
    updated_at?: string;
    deprecated_at?: string;
  };
}

/** Normalized module info (works with both v1 and v2) */
export interface ModuleInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  source: string;
  tarball?: string;
  checksum?: string;
  keywords: string[];
  tier?: string;
  namespace?: string;
  license?: string;
  repository?: string;
  conformance_level?: number;
  verified?: boolean;
  deprecated?: boolean;
}

/** Search result */
export interface SearchResult {
  name: string;
  description: string;
  version: string;
  score: number;
  keywords: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/Cognary/cognitive/main/cognitive-registry.v2.json';
const CACHE_DIR = join(homedir(), '.cognitive', 'cache');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REGISTRY_FETCH_TIMEOUT_MS = 10_000; // 10s
const MAX_REGISTRY_BYTES = 1024 * 1024; // 1MB

// =============================================================================
// Registry Client
// =============================================================================

export class RegistryClient {
  private registryUrl: string;
  private cache: { data: RegistryV1 | RegistryV2 | null; timestamp: number } = { data: null, timestamp: 0 };

  constructor(registryUrl: string = DEFAULT_REGISTRY_URL) {
    this.registryUrl = registryUrl;
  }

  private async parseRegistryResponse(response: Response): Promise<RegistryV1 | RegistryV2> {
    const contentLengthHeader = response.headers?.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > MAX_REGISTRY_BYTES) {
        throw new Error(`Registry payload too large: ${contentLength} bytes (max ${MAX_REGISTRY_BYTES})`);
      }
    }

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > MAX_REGISTRY_BYTES) {
              throw new Error(`Registry payload too large: ${totalBytes} bytes (max ${MAX_REGISTRY_BYTES})`);
            }
            buffer += decoder.decode(value, { stream: true });
          }
        }
        buffer += decoder.decode();
      } finally {
        reader.releaseLock();
      }

      try {
        return JSON.parse(buffer) as RegistryV1 | RegistryV2;
      } catch (error) {
        throw new Error(`Invalid registry JSON: ${(error as Error).message}`);
      }
    }

    if (typeof response.text === 'function') {
      const text = await response.text();
      const byteLen = Buffer.byteLength(text, 'utf-8');
      if (byteLen > MAX_REGISTRY_BYTES) {
        throw new Error(`Registry payload too large: ${byteLen} bytes (max ${MAX_REGISTRY_BYTES})`);
      }
      try {
        return JSON.parse(text) as RegistryV1 | RegistryV2;
      } catch (error) {
        throw new Error(`Invalid registry JSON: ${(error as Error).message}`);
      }
    }

    if (typeof response.json === 'function') {
      return await response.json() as RegistryV1 | RegistryV2;
    }

    throw new Error('Failed to read registry response body');
  }

  /**
   * Generate a unique cache filename based on registry URL
   */
  private getCacheFileName(): string {
    const hash = createHash('md5').update(this.registryUrl).digest('hex').slice(0, 8);
    return `registry-${hash}.json`;
  }

  /**
   * Fetch registry index (with caching)
   */
  async fetchRegistry(forceRefresh: boolean = false): Promise<RegistryV1 | RegistryV2> {
    const now = Date.now();
    
    // Check memory cache
    if (!forceRefresh && this.cache.data && (now - this.cache.timestamp) < CACHE_TTL_MS) {
      return this.cache.data;
    }
    
    // Check file cache (unique per registry URL)
    const cacheFile = join(CACHE_DIR, this.getCacheFileName());
    if (!forceRefresh && existsSync(cacheFile)) {
      try {
        const stat = statSync(cacheFile);
        if ((now - stat.mtimeMs) < CACHE_TTL_MS) {
          const content = await readFile(cacheFile, 'utf-8');
          const data = JSON.parse(content);
          this.cache = { data, timestamp: now };
          return data;
        }
      } catch {
        // Ignore cache read errors
      }
    }
    
    // Fetch from network
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REGISTRY_FETCH_TIMEOUT_MS);
    let data: RegistryV1 | RegistryV2;

    try {
      const response = await fetch(this.registryUrl, {
        headers: { 'User-Agent': 'cognitive-runtime/2.2' },
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
      }
      
      data = await this.parseRegistryResponse(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Registry fetch timed out after ${REGISTRY_FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    
    // Update cache
    this.cache = { data, timestamp: now };
    
    // Save to file cache
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cacheFile, JSON.stringify(data, null, 2));
    } catch {
      // Ignore cache write errors
    }
    
    return data;
  }

  /**
   * Check if registry is v2 format
   */
  private isV2Registry(registry: RegistryV1 | RegistryV2): registry is RegistryV2 {
    const firstModule = Object.values(registry.modules)[0];
    return firstModule && 'identity' in firstModule;
  }

  /**
   * Normalize module entry to unified format
   */
  private normalizeModule(name: string, entry: RegistryV1['modules'][string] | RegistryEntryV2): ModuleInfo {
    if ('identity' in entry) {
      // v2 format
      const v2 = entry as RegistryEntryV2;
      return {
        name: v2.identity.name,
        version: v2.identity.version,
        description: v2.metadata.description,
        author: v2.metadata.author,
        source: v2.distribution.tarball,
        tarball: v2.distribution.tarball,
        checksum: v2.distribution.checksum,
        keywords: v2.metadata.keywords || [],
        tier: v2.metadata.tier,
        namespace: v2.identity.namespace,
        license: v2.metadata.license,
        repository: v2.metadata.repository,
        conformance_level: v2.quality?.conformance_level,
        verified: v2.quality?.verified,
        deprecated: v2.quality?.deprecated,
      };
    } else {
      // v1 format
      const v1 = entry as RegistryV1['modules'][string];
      return {
        name,
        version: v1.version,
        description: v1.description,
        author: v1.author,
        source: v1.source,
        keywords: v1.tags || [],
      };
    }
  }

  /**
   * List all modules in registry
   */
  async listModules(): Promise<ModuleInfo[]> {
    const registry = await this.fetchRegistry();
    return Object.entries(registry.modules).map(([name, entry]) => 
      this.normalizeModule(name, entry)
    );
  }

  /**
   * Get a specific module by name
   */
  async getModule(name: string): Promise<ModuleInfo | null> {
    const registry = await this.fetchRegistry();
    const entry = registry.modules[name];
    if (!entry) {
      return null;
    }
    return this.normalizeModule(name, entry);
  }

  /**
   * Search modules by query
   */
  async search(query: string): Promise<SearchResult[]> {
    const modules = await this.listModules();
    
    // If query is empty, return all modules sorted by name
    if (!query.trim()) {
      return modules
        .map(m => ({
          name: m.name,
          description: m.description,
          version: m.version,
          score: 1,
          keywords: m.keywords,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const queryLower = query.toLowerCase().trim();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);
    
    const results: SearchResult[] = [];
    
    for (const module of modules) {
      let score = 0;
      
      // Name match (highest weight)
      if (module.name.toLowerCase().includes(queryLower)) {
        score += 10;
        if (module.name.toLowerCase() === queryLower) {
          score += 5;
        }
      }
      
      // Description match
      const descLower = module.description.toLowerCase();
      for (const term of queryTerms) {
        if (descLower.includes(term)) {
          score += 3;
        }
      }
      
      // Keyword match
      for (const keyword of module.keywords) {
        const keywordLower = keyword.toLowerCase();
        for (const term of queryTerms) {
          if (keywordLower.includes(term) || term.includes(keywordLower)) {
            score += 2;
          }
        }
      }
      
      if (score > 0) {
        results.push({
          name: module.name,
          description: module.description,
          version: module.version,
          score,
          keywords: module.keywords,
        });
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<{ [key: string]: { name: string; description: string; modules: string[] } }> {
    const registry = await this.fetchRegistry();
    return registry.categories || {};
  }

  /**
   * Parse GitHub source string
   * Format: github:<owner>/<repo>[/<path>][@<ref>]
   */
  parseGitHubSource(source: string): {
    org: string;
    repo: string;
    path?: string;
    ref?: string;
  } | null {
    if (!source.startsWith('github:')) {
      return null;
    }
    
    const rest = source.slice('github:'.length);
    
    // Split ref if present
    const [pathPart, ref] = rest.split('@');
    
    // Parse owner/repo/path
    const parts = pathPart.split('/');
    if (parts.length < 2) {
      return null;
    }
    
    const org = parts[0];
    const repo = parts[1];
    const modulePath = parts.length > 2 ? parts.slice(2).join('/') : undefined;
    
    return { org, repo, path: modulePath, ref };
  }

  /**
   * Verify checksum of downloaded file
   */
  async verifyChecksum(filePath: string, expected: string): Promise<boolean> {
    const [algo, expectedHash] = expected.split(':');
    if (!algo || !expectedHash) {
      throw new Error(`Invalid checksum format: ${expected}`);
    }
    
    const content = await readFile(filePath);
    const actualHash = createHash(algo).update(content).digest('hex');
    
    return actualHash === expectedHash;
  }

  /**
   * Get the download URL for a module
   */
  async getDownloadUrl(moduleName: string): Promise<{
    url: string;
    checksum?: string;
    isGitHub: boolean;
    githubInfo?: { org: string; repo: string; path?: string; ref?: string };
  }> {
    const module = await this.getModule(moduleName);
    if (!module) {
      throw new Error(`Module not found in registry: ${moduleName}`);
    }
    
    const source = module.source;
    
    // Check if it's a GitHub source
    const githubInfo = this.parseGitHubSource(source);
    if (githubInfo) {
      return {
        url: `https://github.com/${githubInfo.org}/${githubInfo.repo}`,
        isGitHub: true,
        githubInfo,
      };
    }
    
    // Check if it's a tarball URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return {
        url: source,
        checksum: module.checksum,
        isGitHub: false,
      };
    }
    
    throw new Error(`Unknown source format: ${source}`);
  }
}

// =============================================================================
// Exports
// =============================================================================

export const defaultRegistry = new RegistryClient();

export async function listRegistryModules(): Promise<ModuleInfo[]> {
  return defaultRegistry.listModules();
}

export async function getRegistryModule(name: string): Promise<ModuleInfo | null> {
  return defaultRegistry.getModule(name);
}

export async function searchRegistry(query: string): Promise<SearchResult[]> {
  return defaultRegistry.search(query);
}
