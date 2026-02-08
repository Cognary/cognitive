/**
 * Add command - Install modules from GitHub or Registry
 * 
 * From Registry:
 *   cog add code-reviewer
 *   cog add code-reviewer@2.0.0
 * 
 * From GitHub:
 *   cog add ziel-io/cognitive-modules -m code-simplifier
 *   cog add https://github.com/org/repo --module name --tag v1.0.0
 */

import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, lstatSync } from 'node:fs';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { pipeline, finished } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join, basename, dirname, resolve, sep, isAbsolute } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import type { CommandContext, CommandResult } from '../types.js';
import { RegistryClient } from '../registry/client.js';
import { extractTarGzFile } from '../registry/tar.js';
import { PROVENANCE_SPEC, computeModuleIntegrity, writeModuleProvenance } from '../provenance.js';

// Module storage paths
const USER_MODULES_DIR = join(homedir(), '.cognitive', 'modules');
const INSTALLED_MANIFEST = join(homedir(), '.cognitive', 'installed.json');

export interface AddOptions {
  module?: string;
  name?: string;
  branch?: string;
  tag?: string;
  registry?: string;
}

export interface InstallInfo {
  source: string;
  githubUrl: string;
  modulePath?: string;
  tag?: string;
  branch?: string;
  version?: string;
  installedAt: string;
  installedTime: string;
  /** Registry module name if installed from registry */
  registryModule?: string;
  /** Registry URL if installed from a custom registry */
  registryUrl?: string;
}

interface InstallManifest {
  [moduleName: string]: InstallInfo;
}

/**
 * Parse GitHub URL or shorthand
 */
function parseGitHubUrl(url: string): { org: string; repo: string; fullUrl: string } {
  // Handle shorthand: org/repo
  if (!url.startsWith('http')) {
    url = `https://github.com/${url}`;
  }
  
  const match = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  
  const org = match[1];
  const repo = match[2].replace(/\.git$/, '');
  
  return {
    org,
    repo,
    fullUrl: `https://github.com/${org}/${repo}`,
  };
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

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const root = resolve(rootDir);
  const target = resolve(targetPath);
  return target === root || target.startsWith(root + sep);
}

/**
 * Download and extract ZIP from GitHub
 */
async function downloadAndExtract(
  org: string,
  repo: string,
  ref: string,
  isTag: boolean
): Promise<string> {
  const zipUrl = isTag
    ? `https://github.com/${org}/${repo}/archive/refs/tags/${ref}.zip`
    : `https://github.com/${org}/${repo}/archive/refs/heads/${ref}.zip`;
  
  // Create temp directory
  const tempDir = join(tmpdir(), `cog-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  const zipPath = join(tempDir, 'repo.zip');
  
  // Download ZIP
  const response = await fetch(zipUrl, {
    headers: { 'User-Agent': 'cognitive-runtime/1.0' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  
  // Save to file
  const fileStream = createWriteStream(zipPath);
  await pipeline(Readable.fromWeb(response.body as any), fileStream);
  
  // Extract using built-in unzip (available on most systems)
  const { execSync } = await import('node:child_process');
  // Validate ZIP entries to avoid path traversal (Zip Slip)
  const listing = execSync(`unzip -Z1 "${zipPath}"`, { stdio: 'pipe' }).toString('utf-8');
  assertSafeZipEntries(listing);
  execSync(`unzip -q "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });
  
  // Find extracted directory
  const entries = readdirSync(tempDir).filter(
    e => e !== 'repo.zip' && statSync(join(tempDir, e)).isDirectory()
  );
  
  if (entries.length === 0) {
    throw new Error('ZIP file was empty');
  }
  
  return join(tempDir, entries[0]);
}

/**
 * Validate ZIP listing to prevent path traversal.
 */
function assertSafeZipEntries(listing: string): void {
  const entries = listing.split(/\r?\n/).map(e => e.trim()).filter(Boolean);
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
      throw new Error(`Unsafe ZIP entry (absolute path): ${entry}`);
    }
    const parts = normalized.split('/');
    if (parts.includes('..')) {
      throw new Error(`Unsafe ZIP entry (path traversal): ${entry}`);
    }
  }
}

/**
 * Check if a directory is a valid module
 */
function isValidModule(path: string): boolean {
  return (
    existsSync(join(path, 'module.yaml')) ||
    existsSync(join(path, 'MODULE.md')) ||
    existsSync(join(path, 'module.md'))
  );
}

/**
 * Find module within repository
 */
function findModuleInRepo(repoRoot: string, modulePath: string): string {
  const candidatePaths = [
    resolve(repoRoot, modulePath),
    resolve(repoRoot, 'cognitive', 'modules', modulePath),
    resolve(repoRoot, 'modules', modulePath),
  ];

  const possiblePaths = candidatePaths.filter((p) => isPathWithinRoot(repoRoot, p));
  if (possiblePaths.length === 0) {
    throw new Error(`Invalid module path (outside repository root): ${modulePath}`);
  }

  for (const p of possiblePaths) {
    if (existsSync(p) && isValidModule(p)) {
      return p;
    }
  }
  
  throw new Error(
    `Module not found at: ${modulePath}\n` +
    `Searched in: ${possiblePaths.map(p => p.replace(repoRoot, '.')).join(', ')}`
  );
}

/**
 * Copy directory recursively
 */
function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    
    const st = lstatSync(srcPath);
    if (st.isSymbolicLink()) {
      throw new Error(`Refusing to install module containing symlink: ${srcPath}`);
    }
    if (st.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function downloadTarballWithSha256(url: string, outPath: string, maxBytes: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const hash = createHash('sha256');
  let received = 0;
  const fileStream = createWriteStream(outPath);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'cognitive-runtime/2.2' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers?.get?.('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
        throw new Error(`Tarball too large: ${contentLength} bytes (max ${maxBytes})`);
      }
    }

    if (!response.body) {
      throw new Error('Tarball response has no body');
    }

    const reader = (response.body as any).getReader?.();
    if (!reader) {
      // Fallback: stream pipeline without incremental hash.
      await pipeline(Readable.fromWeb(response.body as any), fileStream);
      const content = await readFile(outPath);
      return createHash('sha256').update(content).digest('hex');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          controller.abort();
          throw new Error(`Tarball too large: ${received} bytes (max ${maxBytes})`);
        }
        const chunk = Buffer.from(value);
        hash.update(chunk);
        if (!fileStream.write(chunk)) {
          await new Promise<void>((resolve) => fileStream.once('drain', () => resolve()));
        }
      }
    }

    fileStream.end();
    await finished(fileStream);
    return hash.digest('hex');
  } catch (error) {
    try {
      fileStream.destroy();
    } catch {
      // ignore
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tarball download timed out after 10000ms');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get module version from module.yaml or MODULE.md
 */
async function getModuleVersion(modulePath: string): Promise<string | undefined> {
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
 * Record installation info
 */
async function recordInstall(
  moduleName: string,
  info: InstallManifest[string]
): Promise<void> {
  let manifest: InstallManifest = {};
  
  if (existsSync(INSTALLED_MANIFEST)) {
    const content = await readFile(INSTALLED_MANIFEST, 'utf-8');
    manifest = JSON.parse(content);
  }
  
  manifest[moduleName] = info;
  
  await mkdir(join(homedir(), '.cognitive'), { recursive: true });
  await writeFile(INSTALLED_MANIFEST, JSON.stringify(manifest, null, 2));
}

/**
 * Get installation info for a module
 */
export async function getInstallInfo(moduleName: string): Promise<InstallManifest[string] | null> {
  if (!existsSync(INSTALLED_MANIFEST)) {
    return null;
  }
  
  const content = await readFile(INSTALLED_MANIFEST, 'utf-8');
  const manifest: InstallManifest = JSON.parse(content);
  return manifest[moduleName] || null;
}

/**
 * Check if input looks like a GitHub URL or org/repo format
 * 
 * GitHub formats:
 * - https://github.com/org/repo
 * - http://github.com/org/repo
 * - github:org/repo
 * - org/repo (shorthand, must be exactly two parts)
 * 
 * NOT GitHub (registry module names):
 * - code-reviewer
 * - code-reviewer@1.0.0
 * - my-module (no slash)
 */
function isGitHubSource(input: string): boolean {
  // URL formats
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return true;
  }
  
  // github: prefix format
  if (input.startsWith('github:')) {
    return true;
  }
  
  // Contains github.com
  if (input.includes('github.com')) {
    return true;
  }
  
  // Shorthand format: org/repo (exactly two parts, no @ version suffix)
  // Must match pattern like: owner/repo or owner/repo but NOT module@version
  const shorthandMatch = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthandMatch) {
    // Additional check: if it contains @, it's likely a scoped npm package or versioned module
    // But GitHub shorthand shouldn't have @ in the middle
    return !input.includes('@');
  }
  
  return false;
}

/**
 * Parse module name with optional version: "module-name@1.0.0"
 */
function parseModuleSpec(spec: string): { name: string; version?: string } {
  const match = spec.match(/^([^@]+)(?:@(.+))?$/);
  if (!match) {
    return { name: spec };
  }
  return { name: match[1], version: match[2] };
}

/**
 * Add a module from the registry
 */
export async function addFromRegistry(
  moduleSpec: string,
  ctx: CommandContext,
  options: AddOptions = {}
): Promise<CommandResult> {
  const { name: moduleName, version: requestedVersion } = parseModuleSpec(moduleSpec);
  const { name: customName, registry: registryUrl } = options;
  const policy = ctx.policy;
  
  let tempDir: string | undefined;
  try {
    const client = new RegistryClient(registryUrl, {
      timeoutMs: ctx.registryTimeoutMs,
      maxBytes: ctx.registryMaxBytes,
    });
    const moduleInfo = await client.getModule(moduleName);
    
    if (!moduleInfo) {
      return {
        success: false,
        error: `Module not found in registry: ${moduleName}\nUse 'cog search' to find available modules.`,
      };
    }
    
    // Check if deprecated
    if (moduleInfo.deprecated) {
      console.error(`Warning: Module '${moduleName}' is deprecated.`);
    }
    
    // Get download info
    const downloadInfo = await client.getDownloadUrl(moduleName);
    
    if (downloadInfo.isGitHub && downloadInfo.githubInfo) {
      if (policy?.profile === 'certified') {
        return {
          success: false,
          error:
            `Certified profile requires registry tarball provenance.\n` +
            `Registry entry for '${moduleName}' resolves to a GitHub source, which is not allowed in --profile certified.\n` +
            `Use a tarball-based registry entry (distribution.tarball + checksum), or rerun with --profile standard.`,
        };
      }
      const { org, repo, path, ref } = downloadInfo.githubInfo;
      
      // Use addFromGitHub() directly (not add() to avoid recursion)
      const result = await addFromGitHub(`${org}/${repo}`, ctx, {
        module: path,
        name: customName || moduleName,
        tag: requestedVersion || ref,
        branch: ref || 'main',
      });
      
      // If successful, update the install manifest to track registry info
      if (result.success && result.data) {
        const data = result.data as { name: string; version?: string; location?: string };
        const installName = data.name;
        
        // Update manifest with registry info
        const existingInfo = await getInstallInfo(installName);
        if (existingInfo) {
          await recordInstall(installName, {
            ...existingInfo,
            registryModule: moduleName,
            registryUrl: registryUrl,
          });
        } else {
          // Fallback: create minimal install info if not found (shouldn't happen but safety first)
          await recordInstall(installName, {
            source: 'registry',
            githubUrl: `${org}/${repo}`,
            modulePath: path,
            version: data.version,
            installedAt: data.location || '',
            installedTime: new Date().toISOString(),
            registryModule: moduleName,
            registryUrl: registryUrl,
          });
        }
        
        // Update result to indicate registry source
        result.data = {
          ...result.data,
          source: 'registry',
          registryModule: moduleName,
        };
      }
      
      return result;
    }
    
    // Tarball sources: require checksum, verify, and extract safely.
    if (!downloadInfo.url.startsWith('http')) {
      return { success: false, error: `Unsupported registry download URL: ${downloadInfo.url}` };
    }
    if (!downloadInfo.checksum) {
      return {
        success: false,
        error: `Registry tarball missing checksum (required for safe install): ${moduleName}`,
      };
    }

    tempDir = join(tmpdir(), `cog-reg-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const tarPath = join(tempDir, 'module.tar.gz');

    const MAX_TARBALL_BYTES = 20 * 1024 * 1024; // 20MB
    const actualSha256 = await downloadTarballWithSha256(downloadInfo.url, tarPath, MAX_TARBALL_BYTES);

    const expected = downloadInfo.checksum;
    const checksumMatch = expected.match(/^sha256:([a-f0-9]{64})$/);
    if (!checksumMatch) {
      throw new Error(`Unsupported checksum format (expected sha256:<64hex>): ${expected}`);
    }
    const expectedHash = checksumMatch[1];
    if (actualSha256 !== expectedHash) {
      throw new Error(`Checksum mismatch for ${moduleName}: expected ${expectedHash}, got ${actualSha256}`);
    }

    const extractedRoot = join(tempDir, 'pkg');
    mkdirSync(extractedRoot, { recursive: true });
    await extractTarGzFile(tarPath, extractedRoot, {
      maxFiles: 5_000,
      maxTotalBytes: 50 * 1024 * 1024,
      maxSingleFileBytes: 20 * 1024 * 1024,
      maxTarBytes: 100 * 1024 * 1024,
    });

    // Find module directory inside extractedRoot.
    const rootNames = readdirSync(extractedRoot).filter((e) => e !== '__MACOSX' && e !== '.DS_Store');
    const rootPaths = rootNames.map((e) => join(extractedRoot, e)).filter((p) => existsSync(p));
    const rootDirs = rootPaths.filter((p) => statSync(p).isDirectory());
    const rootFiles = rootPaths.filter((p) => !statSync(p).isDirectory());

    if (rootDirs.length === 0) {
      throw new Error('Tarball extraction produced no root directory');
    }
	    if (rootDirs.length !== 1 || rootFiles.length > 0) {
	      throw new Error(
	        `Tarball must contain exactly one module root directory and no other top-level entries. ` +
	        `dirs=${rootDirs.map((p) => basename(p)).join(',') || '(none)'} files=${rootFiles.map((p) => basename(p)).join(',') || '(none)'}`
	      );
	    }

    // Strict mode: require root dir itself to be a valid module.
    const sourcePath = rootDirs[0];
    if (!isValidModule(sourcePath)) {
      throw new Error('Root directory in tarball is not a valid module');
    }

    const installName = (customName || moduleName);
    const safeInstallName = assertSafeModuleName(installName);
    const targetPath = resolveModuleTarget(safeInstallName);

    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
    await mkdir(USER_MODULES_DIR, { recursive: true });
    copyDir(sourcePath, targetPath);

    const version = await getModuleVersion(sourcePath);
    // Write provenance + integrity (enables certified profile gating).
    try {
      const integrity = await computeModuleIntegrity(targetPath);
      await writeModuleProvenance(targetPath, {
        spec: PROVENANCE_SPEC,
        createdAt: new Date().toISOString(),
        source: {
          type: 'registry',
          registryUrl: registryUrl ?? null,
          moduleName,
          requestedVersion: requestedVersion ?? null,
          resolvedVersion: version ?? null,
          tarballUrl: downloadInfo.url,
          checksum: downloadInfo.checksum,
          sha256: actualSha256,
          quality: {
            // moduleInfo is typed loosely (v1/v2); best-effort extract for v2.
            verified: (moduleInfo as any)?.quality?.verified,
            conformance_level: (moduleInfo as any)?.quality?.conformance_level,
            spec_version: (moduleInfo as any)?.identity?.spec_version,
          },
        },
        integrity,
      });
    } catch (e) {
      // If provenance fails, keep install but warn loudly (non-certified users can still run).
      console.error(`Warning: failed to write provenance for ${safeInstallName}: ${(e as Error).message}`);
    }
    await recordInstall(safeInstallName, {
      source: downloadInfo.url,
      githubUrl: downloadInfo.url,
      version,
      installedAt: targetPath,
      installedTime: new Date().toISOString(),
      registryModule: moduleName,
      registryUrl,
    });

    return {
      success: true,
      data: {
        message: `Added: ${safeInstallName}${version ? ` v${version}` : ''} (registry tarball)`,
        name: safeInstallName,
        version,
        location: targetPath,
        source: 'registry',
        registryModule: moduleName,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Add a module from GitHub
 */
export async function addFromGitHub(
  url: string,
  ctx: CommandContext,
  options: AddOptions = {}
): Promise<CommandResult> {
  const { org, repo, fullUrl } = parseGitHubUrl(url);
  const { module: modulePath, name, branch = 'main', tag } = options;
  const policy = ctx.policy;

  if (policy?.profile === 'certified') {
    return {
      success: false,
      error:
        `Certified profile requires registry tarball provenance; GitHub installs are not allowed.\n` +
        `Use 'cog add <module>' against a tarball-based registry entry, or rerun with --profile standard.`,
    };
  }
  
  // Determine ref (tag takes priority)
  const ref = tag || branch;
  const isTag = !!tag;
  
  let repoRoot: string | undefined;
  let sourcePath: string;
  let moduleName: string;
  
  try {
    // Download repository
    repoRoot = await downloadAndExtract(org, repo, ref, isTag);
    
    // Find module
    if (modulePath) {
      sourcePath = findModuleInRepo(repoRoot, modulePath);
    } else {
      // Use repo root as module
      if (!isValidModule(repoRoot)) {
        throw new Error(
          'Repository root is not a valid module. Use --module to specify the module path.'
        );
      }
      sourcePath = repoRoot;
    }
    
    // Determine module name
    moduleName = name ? assertSafeModuleName(name) : basename(sourcePath);
    
    // Get version
    const version = await getModuleVersion(sourcePath);
    
    // Install to user modules dir
    const targetPath = resolveModuleTarget(moduleName);
    
    // Remove existing
    if (existsSync(targetPath)) {
      rmSync(targetPath, { recursive: true, force: true });
    }
    
    // Copy module
    await mkdir(USER_MODULES_DIR, { recursive: true });
    copyDir(sourcePath, targetPath);
    
    // Record installation info
    await recordInstall(moduleName, {
      source: sourcePath,
      githubUrl: fullUrl,
      modulePath,
      tag,
      branch,
      version,
      installedAt: targetPath,
      installedTime: new Date().toISOString(),
    });

    // Best-effort provenance for non-certified installs (useful for audit/debug).
    try {
      const integrity = await computeModuleIntegrity(targetPath);
      await writeModuleProvenance(targetPath, {
        spec: PROVENANCE_SPEC,
        createdAt: new Date().toISOString(),
        source: { type: 'github', repoUrl: fullUrl, ref, modulePath: modulePath ?? null },
        integrity,
      });
    } catch {
      // ignore
    }
    
    // Cleanup temp directory
    const tempDir = dirname(repoRoot);
    if (tempDir && tempDir !== '/' && tempDir !== '.' && tempDir !== USER_MODULES_DIR) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    
    return {
      success: true,
      data: {
        message: `Added: ${moduleName}${version ? ` v${version}` : ''}`,
        name: moduleName,
        version,
        location: targetPath,
        source: 'github',
      },
    };
  } catch (error) {
    // Cleanup temp directory on error
    if (repoRoot) {
      try {
        const tempDir = dirname(repoRoot);
        if (tempDir && tempDir !== '/' && tempDir !== '.' && tempDir !== USER_MODULES_DIR) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Add a module from GitHub or Registry (auto-detect source)
 */
export async function add(
  source: string,
  ctx: CommandContext,
  options: AddOptions = {}
): Promise<CommandResult> {
  // Allow a global registry override via ctx.registryUrl unless explicitly set.
  if (!options.registry && ctx.registryUrl) {
    options = { ...options, registry: ctx.registryUrl };
  }
  // Determine source type
  if (isGitHubSource(source)) {
    return addFromGitHub(source, ctx, options);
  } else {
    // Treat as registry module name
    return addFromRegistry(source, ctx, options);
  }
}
