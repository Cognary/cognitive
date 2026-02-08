import type { ExecutionPolicy, ExecutionProfile, StructuredOutputPreference, ValidateMode } from './types.js';

export interface ResolvePolicyInput {
  profile?: string | null;
  validate?: string | null;
  noValidate?: boolean;
  audit?: boolean;
  structured?: string | null;
}

type LegacyProfilePreset = 'strict';

function parseProfile(raw: string | null | undefined): { profile: ExecutionProfile; legacyPreset?: LegacyProfilePreset } {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'core') return { profile: 'core' };
  if (v === 'standard' || v === '' || v === 'default') return { profile: 'standard' };
  if (v === 'certified' || v === 'cert') return { profile: 'certified' };
  if (v === 'strict') return { profile: 'standard', legacyPreset: 'strict' }; // deprecated alias
  throw new Error(`Invalid --profile: ${raw}. Expected one of: core|standard|certified`);
}

function normalizeValidate(raw: string | null | undefined): ValidateMode {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '' || v === 'auto') return 'auto';
  if (v === 'on' || v === 'true' || v === '1') return 'on';
  if (v === 'off' || v === 'false' || v === '0') return 'off';
  throw new Error(`Invalid --validate: ${raw}. Expected one of: auto|on|off`);
}

function normalizeStructured(raw: string | null | undefined): StructuredOutputPreference {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '' || v === 'auto') return 'auto';
  if (v === 'off' || v === 'none' || v === 'false' || v === '0') return 'off';
  if (v === 'prompt') return 'prompt';
  if (v === 'native') return 'native';
  throw new Error(`Invalid --structured: ${raw}. Expected one of: auto|off|prompt|native`);
}

export function resolveExecutionPolicy(input: ResolvePolicyInput): ExecutionPolicy {
  const { profile, legacyPreset } = parseProfile(input.profile);

  // Base defaults per profile.
  // standard: auto validation chooses based on module tier/strictness in the runner
  let validate: ValidateMode = profile === 'core' ? 'off' : 'auto';
  let audit = false;
  let enableRepair = true;
  let requireV22 = false;
  let structured: StructuredOutputPreference = 'auto';

  if (profile === 'certified') {
    validate = 'on';
    audit = true;
    enableRepair = false; // certification prefers fail-fast over runtime repair
    requireV22 = true;
    structured = 'auto';
  }

  // Legacy preset: strict = validate on, no audit, keep repair on, do not require v2.2.
  // This keeps backward compatibility while presenting only core/standard/certified externally.
  if (legacyPreset === 'strict') {
    validate = 'on';
    audit = false;
    enableRepair = true;
    requireV22 = false;
    structured = 'auto';
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
  if (input.structured != null) {
    structured = normalizeStructured(input.structured);
  }

  // Trigger rule: if audit is enabled and validate wasn't explicitly turned off,
  // force validation on (auditing without validation is usually not meaningful).
  if (audit && !(validateExplicit && validate === 'off')) {
    validate = 'on';
  }

  return { profile, validate, audit, enableRepair, structured, requireV22 };
}
