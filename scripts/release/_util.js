/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function die(msg) {
  console.error(`\n[release] ${msg}\n`);
  process.exit(1);
}

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeUtf8(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function readJson(p) {
  return JSON.parse(readUtf8(p));
}

function writeJson(p, obj) {
  writeUtf8(p, JSON.stringify(obj, null, 2) + '\n');
}

function isSemver(v) {
  // Allow: 1.2.3, 1.2.3-alpha.1
  return typeof v === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(v);
}

function findArgValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  const v = argv[idx + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function walkFiles(rootDir, predicate) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(p);
      } else if (ent.isFile()) {
        if (!predicate || predicate(p)) out.push(p);
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function readYamlScalar(filePath, key) {
  const raw = readUtf8(filePath);
  // Very small YAML subset: read first "key: value" match at line start.
  const re = new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm');
  const m = raw.match(re);
  if (!m) return null;
  const v = String(m[1]).trim();
  // Strip wrapping quotes when present.
  return v.replace(/^['"]|['"]$/g, '');
}

function replaceYamlScalar(filePath, key, nextValue) {
  const raw = readUtf8(filePath);
  const re = new RegExp(`^(${key}:\\s*)(.+)\\s*$`, 'm');
  const m = raw.match(re);
  if (!m) return { changed: false, reason: `Missing key '${key}'` };

  const before = m[2].trim();
  const normalizedBefore = before.replace(/^['"]|['"]$/g, '');
  if (normalizedBefore === nextValue) return { changed: false, reason: 'Already set' };

  const nextRaw = `${m[1]}${nextValue}`;
  const out = raw.replace(re, nextRaw);
  writeUtf8(filePath, out);
  return { changed: true, reason: `Updated ${key}: ${normalizedBefore} -> ${nextValue}` };
}

module.exports = {
  die,
  readUtf8,
  writeUtf8,
  readJson,
  writeJson,
  isSemver,
  findArgValue,
  fileExists,
  walkFiles,
  readYamlScalar,
  replaceYamlScalar,
};

