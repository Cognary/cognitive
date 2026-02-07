/**
 * Tests for Registry Client
 * 
 * Tests registry functionality:
 * - V1/V2 registry parsing
 * - Module search and listing
 * - GitHub source parsing
 * - Category management
 * - Checksum verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegistryClient, type RegistryV1, type RegistryV2, type ModuleInfo } from './client.js';

// =============================================================================
// Mock Data
// =============================================================================

const mockV1Registry: RegistryV1 = {
  version: '1.0.0',
  updated: '2024-01-01T00:00:00Z',
  modules: {
    'code-simplifier': {
      description: 'Simplifies complex code',
      version: '1.0.0',
      source: 'github:test-org/test-repo/cognitive/modules/code-simplifier',
      tags: ['code', 'simplify'],
      author: 'Test Author',
    },
    'code-reviewer': {
      description: 'Reviews code quality',
      version: '2.0.0',
      source: 'github:test-org/test-repo/cognitive/modules/code-reviewer@v2.0.0',
      tags: ['code', 'review'],
      author: 'Test Author',
    },
  },
};

const mockV2Registry: RegistryV2 = {
  version: '2.0.0',
  updated: '2024-06-01T00:00:00Z',
  modules: {
    'api-designer': {
      identity: {
        name: 'api-designer',
        namespace: 'test',
        version: '1.5.0',
        spec_version: '2.2',
      },
      metadata: {
        description: 'Designs RESTful APIs',
        keywords: ['api', 'design', 'rest'],
        author: 'Test Corp',
        license: 'MIT',
        repository: 'https://github.com/test-org/api-designer',
        tier: 'exec',
      },
      quality: {
        conformance_level: 3,
        verified: true,
      },
      dependencies: {
        runtime_min: '2.2.0',
        modules: [],
      },
      distribution: {
        tarball: 'https://example.com/api-designer-1.5.0.tar.gz',
        // 64 hex chars to match the registry-entry schema pattern
        checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      timestamps: {
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
    },
  },
  categories: {
    development: {
      name: 'Development',
      description: 'Development tools',
      modules: ['api-designer'],
    },
  },
  stats: {
    total_modules: 1,
    total_downloads: 1000,
    last_updated: '2024-06-01T00:00:00Z',
  },
};

// =============================================================================
// Tests
// =============================================================================

describe('RegistryClient', () => {
  let client: RegistryClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('parseGitHubSource', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
    });

    it('should parse basic github source', () => {
      const result = client.parseGitHubSource('github:org/repo');
      expect(result).toEqual({ org: 'org', repo: 'repo' });
    });

    it('should parse github source with path', () => {
      const result = client.parseGitHubSource('github:org/repo/path/to/module');
      expect(result).toEqual({ org: 'org', repo: 'repo', path: 'path/to/module' });
    });

    it('should parse github source with ref', () => {
      const result = client.parseGitHubSource('github:org/repo@v1.0.0');
      expect(result).toEqual({ org: 'org', repo: 'repo', ref: 'v1.0.0' });
    });

    it('should parse github source with path and ref', () => {
      const result = client.parseGitHubSource('github:org/repo/modules/my-module@v2.0.0');
      expect(result).toEqual({
        org: 'org',
        repo: 'repo',
        path: 'modules/my-module',
        ref: 'v2.0.0',
      });
    });

    it('should return null for non-github source', () => {
      const result = client.parseGitHubSource('https://example.com/module.tar.gz');
      expect(result).toBeNull();
    });
  });

  describe('getDownloadUrl (checksum propagation)', () => {
    beforeEach(async () => {
      client = new RegistryClient('https://example.com/registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV2Registry),
      });
      // Ensure we don't read a stale on-disk cache from previous test runs.
      await client.fetchRegistry(true);
    });

    it('should return checksum when module has tarball source', async () => {
      const info = await client.getDownloadUrl('api-designer');
      expect(info.isGitHub).toBe(false);
      expect(info.url).toBe('https://example.com/api-designer-1.5.0.tar.gz');
      expect(info.checksum).toBe('sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });
  });

  describe('fetchRegistry - V1', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV1Registry),
      });
    });

    it('should fetch and parse V1 registry', async () => {
      const registry = await client.fetchRegistry(true);
      expect(registry).toBeDefined();
      expect(registry.modules['code-simplifier']).toBeDefined();
    });

    it('should use cache on subsequent calls', async () => {
      await client.fetchRegistry(true);
      await client.fetchRegistry();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      await client.fetchRegistry(true);
      await client.fetchRegistry(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('listModules', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV1Registry),
      });
    });

    it('should return all modules', async () => {
      const modules = await client.listModules();
      expect(modules).toHaveLength(2);
      expect(modules.map(m => m.name)).toContain('code-simplifier');
      expect(modules.map(m => m.name)).toContain('code-reviewer');
    });

    it('should normalize module information', async () => {
      const modules = await client.listModules();
      const simplifier = modules.find(m => m.name === 'code-simplifier');
      
      expect(simplifier).toBeDefined();
      expect(simplifier!.version).toBe('1.0.0');
      expect(simplifier!.description).toBe('Simplifies complex code');
      expect(simplifier!.keywords).toContain('code');
    });
  });

  describe('getModule', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV1Registry),
      });
    });

    it('should return module by name', async () => {
      const module = await client.getModule('code-simplifier');
      expect(module).toBeDefined();
      expect(module!.name).toBe('code-simplifier');
    });

    it('should return null for non-existent module', async () => {
      const module = await client.getModule('non-existent');
      expect(module).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV1Registry),
      });
    });

    it('should search by name', async () => {
      const results = await client.search('simplifier');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('code-simplifier');
    });

    it('should search by description', async () => {
      const results = await client.search('quality');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('code-reviewer');
    });

    it('should search by keyword', async () => {
      const results = await client.search('code');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await client.search('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return all modules when query is empty', async () => {
      const results = await client.search('');
      expect(results).toHaveLength(2);
    });
  });

  describe('V2 Registry', () => {
    beforeEach(() => {
      // Create a fresh client with unique URL to avoid any cache issues
      client = new RegistryClient('https://example.com/v2-registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV2Registry),
      });
    });

    it('should parse V2 registry modules', async () => {
      // Force refresh to ensure we get fresh data
      await client.fetchRegistry(true);
      const modules = await client.listModules();
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('api-designer');
    });

    it('should extract V2 specific fields', async () => {
      await client.fetchRegistry(true);
      const module = await client.getModule('api-designer');
      expect(module).toBeDefined();
      expect(module!.tier).toBe('exec');
      expect(module!.license).toBe('MIT');
      expect(module!.conformance_level).toBe(3);
      expect(module!.verified).toBe(true);
    });

    it('should return categories', async () => {
      await client.fetchRegistry(true);
      const categories = await client.getCategories();
      expect(categories).toBeDefined();
      expect(categories['development']).toBeDefined();
      expect(categories['development'].name).toBe('Development');
      expect(categories['development'].modules).toContain('api-designer');
    });
  });

  describe('getDownloadUrl', () => {
    beforeEach(() => {
      // Use unique URL to avoid file cache issues
      client = new RegistryClient('https://example.com/download-test-registry.json');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockV1Registry),
      });
    });

    it('should return GitHub download info for github source', async () => {
      // Force refresh to bypass any cache
      await client.fetchRegistry(true);
      const info = await client.getDownloadUrl('code-simplifier');
      expect(info.isGitHub).toBe(true);
      expect(info.githubInfo).toBeDefined();
      expect(info.githubInfo!.org).toBe('test-org');
      expect(info.githubInfo!.repo).toBe('test-repo');
      expect(info.githubInfo!.path).toBe('cognitive/modules/code-simplifier');
    });

    it('should include ref when present in source', async () => {
      // Force refresh to bypass any cache
      await client.fetchRegistry(true);
      const info = await client.getDownloadUrl('code-reviewer');
      expect(info.isGitHub).toBe(true);
      expect(info.githubInfo!.ref).toBe('v2.0.0');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      client = new RegistryClient('https://example.com/registry.json');
    });

    it('should time out registry fetch', async () => {
      vi.useFakeTimers();
      global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as any).name = 'AbortError';
            reject(err);
          });
        });
      });

      try {
        // Attach the rejection handler before advancing timers to avoid
        // transient unhandledRejection warnings in Node/vitest.
        const p = client.fetchRegistry(true);
        const assertion = expect(p).rejects.toThrow('Registry fetch timed out after 10000ms');
        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reject oversized registry payload via content-length', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-length' ? String(1024 * 1024 + 1) : null),
        },
        json: () => Promise.resolve(mockV1Registry),
      });

      await expect(client.fetchRegistry(true)).rejects.toThrow('Registry payload too large');
    });

    it('should throw on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      await expect(client.fetchRegistry(true)).rejects.toThrow('Network error');
    });

    it('should throw on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      await expect(client.fetchRegistry(true)).rejects.toThrow('Failed to fetch registry: 404 Not Found');
    });
  });
});
