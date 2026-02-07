#!/usr/bin/env node
/**
 * Stable CLI entrypoint.
 *
 * Motivation:
 * - Avoid `npm publish` warnings when `bin` points into `dist/` before build runs.
 * - Keep runtime entrypoint stable even if build output paths change.
 *
 * This file is shipped in the published package and forwards to the compiled CLI.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, 'dist', 'cli.js');
const args = process.argv.slice(2);

const res = spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit' });

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status ?? 1);

