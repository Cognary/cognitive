/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const docsDir = path.join(repoRoot, 'docs-v2');

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const docsPkg = path.join(docsDir, 'package.json');
  if (!fs.existsSync(docsPkg)) {
    console.error('[release] docs-v2/package.json missing');
    process.exit(1);
  }

  const docsNodeModules = path.join(docsDir, 'node_modules');
  if (!fs.existsSync(docsNodeModules)) {
    console.log('[release] docs dependencies missing; running npm ci in docs-v2');
    run('npm', ['ci', '--no-audit', '--no-fund'], docsDir);
  }

  console.log('[release] building docs-v2');
  run('npm', ['run', 'build'], docsDir);
  console.log('[release] docs build OK');
}

main();
