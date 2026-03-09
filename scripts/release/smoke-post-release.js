/* eslint-disable no-console */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { die, readJson, findArgValue, isSemver } = require('./_util');

const repoRoot = path.resolve(__dirname, '..', '..');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function mustRun(label, cmd, args, options = {}) {
  const result = run(cmd, args, options);
  if (result.status !== 0) {
    const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    die(`${label} failed\n${details}`);
  }
  console.log(`[release:smoke] OK ${label}`);
  return result.stdout.trim();
}

function resolveVersion() {
  const explicitVersion = findArgValue(process.argv, '--version');
  if (explicitVersion) {
    if (!isSemver(explicitVersion)) die(`Invalid --version '${explicitVersion}'`);
    return explicitVersion;
  }

  const pkgRel = findArgValue(process.argv, '--package') || 'packages/cli-node';
  const pkgJson = readJson(path.join(repoRoot, pkgRel, 'package.json'));
  const version = String(pkgJson.version || '').trim();
  if (!isSemver(version)) die(`Invalid package version in ${pkgRel}/package.json: '${version}'`);
  return version;
}

function assertEquals(label, actual, expected) {
  if (actual !== expected) {
    die(`${label} mismatch\nexpected: ${expected}\nactual:   ${actual}`);
  }
  console.log(`[release:smoke] OK ${label}`);
}

function main() {
  const version = resolveVersion();
  const provider = findArgValue(process.argv, '--provider') || 'gemini';
  const model = findArgValue(process.argv, '--model') || 'gemini-3-pro-preview';

  const cliView = mustRun(
    'npm view cognitive-modules-cli version',
    'npm',
    ['view', `cognitive-modules-cli@${version}`, 'version'],
  );
  assertEquals('cognitive-modules-cli npm version', cliView, version);

  const cognView = mustRun(
    'npm view cogn version',
    'npm',
    ['view', `cogn@${version}`, 'version'],
  );
  assertEquals('cogn npm version', cognView, version);

  const cliBin = mustRun(
    'npm view cognitive-modules-cli bin',
    'npm',
    ['view', `cognitive-modules-cli@${version}`, 'bin', '--json'],
  );
  const cliBinParsed = JSON.parse(cliBin);
  if (!cliBinParsed || cliBinParsed.cog !== 'bin.js') {
    die(`unexpected cognitive-modules-cli bin mapping: ${cliBin}`);
  }
  console.log('[release:smoke] OK cognitive-modules-cli bin mapping');

  const cognBin = mustRun(
    'npm view cogn bin',
    'npm',
    ['view', `cogn@${version}`, 'bin', '--json'],
  );
  const cognBinParsed = JSON.parse(cognBin);
  if (!cognBinParsed || cognBinParsed.cogn !== 'bin.js') {
    die(`unexpected cogn bin mapping: ${cognBin}`);
  }
  console.log('[release:smoke] OK cogn bin mapping');

  const cognVersion = mustRun(
    'npx cogn --version',
    'npx',
    [`cogn@${version}`, '--version'],
  );
  if (!cognVersion.includes(version)) {
    die(`npx cogn --version did not mention ${version}: ${cognVersion}`);
  }

  const cliVersion = mustRun(
    'npx cognitive-modules-cli --version',
    'npx',
    [`cognitive-modules-cli@${version}`, '--version'],
  );
  if (!cliVersion.includes(version)) {
    die(`npx cognitive-modules-cli --version did not mention ${version}: ${cliVersion}`);
  }

  const providers = mustRun(
    'npx cogn providers --pretty',
    'npx',
    [`cogn@${version}`, 'providers', '--pretty'],
  );
  const providersParsed = JSON.parse(providers);
  const providerNames = Array.isArray(providersParsed.providers)
    ? providersParsed.providers.map((p) => p && p.name).filter(Boolean)
    : [];
  for (const name of ['openai', 'anthropic', 'gemini', 'minimax', 'deepseek', 'qwen']) {
    if (!providerNames.includes(name)) {
      die(`stable provider '${name}' missing from providers output`);
    }
  }
  console.log('[release:smoke] OK stable providers surface');

  const coreOut = mustRun(
    'npx cogn core run',
    'npx',
    [`cogn@${version}`, 'core', 'run', '--stdin', '--args', 'hello', '--pretty'],
    {
      input: 'Please return a valid v2.2 envelope (meta + data). Put the answer in data.result.\n',
    },
  );
  const coreParsed = JSON.parse(coreOut);
  if (coreParsed.ok !== true || coreParsed.version !== '2.2' || !coreParsed.data || !coreParsed.meta) {
    die(`unexpected core smoke output: ${coreOut}`);
  }
  console.log('[release:smoke] OK core envelope smoke');

  if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.log('[release:smoke] SKIP pr-risk-gate smoke (GEMINI_API_KEY missing)');
    return;
  }
  if (provider === 'minimax' && !process.env.MINIMAX_API_KEY) {
    console.log('[release:smoke] SKIP pr-risk-gate smoke (MINIMAX_API_KEY missing)');
    return;
  }

  const prRiskOut = mustRun(
    'npx cogn pipe --module pr-risk-gate',
    'npx',
    [
      `cogn@${version}`,
      'pipe',
      '--module',
      'pr-risk-gate',
      '--pretty',
      '--profile',
      'standard',
      '--provider',
      provider,
      '--model',
      model,
    ],
    {
      input:
        'diff --git a/auth.py b/auth.py\n@@\n' +
        '-def login(user, password):\n' +
        '-    query = "SELECT * FROM users WHERE name = ? AND password = ?"\n' +
        '-    return db.execute(query, (user, password)).fetchone()\n' +
        '+def login(user, password):\n' +
        '+    query = f"SELECT * FROM users WHERE name = \'{user}\' AND password = \'{password}\'"\n' +
        '+    return db.execute(query).fetchone()\n',
    },
  );
  const prRiskParsed = JSON.parse(prRiskOut);
  if (
    prRiskParsed.ok !== true ||
    prRiskParsed.version !== '2.2' ||
    prRiskParsed.data?.decision !== 'reject_until_security_fix' ||
    prRiskParsed.data?.blocking !== true
  ) {
    die(`unexpected pr-risk-gate smoke output: ${prRiskOut}`);
  }
  console.log('[release:smoke] OK pr-risk-gate smoke');
}

main();
