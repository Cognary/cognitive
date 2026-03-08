#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.resolve(__dirname, '..', '..');
const distProvidersPath = path.join(packageDir, 'dist', 'providers', 'index.js');

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error('Usage: node invoke-raw.mjs <payload.json>');
  }

  await fs.access(distProvidersPath);
  const providerModule = await import(pathToFileURL(distProvidersPath).href);
  const payload = JSON.parse(await fs.readFile(path.resolve(payloadPath), 'utf8'));

  const provider = providerModule.getProvider(payload.provider, payload.model);
  if (!provider.isConfigured()) {
    throw new Error(`Provider ${provider.name} is not configured in this shell.`);
  }

  const result = await provider.invoke(payload.params);
  process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exit(1);
});
