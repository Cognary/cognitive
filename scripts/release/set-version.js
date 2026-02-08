/* eslint-disable no-console */
'use strict';

const path = require('node:path');
const {
  die,
  readJson,
  writeJson,
  isSemver,
  findArgValue,
  walkFiles,
  replaceYamlScalar,
} = require('./_util');

const repoRoot = path.resolve(__dirname, '..', '..');

function main() {
  const next = findArgValue(process.argv, '--version');
  if (!next) die('Usage: node scripts/release/set-version.js --version X.Y.Z');
  if (!isSemver(next)) die(`Invalid semver: '${next}'`);

  const cliPkgPath = path.join(repoRoot, 'packages', 'cli-node', 'package.json');
  const cognPkgPath = path.join(repoRoot, 'packages', 'cogn', 'package.json');

  const cliPkg = readJson(cliPkgPath);
  const cognPkg = readJson(cognPkgPath);

  const prev = String(cliPkg.version || '').trim();
  if (!isSemver(prev)) die(`Unexpected cli-node package.json version: '${prev}'`);

  cliPkg.version = next;
  // Keep npm from auto-normalizing this on publish (less noise).
  if (cliPkg.repository && typeof cliPkg.repository === 'object' && cliPkg.repository.url === 'https://github.com/Cognary/cognitive.git') {
    cliPkg.repository.url = 'git+https://github.com/Cognary/cognitive.git';
  }
  writeJson(cliPkgPath, cliPkg);

  cognPkg.version = next;
  cognPkg.dependencies = cognPkg.dependencies || {};
  cognPkg.dependencies['cognitive-modules-cli'] = next;
  writeJson(cognPkgPath, cognPkg);

  const moduleYamlFiles = walkFiles(path.join(repoRoot, 'cognitive', 'modules'), (p) =>
    p.endsWith(`${path.sep}module.yaml`)
  );
  const changed = [];
  const skipped = [];
  for (const p of moduleYamlFiles) {
    const r = replaceYamlScalar(p, 'version', next);
    if (r.changed) changed.push(path.relative(repoRoot, p));
    else skipped.push(`${path.relative(repoRoot, p)} (${r.reason})`);
  }

  console.log(`[release] Updated versions: ${prev} -> ${next}`);
  console.log(`[release] Updated:`);
  console.log(`- packages/cli-node/package.json`);
  console.log(`- packages/cogn/package.json`);
  for (const p of changed) console.log(`- ${p}`);
  if (skipped.length) {
    console.log('[release] Skipped:');
    for (const s of skipped) console.log(`- ${s}`);
  }
}

main();

