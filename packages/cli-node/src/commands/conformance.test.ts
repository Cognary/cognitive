import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Provider } from '../types.js';
import { conformance } from './conformance.js';

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../../');
}

const providerStub: Provider = {
  name: 'stub',
  async invoke() {
    throw new Error('not used');
  },
  isConfigured() {
    return false;
  },
};

describe('conformance (spec vectors)', () => {
  it('envelope vectors pass at level 3', async () => {
    const root = repoRootFromHere();
    const result = await conformance(
      { cwd: root, provider: providerStub, verbose: false },
      { specDir: path.join(root, 'spec'), suite: 'envelope', level: 3 }
    );
    expect(result.success).toBe(true);
  });

  it('all vector suites pass at level 3', async () => {
    const root = repoRootFromHere();
    const result = await conformance(
      { cwd: root, provider: providerStub, verbose: false },
      { specDir: path.join(root, 'spec'), suite: 'all', level: 3 }
    );
    expect(result.success).toBe(true);
  });
});
