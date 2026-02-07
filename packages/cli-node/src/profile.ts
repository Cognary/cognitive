import type { ExecutionPolicy, ExecutionProfile, ValidateMode } from './types.js';

export interface ResolvePolicyInput {
  profile?: string | null;
  validate?: string | null;
  noValidate?: boolean;
  audit?: boolean;
}

function normalizeProfile(raw: string | null | undefined): ExecutionProfile {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'core') return 'core';
  if (v === 'default' || v === '') return 'default';
  if (v === 'strict') return 'strict';
  if (v === 'certified' || v === 'cert') return 'certified';
  throw new Error(`Invalid --profile: ${raw}. Expected one of: core|default|strict|certified`);
}

function normalizeValidate(raw: string | null | undefined): ValidateMode {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '' || v === 'auto') return 'auto';
  if (v === 'on' || v === 'true' || v === '1') return 'on';
  if (v === 'off' || v === 'false' || v === '0') return 'off';
  throw new Error(`Invalid --validate: ${raw}. Expected one of: auto|on|off`);
}

export function resolveExecutionPolicy(input: ResolvePolicyInput): ExecutionPolicy {
  const profile = normalizeProfile(input.profile);

  // Base defaults per profile.
  // default: auto validation chooses based on module tier/strictness in the runner
  let validate: ValidateMode = profile === 'core' ? 'off' : 'auto';
  let audit = false;
  let enableRepair = true;
  let requireV22 = false;

  if (profile === 'strict') {
    validate = 'on';
    audit = false;
    enableRepair = true;
    requireV22 = false;
  }

  if (profile === 'certified') {
    validate = 'on';
    audit = true;
    enableRepair = false; // certification prefers fail-fast over runtime repair
    requireV22 = true;
  }

  // CLI overrides.
  const validateExplicit = input.validate != null || Boolean(input.noValidate);
  if (input.validate != null) {
    validate = normalizeValidate(input.validate);
  }
  if (input.noValidate) {
    validate = 'off';
  }
  if (typeof input.audit === 'boolean') {
    audit = input.audit;
  }

  // Trigger rule: if audit is enabled and validate wasn't explicitly turned off,
  // force validation on (auditing without validation is usually not meaningful).
  if (audit && !(validateExplicit && validate === 'off')) {
    validate = 'on';
  }

  return { profile, validate, audit, enableRepair, requireV22 };
}
