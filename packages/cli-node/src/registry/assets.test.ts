import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { buildRegistryAssets, verifyRegistryAssets } from './assets.js';

function tmpPath(name: string): string {
  return path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function writeModule(dir: string, name: string, version: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'module.yaml'),
    [
      `name: ${name}`,
      `version: ${version}`,
      'tier: decision',
      'responsibility: demo',
    ].join('\n') + '\n',
    'utf-8'
  );
  await fs.writeFile(path.join(dir, 'prompt.md'), '# demo\n', 'utf-8');
  await fs.mkdir(path.join(dir, 'tests'), { recursive: true });
  await fs.writeFile(path.join(dir, 'tests', 'a.input.json'), '{"x":1}\n', 'utf-8');
}

describe('registry assets', () => {
  it('builds a tarball + registry index and verifies them', async () => {
    const root = tmpPath('cog-reg-assets');
    const modulesDir = path.join(root, 'modules');
    const outDir = path.join(root, 'dist');
    const v1Path = path.join(root, 'v1.json');
    const registryOut = path.join(root, 'registry.v2.json');

    try {
      await writeModule(path.join(modulesDir, 'demo'), 'demo', '1.0.0');
      await fs.writeFile(
        v1Path,
        JSON.stringify(
          {
            version: '1.0.0',
            updated: '2024-01-01T00:00:00Z',
            modules: {
              demo: { description: 'demo module', author: 'me', tags: ['x'] },
            },
            categories: {},
          },
          null,
          2
        ) + '\n',
        'utf-8'
      );

      const built = await buildRegistryAssets({
        modulesDir,
        v1RegistryPath: v1Path,
        outDir,
        registryOut,
        namespace: 'official',
        runtimeMin: '2.2.0',
        repository: 'https://github.com/example/repo',
        homepage: 'https://example.com',
        license: 'MIT',
        tag: null,
        tarballBaseUrl: null,
        timestamp: '2026-02-07T00:00:00Z',
      });

      expect(built.modules).toHaveLength(1);
      expect(built.modules[0].file).toBe('demo-1.0.0.tar.gz');

      const verified = await verifyRegistryAssets({
        registryIndexPath: registryOut,
        assetsDir: outDir,
      });

      expect(verified.ok).toBe(true);
      expect(verified.failed).toBe(0);
      expect(verified.passed).toBe(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('verifies a remote registry index + tarballs (fetch mode)', async () => {
    const root = tmpPath('cog-reg-assets-remote');
    const modulesDir = path.join(root, 'modules');
    const outDir = path.join(root, 'dist');
    const v1Path = path.join(root, 'v1.json');
    const registryOut = path.join(root, 'registry.v2.json');

    const originalFetch = globalThis.fetch;
    try {
      await writeModule(path.join(modulesDir, 'demo'), 'demo', '1.0.0');
      await fs.writeFile(
        v1Path,
        JSON.stringify(
          {
            version: '1.0.0',
            updated: '2024-01-01T00:00:00Z',
            modules: {
              demo: { description: 'demo module', author: 'me', tags: ['x'] },
            },
            categories: {},
          },
          null,
          2
        ) + '\n',
        'utf-8'
      );

      // Use a fake remote base URL and stub fetch, since this sandbox may block listening sockets.
      const baseUrl = 'https://registry.example.test';

      await buildRegistryAssets({
        modulesDir,
        v1RegistryPath: v1Path,
        outDir,
        registryOut,
        namespace: 'official',
        runtimeMin: '2.2.0',
        repository: 'https://github.com/example/repo',
        homepage: 'https://example.com',
        license: 'MIT',
        tag: 'v1.0.0',
        tarballBaseUrl: baseUrl,
        timestamp: '2026-02-07T00:00:00Z',
      });

      const indexUrl = `${baseUrl}/registry.json`;
      const tarUrl = `${baseUrl}/demo-1.0.0.tar.gz`;

      globalThis.fetch = (async (input: any, _init?: any) => {
        const url = typeof input === 'string' ? input : String(input?.url ?? input);
        if (url === indexUrl) {
          const raw = await fs.readFile(registryOut, 'utf-8');
          return new Response(raw, {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'content-length': String(Buffer.byteLength(raw, 'utf-8')),
            },
          });
        }
        if (url === tarUrl) {
          const filePath = path.join(outDir, 'demo-1.0.0.tar.gz');
          const buf = await fs.readFile(filePath);
          return new Response(buf, {
            status: 200,
            headers: {
              'content-type': 'application/gzip',
              'content-length': String(buf.length),
            },
          });
        }
        return new Response('not found', { status: 404 });
      }) as any;

      const verified = await verifyRegistryAssets({
        registryIndexPath: indexUrl,
        remote: true,
      });

      expect(verified.ok).toBe(true);
      expect(verified.failed).toBe(0);
      expect(verified.passed).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
