#!/usr/bin/env node
'use strict';

// `cognitive-modules-cli` is ESM with a restrictive "exports" map. We must not
// `require(".../dist/cli.js")` (blocked by exports + would hit ERR_REQUIRE_ESM).
// Instead, resolve its bin entry and spawn Node on that file.

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function resolveCliEntry() {
  const pkgJsonPath = require.resolve('cognitive-modules-cli/package.json');
  const pkgDir = path.dirname(pkgJsonPath);
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  let rel = null;
  if (typeof pkg.bin === 'string') {
    rel = pkg.bin;
  } else if (pkg.bin && typeof pkg.bin === 'object') {
    rel = pkg.bin.cog || pkg.bin['cognitive-modules-cli'] || Object.values(pkg.bin)[0];
  }

  if (!rel || typeof rel !== 'string') rel = 'dist/cli.js';
  return path.join(pkgDir, rel);
}

let cliPath;
try {
  cliPath = resolveCliEntry();
} catch (err) {
  const msg = err && err.message ? err.message : String(err);
  console.error(`[cogn] Failed to resolve cognitive-modules-cli. ${msg}`);
  console.error('[cogn] Try: npm i -g cogn (or cognitive-modules-cli)');
  process.exit(1);
}

const args = process.argv.slice(2);
const res = cp.spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit' });
process.exitCode = typeof res.status === 'number' ? res.status : 1;
