/* eslint-disable no-console */
'use strict';

const path = require('node:path');
const cp = require('node:child_process');
const { die, readJson, isSemver } = require('./_util');

const repoRoot = path.resolve(__dirname, '..', '..');

function main() {
  // Regenerate the committed v2 registry index using a stable "latest" base URL.
  // This avoids pinning the repo's default registry to a specific release tag.
  const cliPkgPath = path.join(repoRoot, 'packages', 'cli-node', 'package.json');
  const cliPkg = readJson(cliPkgPath);
  const version = String(cliPkg.version || '').trim();
  if (!isSemver(version)) die(`Invalid packages/cli-node version: '${version}'`);

  const cliEntrypoint = path.join(repoRoot, 'packages', 'cli-node', 'dist', 'cli.js');

  const tarballBaseUrl = 'https://github.com/Cognary/cognitive/releases/latest/download';

  const args = [
    cliEntrypoint,
    'registry',
    'build',
    '--tarball-base-url',
    tarballBaseUrl,
    '--modules-dir',
    path.join('cognitive', 'modules'),
    '--v1-registry',
    'cognitive-registry.json',
    '--out-dir',
    path.join('dist', 'registry-assets'),
    '--registry-out',
    'cognitive-registry.v2.json',
  ];

  const res = cp.spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' });
  if (typeof res.status !== 'number' || res.status !== 0) {
    die(`registry build failed (exit ${res.status ?? 'unknown'})`);
  }
}

main();

