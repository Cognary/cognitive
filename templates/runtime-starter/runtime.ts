/**
 * Cognitive Modules Runtime Starter (TypeScript)
 *
 * This is a skeleton to help implementers wire:
 * - Module loading
 * - Provider invocation
 * - Envelope validation
 *
 * The canonical runtime implementation lives in the monorepo:
 * - https://github.com/Cognary/cognitive/tree/main/packages/cli-node/src
 */

export type EnvelopeV22 = {
  ok: boolean;
  version: string;
  meta: {
    confidence: number;
    risk: 'none' | 'low' | 'medium' | 'high' | { custom: string; reason: string };
    explain: string;
    latency_ms?: number;
  };
  data?: Record<string, unknown>;
  error?: { code: string; message: string; recoverable?: boolean; details?: unknown };
};

export async function runModule(_modulePath: string, _input: unknown): Promise<EnvelopeV22> {
  // TODO: Implement:
  // - read module.yaml + prompt.md + schema.json
  // - build provider prompt
  // - call provider
  // - parse/repair/validate to a v2.2 envelope
  throw new Error('Not implemented. See validate.ts for conformance smoke-checks.');
}

