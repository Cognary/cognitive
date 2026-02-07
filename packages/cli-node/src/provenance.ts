import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';

export const PROVENANCE_FILENAME = 'provenance.json';
export const PROVENANCE_SPEC = 'cognitive.module.provenance/v1';

export type ProvenanceSource =
  | {
      type: 'registry';
      registryUrl?: string | null;
      moduleName: string;
      requestedVersion?: string | null;
      resolvedVersion?: string | null;
      tarballUrl: string;
      checksum: string; // e.g. "sha256:<hex>"
      sha256: string; // hex
      quality?: {
        verified?: boolean;
        conformance_level?: number;
        spec_version?: string;
      };
    }
  | {
      type: 'github';
      repoUrl: string;
      ref?: string | null;
      modulePath?: string | null;
    };

export interface ModuleIntegrity {
  algorithm: 'sha256';
  maxFiles: number;
  maxTotalBytes: number;
  maxSingleFileBytes: number;
  totalBytes: number;
  files: Record<string, string>; // relPath -> sha256 hex
}

export interface ModuleProvenance {
  spec: typeof PROVENANCE_SPEC;
  createdAt: string; // ISO timestamp
  source: ProvenanceSource;
  integrity: ModuleIntegrity;
}

export interface IntegrityOptions {
  maxFiles: number;
  maxTotalBytes: number;
  maxSingleFileBytes: number;
}

const DEFAULT_INTEGRITY_LIMITS: IntegrityOptions = {
  maxFiles: 5_000,
  maxTotalBytes: 50 * 1024 * 1024, // 50MB
  maxSingleFileBytes: 20 * 1024 * 1024, // 20MB
};

async function hashFileSha256(filePath: string, size: number): Promise<string> {
  const h = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(filePath);
    rs.on('data', (chunk) => h.update(chunk));
    rs.on('error', reject);
    rs.on('end', resolve);
  });
  // Include size in the hash domain separation to make accidental truncation obvious.
  h.update(`\nsize:${size}\n`);
  return h.digest('hex');
}

async function walkFiles(rootDir: string, relDir: string): Promise<string[]> {
  const absDir = path.join(rootDir, relDir);
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const out: string[] = [];

  for (const ent of entries) {
    const rel = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), ent.name) : ent.name;
    const abs = path.join(rootDir, rel);

    // Never hash our own provenance.
    if (rel === PROVENANCE_FILENAME) continue;
    if (ent.name === '.DS_Store' || ent.name === '__MACOSX') continue;

    if (ent.isSymbolicLink()) {
      // Refuse to hash symlinks. Tar extraction also rejects them.
      continue;
    }
    if (ent.isDirectory()) {
      out.push(...await walkFiles(rootDir, rel));
      continue;
    }
    if (ent.isFile()) {
      out.push(rel);
    }
  }

  return out;
}

export async function computeModuleIntegrity(
  moduleDir: string,
  options: Partial<IntegrityOptions> = {}
): Promise<ModuleIntegrity> {
  const limits: IntegrityOptions = {
    ...DEFAULT_INTEGRITY_LIMITS,
    ...options,
  };

  const relFiles = (await walkFiles(moduleDir, '')).sort((a, b) => a.localeCompare(b));
  if (relFiles.length > limits.maxFiles) {
    throw new Error(`Module has too many files to hash (max ${limits.maxFiles}): ${relFiles.length}`);
  }

  const files: Record<string, string> = {};
  let totalBytes = 0;

  for (const rel of relFiles) {
    const abs = path.join(moduleDir, rel);
    const st = await fs.stat(abs);
    if (!st.isFile()) continue;
    if (st.size > limits.maxSingleFileBytes) {
      throw new Error(`Module file too large for integrity hashing (max ${limits.maxSingleFileBytes} bytes): ${rel}`);
    }
    totalBytes += st.size;
    if (totalBytes > limits.maxTotalBytes) {
      throw new Error(`Module too large for integrity hashing (max ${limits.maxTotalBytes} bytes)`);
    }
    const sha256 = await hashFileSha256(abs, st.size);
    files[rel] = sha256;
  }

  return {
    algorithm: 'sha256',
    maxFiles: limits.maxFiles,
    maxTotalBytes: limits.maxTotalBytes,
    maxSingleFileBytes: limits.maxSingleFileBytes,
    totalBytes,
    files,
  };
}

export async function writeModuleProvenance(moduleDir: string, prov: ModuleProvenance): Promise<void> {
  const filePath = path.join(moduleDir, PROVENANCE_FILENAME);
  const json = JSON.stringify(prov, null, 2) + '\n';
  await fs.writeFile(filePath, json, 'utf-8');
}

export async function readModuleProvenance(moduleDir: string): Promise<ModuleProvenance | null> {
  const filePath = path.join(moduleDir, PROVENANCE_FILENAME);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ModuleProvenance> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.spec !== PROVENANCE_SPEC) return null;
    if (!parsed.source || typeof parsed.source !== 'object') return null;
    if (!parsed.integrity || typeof parsed.integrity !== 'object') return null;
    return parsed as ModuleProvenance;
  } catch {
    return null;
  }
}

export async function verifyModuleIntegrity(
  moduleDir: string,
  prov: ModuleProvenance
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const expected = prov.integrity?.files ?? {};
  const expectedKeys = Object.keys(expected).sort();
  if (expectedKeys.length === 0) {
    return { ok: false, reason: 'Provenance integrity.files is empty' };
  }

  const computed = await computeModuleIntegrity(moduleDir, {
    maxFiles: prov.integrity.maxFiles,
    maxTotalBytes: prov.integrity.maxTotalBytes,
    maxSingleFileBytes: prov.integrity.maxSingleFileBytes,
  });

  const computedKeys = Object.keys(computed.files).sort();
  if (expectedKeys.length !== computedKeys.length) {
    return { ok: false, reason: 'Integrity file list changed (file count mismatch)' };
  }
  for (let i = 0; i < expectedKeys.length; i++) {
    if (expectedKeys[i] !== computedKeys[i]) {
      return { ok: false, reason: `Integrity file list changed (mismatch at ${i}: ${expectedKeys[i]} vs ${computedKeys[i]})` };
    }
  }

  for (const rel of expectedKeys) {
    const a = expected[rel];
    const b = computed.files[rel];
    if (a !== b) {
      return { ok: false, reason: `Integrity mismatch for ${rel}` };
    }
  }

  return { ok: true };
}

