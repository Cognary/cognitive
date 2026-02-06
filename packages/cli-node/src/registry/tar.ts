import { mkdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { resolve, sep, dirname } from 'node:path';
import { createGunzip } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { finished } from 'node:stream/promises';

export interface ExtractTarGzOptions {
  maxFiles?: number;
  maxTotalBytes?: number;
  maxSingleFileBytes?: number;
  // Maximum number of bytes allowed from the decompressed TAR stream (gunzip output).
  // This mitigates gzip bombs and prevents buffering the full TAR in memory.
  maxTarBytes?: number;
}

function isPathWithinRoot(rootDir: string, targetPath: string): boolean {
  const root = resolve(rootDir);
  const target = resolve(targetPath);
  return target === root || target.startsWith(root + sep);
}

function parseOctal(buf: Buffer): number {
  const raw = buf.toString('utf-8').replace(/\0/g, '').trim();
  if (!raw) return 0;
  // Tar uses octal ASCII. Some implementations pad with spaces or NUL.
  return parseInt(raw, 8);
}

function parseHeader(block: Buffer): {
  name: string;
  size: number;
  typeflag: string;
  prefix: string;
} | null {
  // End of archive: two consecutive zero blocks. Caller handles the second.
  if (block.every((b) => b === 0)) {
    return null;
  }

  const name = block.subarray(0, 100).toString('utf-8').replace(/\0/g, '');
  const size = parseOctal(block.subarray(124, 136));
  const typeflag = block.subarray(156, 157).toString('utf-8') || '\0';
  const prefix = block.subarray(345, 500).toString('utf-8').replace(/\0/g, '');

  return { name, size, typeflag, prefix };
}

function normalizeTarPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');

  if (!normalized || normalized.includes('\0')) {
    throw new Error('Unsafe tar entry (empty or NUL)');
  }
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`Unsafe tar entry (absolute path): ${path}`);
  }

  const parts = normalized.split('/');
  if (parts.includes('..')) {
    throw new Error(`Unsafe tar entry (path traversal): ${path}`);
  }

  // Collapse `.` segments without allowing traversal.
  const collapsed = parts.filter((p) => p !== '.' && p !== '').join('/');
  if (!collapsed) {
    throw new Error(`Unsafe tar entry (empty after normalize): ${path}`);
  }
  return collapsed;
}

function parsePaxAttributes(payload: Buffer): Record<string, string> {
  // PAX format: "<len> <key>=<value>\n"
  const text = payload.toString('utf-8');
  const attrs: Record<string, string> = {};

  let i = 0;
  while (i < text.length) {
    const space = text.indexOf(' ', i);
    if (space === -1) break;
    const lenStr = text.slice(i, space);
    const len = Number(lenStr);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(i, i + len);
    const eq = record.indexOf('=');
    if (eq !== -1) {
      const key = record.slice(record.indexOf(' ') + 1, eq).trim();
      const value = record.slice(eq + 1).trimEnd();
      // Strip the trailing newline if present.
      attrs[key] = value.endsWith('\n') ? value.slice(0, -1) : value;
    }
    i += len;
  }

  return attrs;
}

function createByteLimitTransform(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length;
      if (seen > maxBytes) {
        callback(new Error(`Tar stream too large after decompression (max ${maxBytes} bytes)`));
        return;
      }
      callback(null, chunk);
    },
  });
}

async function writeChunk(stream: NodeJS.WritableStream, chunk: Buffer): Promise<void> {
  if (!chunk.length) return;
  const ok = stream.write(chunk);
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
      stream.off('drain', onDrain);
      stream.off('error', onError);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

type PendingEntry =
  | { kind: 'pax'; remaining: number; originalSize: number }
  | { kind: 'globalPax'; remaining: number; originalSize: number }
  | { kind: 'longname'; remaining: number; originalSize: number }
  | { kind: 'skip'; remaining: number; originalSize: number }
  | {
      kind: 'file';
      remaining: number;
      originalSize: number;
      pathRel: string;
      outPath: string;
      stream: NodeJS.WritableStream;
    };

async function extractTarStream(
  tarStream: Readable,
  destDir: string,
  options: ExtractTarGzOptions = {}
): Promise<string[]> {
  const maxEntries = options.maxFiles ?? 5_000;
  const maxTotalBytes = options.maxTotalBytes ?? 50 * 1024 * 1024; // 50MB extracted content cap
  const maxSingleFileBytes = options.maxSingleFileBytes ?? 20 * 1024 * 1024; // 20MB per file cap

  // Guard metadata record sizes so we don't buffer huge PAX/longname payloads into memory.
  const MAX_META_BYTES = 1024 * 1024; // 1MB

  let extractedBytes = 0;
  let entriesSeen = 0;
  const written: string[] = [];

  let pendingPax: Record<string, string> | null = null;
  let pendingLongName: string | null = null;

  let buf = Buffer.alloc(0);
  let pending: PendingEntry | null = null;
  let pendingPayload = Buffer.alloc(0); // only used for pax/longname/globalPax
  let padRemaining = 0;
  let ended = false;

  const closePendingFile = async () => {
    if (!pending || pending.kind !== 'file') return;
    const ws = pending.stream;
    ws.end?.();
    try {
      await finished(ws as any);
    } catch {
      // ignore (best-effort cleanup)
    }
  };

  try {
    for await (const chunk of tarStream) {
      if (!chunk?.length) continue;
      buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk);

      while (true) {
        if (ended) break;

        // Drain padding to 512-byte boundary after each entry payload.
        if (padRemaining > 0) {
          if (buf.length === 0) break;
          const take = Math.min(padRemaining, buf.length);
          buf = buf.subarray(take);
          padRemaining -= take;
          continue;
        }

        // If we are currently consuming an entry payload, continue that first.
        if (pending) {
          if (pending.kind === 'file') {
            if (pending.remaining === 0) {
              // Zero-length file: create empty file and continue.
              await closePendingFile();
              written.push(pending.pathRel);
              pending = null;
              pendingPayload = Buffer.alloc(0);
              continue;
            }
            if (buf.length === 0) break;
            const take = Math.min(pending.remaining, buf.length);
            const slice = buf.subarray(0, take);
            await writeChunk(pending.stream, slice);
            pending.remaining -= take;
            buf = buf.subarray(take);
            if (pending.remaining > 0) continue;

            padRemaining = (512 - (pending.originalSize % 512)) % 512;
            extractedBytes += pending.originalSize;
            if (extractedBytes > maxTotalBytes) {
              throw new Error(`Tar extracted content too large (max ${maxTotalBytes} bytes)`);
            }
            await closePendingFile();
            written.push(pending.pathRel);
            pending = null;
            pendingPayload = Buffer.alloc(0);
            continue;
          }

          // Non-file payloads (PAX/longname/globalPax/skip).
          if (pending.remaining === 0) {
            padRemaining = (512 - (pending.originalSize % 512)) % 512;
            if (pending.kind === 'pax') {
              pendingPax = parsePaxAttributes(pendingPayload);
            } else if (pending.kind === 'longname') {
              const longName = pendingPayload.toString('utf-8').replace(/\0/g, '').trim();
              if (longName) pendingLongName = longName;
            } else if (pending.kind === 'globalPax') {
              // ignored
            } else if (pending.kind === 'skip') {
              // nothing
            }
            pending = null;
            pendingPayload = Buffer.alloc(0);
            continue;
          }

          if (buf.length === 0) break;
          const take = Math.min(pending.remaining, buf.length);
          const slice = buf.subarray(0, take);
          buf = buf.subarray(take);
          pending.remaining -= take;

          if (pending.kind !== 'skip') {
            pendingPayload = pendingPayload.length ? Buffer.concat([pendingPayload, slice]) : slice;
            if (pendingPayload.length > MAX_META_BYTES) {
              throw new Error(`Tar metadata entry too large (max ${MAX_META_BYTES} bytes)`);
            }
          }

          if (pending.remaining > 0) continue;

          padRemaining = (512 - (pending.originalSize % 512)) % 512;
          if (pending.kind === 'pax') {
            pendingPax = parsePaxAttributes(pendingPayload);
          } else if (pending.kind === 'longname') {
            const longName = pendingPayload.toString('utf-8').replace(/\0/g, '').trim();
            if (longName) pendingLongName = longName;
          }
          pending = null;
          pendingPayload = Buffer.alloc(0);
          continue;
        }

        // Need a header block.
        if (buf.length < 512) break;
        const headerBlock = buf.subarray(0, 512);
        buf = buf.subarray(512);

        const header = parseHeader(headerBlock);
        if (!header) {
          ended = true;
          break;
        }

        entriesSeen += 1;
        if (entriesSeen > maxEntries) {
          throw new Error(`Tar contains too many entries (max ${maxEntries})`);
        }

        let entryName = header.prefix ? `${header.prefix}/${header.name}` : header.name;
        if (pendingLongName) {
          entryName = pendingLongName;
          pendingLongName = null;
        }

        if (pendingPax?.path) {
          entryName = pendingPax.path;
        }
        pendingPax = null;

        const size = header.size;

        // Reject symlinks/hardlinks/devices/etc. Only support files + dirs + metadata.
        if (header.typeflag === '2' || header.typeflag === '1') {
          throw new Error(`Refusing to extract link entry: ${entryName}`);
        }

        if (header.typeflag === 'x') {
          if (size > MAX_META_BYTES) {
            throw new Error(`Tar metadata entry too large (max ${MAX_META_BYTES} bytes)`);
          }
          pending = { kind: 'pax', remaining: size, originalSize: size };
          padRemaining = 0;
          pendingPayload = Buffer.alloc(0);
          continue;
        }

        if (header.typeflag === 'g') {
          if (size > MAX_META_BYTES) {
            throw new Error(`Tar metadata entry too large (max ${MAX_META_BYTES} bytes)`);
          }
          pending = { kind: 'globalPax', remaining: size, originalSize: size };
          padRemaining = 0;
          pendingPayload = Buffer.alloc(0);
          continue;
        }

        if (header.typeflag === 'L') {
          if (size > MAX_META_BYTES) {
            throw new Error(`Tar metadata entry too large (max ${MAX_META_BYTES} bytes)`);
          }
          pending = { kind: 'longname', remaining: size, originalSize: size };
          padRemaining = 0;
          pendingPayload = Buffer.alloc(0);
          continue;
        }

        if (header.typeflag !== '0' && header.typeflag !== '\0' && header.typeflag !== '5') {
          throw new Error(`Unsupported tar entry type '${header.typeflag}' for ${entryName}`);
        }

        const rel = normalizeTarPath(entryName);
        const outPath = resolve(destDir, rel);
        if (!isPathWithinRoot(destDir, outPath)) {
          throw new Error(`Unsafe tar entry (outside dest): ${rel}`);
        }

        if (header.typeflag === '5') {
          // Directory entry.
          await mkdir(outPath, { recursive: true });
          // Directories may still have payload bytes (unusual); skip them safely.
          if (size > 0) {
            pending = { kind: 'skip', remaining: size, originalSize: size };
            padRemaining = 0;
            pendingPayload = Buffer.alloc(0);
          }
          continue;
        }

        // File entry.
        if (size > maxSingleFileBytes) {
          throw new Error(`Tar entry too large: ${rel} (${size} bytes)`);
        }

        await mkdir(dirname(outPath), { recursive: true });
        const ws = createWriteStream(outPath, { flags: 'w', mode: 0o644 });

        // Track file size and padding. Keep originalSize so we can compute padding after consumption.
        pending = {
          kind: 'file',
          pathRel: rel,
          outPath,
          remaining: size,
          originalSize: size,
          stream: ws,
        };
        padRemaining = 0;
        pendingPayload = Buffer.alloc(0);
      }
    }
  } finally {
    // Ensure pending file stream is closed on error.
    await closePendingFile();
  }

  if (pending) {
    throw new Error('Unexpected end of tar stream (truncated archive)');
  }
  if (padRemaining > 0) {
    throw new Error('Unexpected end of tar stream (truncated padding)');
  }

  return written;
}

async function extractTarGzReadable(
  gzReadable: Readable,
  destDir: string,
  options: ExtractTarGzOptions = {}
): Promise<string[]> {
  const maxTarBytes = options.maxTarBytes ?? 100 * 1024 * 1024; // 100MB decompressed TAR cap
  const gunzip = createGunzip();
  const limited = gzReadable.pipe(gunzip).pipe(createByteLimitTransform(maxTarBytes));
  return extractTarStream(limited, destDir, options);
}

export async function extractTarGzFile(
  tarGzPath: string,
  destDir: string,
  options: ExtractTarGzOptions = {}
): Promise<string[]> {
  const rs = createReadStream(tarGzPath);
  return extractTarGzReadable(rs, destDir, options);
}

export async function extractTarGzBuffer(
  gzBuffer: Buffer,
  destDir: string,
  options: ExtractTarGzOptions = {}
): Promise<string[]> {
  const rs = Readable.from([gzBuffer]);
  return extractTarGzReadable(rs, destDir, options);
}
