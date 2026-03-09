#!/usr/bin/env node
import fs from 'node:fs/promises';

const file = process.argv[2] || 'cognitive-pr-risk.json';
const raw = await fs.readFile(file, 'utf8');
const result = JSON.parse(raw);

if (!result || typeof result !== 'object') {
  console.error('[cognitive-pr-risk] invalid JSON result');
  process.exit(1);
}

if (result.ok !== true) {
  const message = result?.error?.message || result?.meta?.explain || 'module returned a non-success envelope';
  console.error(`[cognitive-pr-risk] gate failed to evaluate PR: ${message}`);
  process.exit(1);
}

const risk = String(result?.meta?.risk || 'unknown');
const blocking = Boolean(result?.data?.blocking);
const decision = String(result?.data?.decision || 'unknown');

console.log(`[cognitive-pr-risk] decision=${decision} risk=${risk} blocking=${blocking}`);

if (blocking || risk === 'high') {
  console.error('[cognitive-pr-risk] blocking PR due to high-risk decision contract');
  process.exit(1);
}
