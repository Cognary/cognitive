/* eslint-disable no-console */
'use strict';

const path = require('node:path');
const { die, readJson, findArgValue, isSemver, fileExists } = require('./_util');

const repoRoot = path.resolve(__dirname, '..', '..');

function main() {
  const pkgRel = findArgValue(process.argv, '--package');
  if (!pkgRel) die('Usage: node scripts/release/check-npm-package.js --package packages/<name>');

  const pkgDir = path.join(repoRoot, pkgRel);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const pkg = readJson(pkgJsonPath);

  const errors = [];
  const version = String(pkg.version || '').trim();
  if (!isSemver(version)) errors.push(`${pkgRel}/package.json invalid version: '${version}'`);

  if (pkg.name === 'cogn') {
    const dep = pkg.dependencies && pkg.dependencies['cognitive-modules-cli'];
    if (dep !== version) {
      errors.push(`${pkgRel}/package.json dependencies.cognitive-modules-cli=${dep} (want ${version})`);
    }
    if (!fileExists(path.join(pkgDir, 'bin.js'))) {
      errors.push(`${pkgRel}/bin.js missing`);
    }
  }

  if (errors.length) {
    die(['npm package prepublish check failed:', ...errors.map((e) => `- ${e}`)].join('\n'));
  }

  console.log(`[release] OK: ${pkg.name}@${version}`);
}

main();

