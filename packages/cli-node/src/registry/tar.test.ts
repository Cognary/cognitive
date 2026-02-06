import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { extractTarGzBuffer } from './tar.js';

function pad512(n: number): number {
  return Math.ceil(n / 512) * 512;
}

function writeOctal(buf: Buffer, offset: number, length: number, value: number): void {
  const oct = value.toString(8);
  const str = oct.padStart(length - 1, '0') + '\0';
  buf.write(str, offset, length, 'ascii');
}

function checksum(header: Buffer): number {
  // checksum field (148..155) is treated as spaces for calculation
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  return sum;
}

function tarHeader(opts: { name: string; size: number; typeflag?: string }): Buffer {
  const h = Buffer.alloc(512, 0);
  h.write(opts.name, 0, 100, 'utf-8');
  writeOctal(h, 100, 8, 0o644);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, opts.size);
  writeOctal(h, 136, 12, Math.floor(Date.now() / 1000));
  h.write(opts.typeflag ?? '0', 156, 1, 'ascii');
  h.write('ustar', 257, 5, 'ascii');
  h.write('00', 263, 2, 'ascii');

  const sum = checksum(h);
  const sumStr = sum.toString(8).padStart(6, '0');
  h.write(sumStr, 148, 6, 'ascii');
  h[154] = 0; // NUL
  h[155] = 0x20; // space
  return h;
}

function buildTar(entries: Array<{ name: string; data?: Buffer; typeflag?: string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const e of entries) {
    const data = e.data ?? Buffer.alloc(0);
    const header = tarHeader({ name: e.name, size: data.length, typeflag: e.typeflag });
    chunks.push(header);
    chunks.push(data);
    const pad = pad512(data.length) - data.length;
    if (pad) chunks.push(Buffer.alloc(pad, 0));
  }
  // EOF blocks
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

describe('extractTarGzBuffer', () => {
  it('extracts a minimal module tar.gz', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cog-tar-test-'));
    try {
      const tar = buildTar([
        { name: 'mod/module.yaml', data: Buffer.from('name: mod\nversion: 1.0.0\n', 'utf-8') },
        { name: 'mod/prompt.md', data: Buffer.from('# hi\n', 'utf-8') },
      ]);
      const gz = gzipSync(tar);
      const written = await extractTarGzBuffer(gz, dir);
      expect(written).toContain('mod/module.yaml');
      expect(readFileSync(join(dir, 'mod/module.yaml'), 'utf-8')).toContain('version: 1.0.0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cog-tar-test-'));
    try {
      const tar = buildTar([
        { name: '../evil.txt', data: Buffer.from('no', 'utf-8') },
      ]);
      const gz = gzipSync(tar);
      await expect(extractTarGzBuffer(gz, dir)).rejects.toThrow('path traversal');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects symlink entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cog-tar-test-'));
    try {
      const tar = buildTar([
        { name: 'mod/link', typeflag: '2', data: Buffer.alloc(0) },
      ]);
      const gz = gzipSync(tar);
      await expect(extractTarGzBuffer(gz, dir)).rejects.toThrow('link entry');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enforces maxTarBytes on decompressed tar stream', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cog-tar-test-'));
    try {
      // 2MB of highly compressible data (all zeros) simulates a gzip bomb style payload.
      const big = Buffer.alloc(2 * 1024 * 1024, 0);
      const tar = buildTar([
        { name: 'mod/big.bin', data: big },
      ]);
      const gz = gzipSync(tar);

      await expect(
        extractTarGzBuffer(gz, dir, {
          maxTarBytes: 256 * 1024, // 256KB decompressed TAR cap
          maxTotalBytes: 10 * 1024 * 1024,
          maxSingleFileBytes: 10 * 1024 * 1024,
        })
      ).rejects.toThrow('Tar stream too large');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
