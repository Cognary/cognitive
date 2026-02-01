/**
 * Add command - Install modules from GitHub
 * 
 * cog add ziel-io/cognitive-modules -m code-simplifier
 * cog add https://github.com/org/repo --module name --tag v1.0.0
 */

import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createGunzip } from 'node:zlib';
import type { CommandContext, CommandResult } from '../types.js';

// Module storage paths
const USER_MODULES_DIR = join(homedir(), '.cognitive', 'modules');
const INSTALLED_MANIFEST = join(homedir(), '.cognitive', 'installed.json');

export interface AddOptions {
  module?: string;
  name?: string;
  branch?: string;
  tag?: string;
}

interface InstallManifest {
  [moduleName: string]: {
    source: string;
    githubUrl: string;
    modulePath?: string;
    tag?: string;
    branch?: string;
    version?: string;
    installedAt: string;
    installedTime: string;
  };
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
  const possiblePaths = [
    join(repoRoot, modulePath),
    join(repoRoot, 'cognitive', 'modules', modulePath),
    join(repoRoot, 'modules', modulePath),
  ];
  
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
    
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
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
 * Add a module from GitHub
 */
export async function add(
  url: string,
  ctx: CommandContext,
  options: AddOptions = {}
): Promise<CommandResult> {
  const { org, repo, fullUrl } = parseGitHubUrl(url);
  const { module: modulePath, name, branch = 'main', tag } = options;
  
  // Determine ref (tag takes priority)
  const ref = tag || branch;
  const isTag = !!tag;
  
  let repoRoot: string;
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
    moduleName = name || basename(sourcePath);
    
    // Get version
    const version = await getModuleVersion(sourcePath);
    
    // Install to user modules dir
    const targetPath = join(USER_MODULES_DIR, moduleName);
    
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
    
    // Cleanup temp directory
    const tempDir = repoRoot.split('/').slice(0, -1).join('/');
    rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      data: {
        message: `Added: ${moduleName}${version ? ` v${version}` : ''}`,
        name: moduleName,
        version,
        location: targetPath,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
