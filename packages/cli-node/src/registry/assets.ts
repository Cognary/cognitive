import * as fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { finished } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { extractTarGzFile } from './tar.js';

export interface BuildRegistryOptions {
  tag?: string | null;
  tarballBaseUrl?: string | null;
  modulesDir: string;
  v1RegistryPath: string;
  outDir: string;
  registryOut: string;
  namespace: string;
  runtimeMin: string;
  repository: string;
  homepage: string;
  license: string;
  timestamp?: string | null;
  only?: string[];
}

export interface VerifyRegistryOptions {
  registryIndexPath: string;
  assetsDir?: string;
  maxTarballBytes?: number;
  remote?: boolean;
  fetchTimeoutMs?: number;
  maxIndexBytes?: number;
  concurrency?: number;
}

export interface RegistryBuildResult {
  registryOut: string;
  outDir: string;
  updated: string;
  modules: Array<{
    name: string;
    version: string;
    file: string;
    sha256: string;
    size_bytes: number;
  }>;
}

export interface RegistryVerifyResult {
  ok: boolean;
  checked: number;
  passed: number;
  failed: number;
  failures: Array<{ module: string; reason: string; tarball?: string; phase?: string }>;
}

function isHttpUrl(maybeUrl: string): boolean {
  try {
    const u = new URL(maybeUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function tarballFileName(tarballRef: string): string {
  if (isHttpUrl(tarballRef)) {
    // Ignore query/hash and use the URL pathname for a stable filename.
    const u = new URL(tarballRef);
    return path.basename(u.pathname);
  }
  return path.basename(tarballRef);
}

function resolveRemoteUrl(indexUrl: string, ref: string): string {
  if (isHttpUrl(ref)) return ref;
  // Allow relative tarball refs in remote indexes for portability.
  // Example:
  // - index: https://host/registry.json
  // - tarball: demo-1.0.0.tar.gz
  // resolves to https://host/demo-1.0.0.tar.gz
  try {
    return new URL(ref, indexUrl).toString();
  } catch {
    return ref;
  }
}

async function fetchTextWithLimit(url: string, maxBytes: number, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers?.get('content-length');
    if (contentLength) {
      const n = Number(contentLength);
      if (!Number.isNaN(n) && n > maxBytes) {
        throw new Error(`Remote payload too large: ${n} bytes (max ${maxBytes})`);
      }
    }

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let total = 0;
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            total += value.byteLength;
            if (total > maxBytes) {
              controller.abort();
              throw new Error(`Remote payload too large: ${total} bytes (max ${maxBytes})`);
            }
            buf += decoder.decode(value, { stream: true });
          }
        }
        buf += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      return buf;
    }

    const text = await res.text();
    const byteLen = Buffer.byteLength(text, 'utf-8');
    if (byteLen > maxBytes) {
      throw new Error(`Remote payload too large: ${byteLen} bytes (max ${maxBytes})`);
    }
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Fetch timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function downloadToFileWithSha256(
  url: string,
  outPath: string,
  maxBytes: number,
  timeoutMs: number
): Promise<{ sha256: string; sizeBytes: number }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch tarball: ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers?.get('content-length');
    if (contentLength) {
      const n = Number(contentLength);
      if (!Number.isNaN(n) && n > maxBytes) {
        throw new Error(`Tarball too large: ${n} bytes (max ${maxBytes})`);
      }
    }

    if (!res.body) {
      throw new Error('Tarball fetch returned no body');
    }

    const h = createHash('sha256');
    const ws = createWriteStream(outPath, { flags: 'w', mode: 0o644 });
    let total = 0;

    const writeChunk = async (chunk: Buffer) => {
      if (!chunk.length) return;
      const ok = ws.write(chunk);
      if (ok) return;
      await new Promise<void>((resolveDrain, rejectDrain) => {
        const onDrain = () => {
          cleanup();
          resolveDrain();
        };
        const onError = (err: Error) => {
          cleanup();
          rejectDrain(err);
        };
        const cleanup = () => {
          ws.off('drain', onDrain);
          ws.off('error', onError);
        };
        ws.once('drain', onDrain);
        ws.once('error', onError);
      });
    };

    try {
      // Prefer the Web ReadableStream reader API when available.
      const body: any = res.body as any;
      if (body && typeof body.getReader === 'function') {
        const reader = body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const buf = Buffer.from(value);
            total += buf.length;
            if (total > maxBytes) {
              controller.abort();
              throw new Error(`Tarball too large: ${total} bytes (max ${maxBytes})`);
            }
            h.update(buf);
            await writeChunk(buf);
          }
        } finally {
          reader.releaseLock?.();
        }
      } else {
        // Fallback: async iteration (Node fetch supports this for ReadableStream in newer runtimes).
        const stream: any = res.body as any;
        for await (const chunk of stream as AsyncIterable<Uint8Array>) {
          const buf = Buffer.from(chunk);
          total += buf.length;
          if (total > maxBytes) {
            controller.abort();
            throw new Error(`Tarball too large: ${total} bytes (max ${maxBytes})`);
          }
          h.update(buf);
          await writeChunk(buf);
        }
      }

      ws.end();
      await finished(ws as any);
    } catch (e) {
      try {
        ws.destroy();
      } catch {
        // ignore
      }
      throw e;
    }

    return { sha256: h.digest('hex'), sizeBytes: total };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Tarball fetch timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function nowIsoUtc(): string {
  const d = new Date();
  const iso = d.toISOString();
  // keep seconds precision like the python tool (best effort)
  return iso.replace(/\.\d{3}Z$/, 'Z');
}

function jsonStringifyAscii(obj: unknown): string {
  const s = JSON.stringify(obj, null, 2);
  // Escape non-ASCII to keep registry ASCII-only for portability and stable diffs.
  return s.replace(/[^\x00-\x7F]/g, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xffff) {
      return `\\u${cp.toString(16).padStart(4, '0')}`;
    }
    // surrogate pair
    const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
    const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
    return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
  }) + '\n';
}

async function sha256File(filePath: string): Promise<string> {
  const h = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(filePath);
    rs.on('data', (chunk) => h.update(chunk));
    rs.on('error', reject);
    rs.on('end', resolve);
  });
  return h.digest('hex');
}

async function listFiles(moduleDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(relDir: string): Promise<void> {
    const abs = path.join(moduleDir, relDir);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.DS_Store') continue;
      const rel = relDir ? path.posix.join(relDir.replace(/\\/g, '/'), ent.name) : ent.name;
      const absPath = path.join(moduleDir, rel);
      const st = await fs.lstat(absPath);
      if (st.isSymbolicLink()) {
        throw new Error(`Refusing to package symlink: ${absPath}`);
      }
      if (ent.isDirectory()) {
        await walk(rel);
      } else if (ent.isFile()) {
        out.push(rel);
      }
    }
  }

  await walk('');
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function writeOctal(buf: Buffer, offset: number, length: number, value: number): void {
  const oct = value.toString(8);
  const str = oct.padStart(length - 1, '0') + '\0';
  buf.write(str, offset, length, 'ascii');
}

function pad512(n: number): number {
  return Math.ceil(n / 512) * 512;
}

function tarChecksum(header: Buffer): number {
  for (let i = 148; i < 156; i++) header[i] = 0x20; // spaces
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  return sum;
}

function makeTarHeader(opts: {
  name: string;
  size: number;
  typeflag: string;
  mode?: number;
}): Buffer {
  const h = Buffer.alloc(512, 0);
  h.write(opts.name, 0, 100, 'utf-8');
  writeOctal(h, 100, 8, opts.mode ?? 0o644);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, opts.size);
  writeOctal(h, 136, 12, 0); // mtime=0 for deterministic builds
  h.write(opts.typeflag, 156, 1, 'ascii');
  h.write('ustar\0', 257, 6, 'ascii');
  h.write('00', 263, 2, 'ascii');
  h.write('root', 265, 32, 'ascii');
  h.write('root', 297, 32, 'ascii');

  const sum = tarChecksum(h);
  const sumStr = sum.toString(8).padStart(6, '0');
  h.write(sumStr, 148, 6, 'ascii');
  h[154] = 0; // NUL
  h[155] = 0x20; // space
  return h;
}

function paxRecord(key: string, value: string): string {
  // PAX: "<len> <key>=<value>\n" where len counts the entire record.
  const base = `${key}=${value}\n`;
  // Compute len iteratively because len digits affect total length.
  let len = base.length + String(base.length).length + 1; // rough
  while (true) {
    const rec = `${len} ${base}`;
    if (rec.length === len) return rec;
    len = rec.length;
  }
}

async function writeToStream(ws: NodeJS.WritableStream, chunk: Buffer): Promise<void> {
  if (!chunk.length) return;
  const ok = ws.write(chunk);
  if (ok) return;
  await new Promise<void>((resolve) => (ws as any).once('drain', resolve));
}

async function writeFileIntoStream(ws: NodeJS.WritableStream, filePath: string): Promise<number> {
  const st = await fs.stat(filePath);
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(filePath);
    rs.on('error', reject);
    rs.on('end', resolve);
    rs.on('data', async (chunk) => {
      rs.pause();
      try {
        await writeToStream(ws, Buffer.from(chunk));
        rs.resume();
      } catch (e) {
        reject(e);
      }
    });
  });
  return st.size;
}

async function readModuleMeta(moduleYamlPath: string): Promise<{ name: string; version: string; tier: string; responsibility: string }> {
  const content = await fs.readFile(moduleYamlPath, 'utf-8');
  const loaded = yaml.load(content);
  const manifest = loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {};

  const name = String(manifest.name ?? '').trim();
  const version = String(manifest.version ?? '').trim();
  const tier = String(manifest.tier ?? '').trim();
  const responsibility = String(manifest.responsibility ?? '').trim();
  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!version) missing.push('version');
  if (!tier) missing.push('tier');
  if (!responsibility) missing.push('responsibility');
  if (missing.length) {
    throw new Error(`module.yaml missing required keys [${missing.join(', ')}]: ${moduleYamlPath}`);
  }
  return { name, version, tier, responsibility };
}

async function buildTarball(moduleDir: string, outPath: string, moduleName: string): Promise<void> {
  const relFiles = await listFiles(moduleDir);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const rawOut = createWriteStream(outPath, { flags: 'w', mode: 0o644 });
  // Node supports `mtime` for deterministic gzip headers, but TS typings may lag.
  const gz = createGzip({ mtime: 0 } as any);
  gz.pipe(rawOut);

  let paxIndex = 0;
  try {
    for (const rel of relFiles) {
      const abs = path.join(moduleDir, rel);
      const fullPath = `${moduleName}/${rel}`.replace(/\\/g, '/');

      // Add PAX header when path is too long for ustar name/prefix.
      // This keeps extraction compatible with our Node extractor (supports PAX).
      const needsPax = Buffer.byteLength(fullPath, 'utf-8') > 255;
      const canUstar = Buffer.byteLength(fullPath, 'utf-8') <= 255;

      if (needsPax || !canUstar) {
        const payload = Buffer.from(paxRecord('path', fullPath), 'utf-8');
        const paxName = `pax-${String(paxIndex++).padStart(6, '0')}`;
        const paxHeader = makeTarHeader({ name: paxName, size: payload.length, typeflag: 'x', mode: 0o644 });
        await writeToStream(gz, paxHeader);
        await writeToStream(gz, payload);
        const pad = pad512(payload.length) - payload.length;
        if (pad) await writeToStream(gz, Buffer.alloc(pad, 0));

        const st = await fs.stat(abs);
        const placeholder = `${moduleName}/${path.basename(rel).slice(0, 80)}`.replace(/\\/g, '/');
        const fileHeader = makeTarHeader({ name: placeholder, size: st.size, typeflag: '0', mode: 0o644 });
        await writeToStream(gz, fileHeader);
        await writeFileIntoStream(gz, abs);
        const padFile = pad512(st.size) - st.size;
        if (padFile) await writeToStream(gz, Buffer.alloc(padFile, 0));
        continue;
      }

      // Try to fit into ustar prefix/name when possible, else fall back to PAX.
      const nameBytes = Buffer.byteLength(fullPath, 'utf-8');
      if (nameBytes <= 100) {
        const st = await fs.stat(abs);
        const fileHeader = makeTarHeader({ name: fullPath, size: st.size, typeflag: '0', mode: 0o644 });
        await writeToStream(gz, fileHeader);
        await writeFileIntoStream(gz, abs);
        const padFile = pad512(st.size) - st.size;
        if (padFile) await writeToStream(gz, Buffer.alloc(padFile, 0));
        continue;
      }

      // Use PAX for paths that don't fit the 100-byte name field.
      const payload = Buffer.from(paxRecord('path', fullPath), 'utf-8');
      const paxName = `pax-${String(paxIndex++).padStart(6, '0')}`;
      const paxHeader = makeTarHeader({ name: paxName, size: payload.length, typeflag: 'x', mode: 0o644 });
      await writeToStream(gz, paxHeader);
      await writeToStream(gz, payload);
      const pad = pad512(payload.length) - payload.length;
      if (pad) await writeToStream(gz, Buffer.alloc(pad, 0));

      const st = await fs.stat(abs);
      const placeholder = `${moduleName}/${path.basename(rel).slice(0, 80)}`.replace(/\\/g, '/');
      const fileHeader = makeTarHeader({ name: placeholder, size: st.size, typeflag: '0', mode: 0o644 });
      await writeToStream(gz, fileHeader);
      await writeFileIntoStream(gz, abs);
      const padFile = pad512(st.size) - st.size;
      if (padFile) await writeToStream(gz, Buffer.alloc(padFile, 0));
    }

    // EOF blocks.
    await writeToStream(gz, Buffer.alloc(1024, 0));
    gz.end();
    await finished(rawOut);
  } finally {
    try {
      gz.destroy();
    } catch {
      // ignore
    }
    try {
      rawOut.destroy();
    } catch {
      // ignore
    }
  }
}

async function loadV1Registry(v1RegistryPath: string): Promise<Record<string, any>> {
  const raw = await fs.readFile(v1RegistryPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, any>;
  return parsed;
}

function deriveTarballBaseUrl(opts: BuildRegistryOptions): string | null {
  if (opts.tarballBaseUrl) return String(opts.tarballBaseUrl);
  const tag = (opts.tag ?? '').trim();
  if (!tag) return null;
  const repo = String(opts.repository).replace(/\/+$/, '');
  return `${repo}/releases/download/${tag}`;
}

export async function buildRegistryAssets(opts: BuildRegistryOptions): Promise<RegistryBuildResult> {
  const v1 = await loadV1Registry(opts.v1RegistryPath);
  const v1Modules = (v1.modules ?? {}) as Record<string, any>;
  const only = new Set((opts.only ?? []).map((s) => s.trim()).filter(Boolean));
  const updated = (opts.timestamp ?? '').trim() || nowIsoUtc();
  const tarballBaseUrl = deriveTarballBaseUrl(opts);

  const modulesDir = path.resolve(opts.modulesDir);
  const outDir = path.resolve(opts.outDir);
  const registryOut = path.resolve(opts.registryOut);

  const moduleYamlPaths: string[] = [];
  const entries = await fs.readdir(modulesDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const yamlPath = path.join(modulesDir, ent.name, 'module.yaml');
    try {
      await fs.access(yamlPath);
      moduleYamlPaths.push(yamlPath);
    } catch {
      // skip
    }
  }
  moduleYamlPaths.sort((a, b) => a.localeCompare(b));

  const built: RegistryBuildResult['modules'] = [];
  const registryModules: Record<string, any> = {};

  for (const moduleYamlPath of moduleYamlPaths) {
    const moduleDir = path.dirname(moduleYamlPath);
    const meta = await readModuleMeta(moduleYamlPath);
    if (only.size && !only.has(meta.name)) continue;

    const v1Info = v1Modules[meta.name] ?? {};
    const description = String(v1Info.description ?? meta.responsibility);
    const author = String(v1Info.author ?? 'unknown');
    const keywords = Array.isArray(v1Info.tags) ? v1Info.tags : [];

    const tarName = `${meta.name}-${meta.version}.tar.gz`;
    const tarPath = path.join(outDir, tarName);
    await buildTarball(moduleDir, tarPath, meta.name);
    const digest = await sha256File(tarPath);
    const sizeBytes = (await fs.stat(tarPath)).size;

    const tarballUrl = tarballBaseUrl ? `${tarballBaseUrl}/${tarName}` : tarName;

    registryModules[meta.name] = {
      $schema: 'https://cognitive-modules.dev/schema/registry-entry-v1.json',
      identity: {
        name: meta.name,
        namespace: opts.namespace,
        version: meta.version,
        spec_version: '2.2',
      },
      metadata: {
        description,
        description_zh: description,
        author,
        tier: meta.tier,
        license: opts.license,
        repository: opts.repository,
        homepage: opts.homepage,
        keywords,
      },
      dependencies: {
        runtime_min: opts.runtimeMin,
        modules: [],
      },
      distribution: {
        tarball: tarballUrl,
        checksum: `sha256:${digest}`,
        size_bytes: sizeBytes,
        files: await listFiles(moduleDir),
      },
      timestamps: {
        created_at: updated,
        updated_at: updated,
        deprecated_at: null,
      },
    };

    built.push({ name: meta.name, version: meta.version, file: tarName, sha256: digest, size_bytes: sizeBytes });
  }

  const registry = {
    $schema: 'https://cognitive-modules.dev/schema/registry-v2.json',
    version: '2.0.0',
    updated,
    modules: registryModules,
    categories: v1.categories ?? {},
    featured: Object.keys(registryModules),
    stats: {
      total_modules: Object.keys(registryModules).length,
      total_downloads: 0,
      last_updated: updated,
    },
  };

  await fs.mkdir(path.dirname(registryOut), { recursive: true });
  await fs.writeFile(registryOut, jsonStringifyAscii(registry), 'utf-8');

  return {
    registryOut,
    outDir,
    updated,
    modules: built,
  };
}

function isValidModuleDir(dirPath: string): Promise<boolean> {
  return fs
    .access(path.join(dirPath, 'module.yaml'))
    .then(() => true)
    .catch(() => fs.access(path.join(dirPath, 'MODULE.md')).then(() => true).catch(() => fs.access(path.join(dirPath, 'module.md')).then(() => true).catch(() => false)));
}

export async function verifyRegistryAssets(opts: VerifyRegistryOptions): Promise<RegistryVerifyResult> {
  const maxIndexBytes = opts.maxIndexBytes ?? 2 * 1024 * 1024; // 2MB
  const fetchTimeoutMs = opts.fetchTimeoutMs ?? 15_000; // 15s
  const maxTarballBytes = opts.maxTarballBytes ?? 25 * 1024 * 1024; // 25MB

  const wantRemote = Boolean(opts.remote) || isHttpUrl(opts.registryIndexPath);

  let registryRaw: string;
  if (wantRemote) {
    if (!isHttpUrl(opts.registryIndexPath)) {
      throw new Error(`--remote requires an http(s) registry index URL, got: ${opts.registryIndexPath}`);
    }
    registryRaw = await fetchTextWithLimit(opts.registryIndexPath, maxIndexBytes, fetchTimeoutMs);
  } else {
    registryRaw = await fs.readFile(opts.registryIndexPath, 'utf-8');
  }

  const registry = JSON.parse(registryRaw) as any;
  const modules = (registry.modules ?? {}) as Record<string, any>;

  const failures: RegistryVerifyResult['failures'] = [];
  let checked = 0;
  let passed = 0;

  const tmpAssetsRoot = wantRemote && !opts.assetsDir ? await fs.mkdtemp(path.join(tmpdir(), 'cog-reg-assets-')) : null;
  const assetsDir = opts.assetsDir ?? tmpAssetsRoot ?? '';
  if (!wantRemote && !assetsDir) {
    throw new Error('Local verify requires --assets-dir (directory containing tarballs)');
  }

  const entries = Object.entries(modules);
  const desiredConcurrency = opts.concurrency ?? (wantRemote ? 4 : 1);
  const concurrency = Math.max(1, Math.min(8, Math.floor(desiredConcurrency)));

  const localTarPath = async (moduleName: string, tarballRef: string): Promise<string> => {
    const fileName = tarballFileName(tarballRef);
    // Avoid collisions on remote verify (query strings can produce identical basenames).
    // Even when the caller provides --assets-dir, we isolate per module to keep verification correct.
    if (wantRemote) {
      const p = path.join(assetsDir, moduleName, fileName);
      await fs.mkdir(path.dirname(p), { recursive: true });
      return p;
    }
    return path.join(assetsDir, fileName);
  };

  const verifyOne = async (moduleName: string, entry: any): Promise<void> => {
    checked += 1;
    let tarPathForCleanup: string | null = null;
    try {
      const dist = (entry as any).distribution ?? {};
      const tarballRef = String(dist.tarball ?? '');
      const checksum = String(dist.checksum ?? '');
      const sizeBytesRaw = dist.size_bytes;
      const expectedSizeBytes = Number.isFinite(Number(sizeBytesRaw)) ? Number(sizeBytesRaw) : null;
      const expectedFiles: string[] = Array.isArray(dist.files) ? dist.files.map(String) : [];

      if (!tarballRef) throw new Error('Missing distribution.tarball');
      const tarballUrl = wantRemote ? resolveRemoteUrl(opts.registryIndexPath, tarballRef) : tarballRef;
      const tarPath = await localTarPath(moduleName, tarballUrl);
      tarPathForCleanup = tarPath;

      if (wantRemote) {
        if (!isHttpUrl(tarballUrl)) {
          throw new Error(`Remote verify requires http(s) tarball URL (or a relative URL), got: ${tarballRef}`);
        }
        const downloaded = await downloadToFileWithSha256(tarballUrl, tarPath, maxTarballBytes, fetchTimeoutMs);
        if (expectedSizeBytes !== null && downloaded.sizeBytes !== expectedSizeBytes) {
          throw new Error(`Size mismatch: expected ${expectedSizeBytes}, got ${downloaded.sizeBytes}`);
        }
        const m = checksum.match(/^sha256:([a-f0-9]{64})$/);
        if (!m) throw new Error(`Unsupported checksum format: ${checksum}`);
        const expectedSha = m[1];
        if (downloaded.sha256 !== expectedSha) {
          throw new Error(`Checksum mismatch: expected ${expectedSha}, got ${downloaded.sha256}`);
        }
      }

      const st = await fs.stat(tarPath);
      if (expectedSizeBytes !== null && st.size !== expectedSizeBytes) {
        throw new Error(`Size mismatch: expected ${expectedSizeBytes}, got ${st.size}`);
      }

      const m = checksum.match(/^sha256:([a-f0-9]{64})$/);
      if (!m) throw new Error(`Unsupported checksum format: ${checksum}`);
      const expectedSha = m[1];
      const actualSha = await sha256File(tarPath);
      if (actualSha !== expectedSha) throw new Error(`Checksum mismatch: expected ${expectedSha}, got ${actualSha}`);

      // Extract and validate contents (layout + file list).
      const tmp = await fs.mkdtemp(path.join(tmpdir(), 'cog-reg-verify-'));
      try {
        const extractedRoot = path.join(tmp, 'pkg');
        await fs.mkdir(extractedRoot, { recursive: true });
        await extractTarGzFile(tarPath, extractedRoot, {
          maxFiles: 5_000,
          maxTotalBytes: 50 * 1024 * 1024,
          maxSingleFileBytes: 20 * 1024 * 1024,
          maxTarBytes: 100 * 1024 * 1024,
        });

        const rootNames = (await fs.readdir(extractedRoot)).filter((e) => e !== '__MACOSX' && e !== '.DS_Store');
        const rootPaths = rootNames.map((e) => path.join(extractedRoot, e));
        const stats = await Promise.all(rootPaths.map(async (p) => ({ p, st: await fs.stat(p) })));
        const rootDirs = stats.filter((x) => x.st.isDirectory()).map((x) => x.p);
        const rootFiles = stats.filter((x) => !x.st.isDirectory()).map((x) => x.p);

        if (rootDirs.length !== 1 || rootFiles.length > 0) {
          throw new Error('Tarball must contain exactly one root directory and no other top-level entries');
        }
        const moduleDir = rootDirs[0];
        if (!(await isValidModuleDir(moduleDir))) {
          throw new Error('Root directory is not a valid module');
        }

        if (expectedFiles.length > 0) {
          const actualFiles = await listFiles(moduleDir);
          const exp = expectedFiles.slice().sort();
          const act = actualFiles.slice().sort();
          if (exp.length !== act.length) {
            throw new Error(`File list mismatch: expected ${exp.length} files, got ${act.length}`);
          }
          for (let i = 0; i < exp.length; i++) {
            if (exp[i] !== act[i]) throw new Error(`File list mismatch at ${i}: expected ${exp[i]}, got ${act[i]}`);
          }
        }

        // Basic identity check: module.yaml version matches registry identity.version
        try {
          const y = await readModuleMeta(path.join(moduleDir, 'module.yaml'));
          const identityVersion = String((entry as any).identity?.version ?? '').trim();
          if (identityVersion && y.version !== identityVersion) {
            throw new Error(`module.yaml version mismatch: registry=${identityVersion}, module.yaml=${y.version}`);
          }
          const identityName = String((entry as any).identity?.name ?? '').trim();
          if (identityName && y.name !== identityName) {
            throw new Error(`module.yaml name mismatch: registry=${identityName}, module.yaml=${y.name}`);
          }
        } catch {
          // ignore if module.yaml is missing or malformed; module validity already checked
        }
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }

      passed += 1;
    } catch (e) {
      const dist = (entry as any)?.distribution ?? {};
      const tarball = typeof dist.tarball === 'string' ? dist.tarball : undefined;
      failures.push({ module: moduleName, reason: e instanceof Error ? e.message : String(e), tarball });
    } finally {
      // If we downloaded tarballs into a temp dir, keep disk usage bounded.
      if (wantRemote && tmpAssetsRoot && tarPathForCleanup) {
        try {
          await fs.rm(tarPathForCleanup, { force: true });
        } catch {
          // ignore
        }
      }
    }
  };

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= entries.length) break;
      const [name, entry] = entries[i];
      await verifyOne(name, entry);
    }
  });

  await Promise.all(workers);

  if (tmpAssetsRoot) {
    await fs.rm(tmpAssetsRoot, { recursive: true, force: true });
  }

  return {
    ok: failures.length === 0,
    checked,
    passed,
    failed: failures.length,
    failures,
  };
}
