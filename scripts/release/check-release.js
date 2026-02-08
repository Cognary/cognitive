/* eslint-disable no-console */
'use strict';

const path = require('node:path');
const {
  die,
  readJson,
  isSemver,
  findArgValue,
  walkFiles,
  readYamlScalar,
  fileExists,
} = require('./_util');

const repoRoot = path.resolve(__dirname, '..', '..');

function parseTagToVersion(tag) {
  const t = String(tag || '').trim();
  if (!t) die('Missing --tag vX.Y.Z');
  if (!t.startsWith('v')) die(`Invalid tag '${t}'. Expected 'vX.Y.Z'.`);
  const v = t.slice(1);
  if (!isSemver(v)) die(`Invalid tag '${t}'. Expected 'vX.Y.Z' with semver.`);
  return v;
}

function check() {
  const tag = findArgValue(process.argv, '--tag');
  const version = parseTagToVersion(tag);

  const cliPkgPath = path.join(repoRoot, 'packages', 'cli-node', 'package.json');
  const cognPkgPath = path.join(repoRoot, 'packages', 'cogn', 'package.json');

  const cliPkg = readJson(cliPkgPath);
  const cognPkg = readJson(cognPkgPath);

  const errors = [];

  if (cliPkg.version !== version) {
    errors.push(`packages/cli-node/package.json version=${cliPkg.version} (want ${version})`);
  }
  if (cognPkg.version !== version) {
    errors.push(`packages/cogn/package.json version=${cognPkg.version} (want ${version})`);
  }

  const dep = cognPkg.dependencies && cognPkg.dependencies['cognitive-modules-cli'];
  if (dep !== version) {
    errors.push(`packages/cogn/package.json deps cognitive-modules-cli=${dep} (want ${version})`);
  }

  const moduleYamlFiles = walkFiles(path.join(repoRoot, 'cognitive', 'modules'), (p) =>
    p.endsWith(`${path.sep}module.yaml`)
  );
  for (const p of moduleYamlFiles) {
    const v = readYamlScalar(p, 'version');
    if (!v) {
      errors.push(`${path.relative(repoRoot, p)} missing 'version:'`);
      continue;
    }
    if (v !== version) {
      errors.push(`${path.relative(repoRoot, p)} version=${v} (want ${version})`);
    }
  }

  // Guardrail: ensure release assets workflow inputs exist.
  const lockPath = path.join(repoRoot, 'packages', 'cli-node', 'package-lock.json');
  if (!fileExists(lockPath)) {
    errors.push('packages/cli-node/package-lock.json missing (npm ci will fail)');
  }

  if (errors.length) {
    const msg = ['Release sanity check failed:', ...errors.map((e) => `- ${e}`)].join('\n');
    die(msg);
  }

  console.log(`[release] OK: tag ${tag} matches packages + module versions.`);
}

check();

