import type { ExecutionPolicy, JsonSchemaMode, StructuredOutputPreference, ValidateMode } from './types.js';

export type EffectiveValidation = {
  validateInput: boolean;
  validateOutput: boolean;
  reason?: string | null;
};

export type EffectiveStructured = {
  requested: StructuredOutputPreference;
  applied: JsonSchemaMode | 'off';
  reason?: string | null;
};

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function compactReason(reason: string | null | undefined, maxLen = 90): string | null {
  if (!reason) return null;
  const s = oneLine(reason);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function fmtOnOff(v: boolean): string {
  return v ? 'on' : 'off';
}

export function formatPolicySummaryLine(
  policy: ExecutionPolicy,
  effectiveValidation: EffectiveValidation,
  effectiveStructured: EffectiveStructured,
  extras?: { enableRepair?: boolean; requireV22?: boolean }
): string {
  const validateMode: ValidateMode = policy.validate;
  const vReason = compactReason(effectiveValidation.reason ?? null);
  const sReason = compactReason(effectiveStructured.reason ?? null);

  const parts: string[] = [];
  parts.push(`profile=${policy.profile}`);
  parts.push(`validate=${validateMode}(in:${fmtOnOff(effectiveValidation.validateInput)} out:${fmtOnOff(effectiveValidation.validateOutput)})`);
  if (vReason) parts.push(`validate_reason="${vReason}"`);

  const structuredArrow = effectiveStructured.requested === 'auto' ? '->' : ':';
  parts.push(`structured=${effectiveStructured.requested}${structuredArrow}${effectiveStructured.applied}`);
  if (sReason) parts.push(`structured_reason="${sReason}"`);

  parts.push(`audit=${fmtOnOff(Boolean(policy.audit))}`);
  if (typeof extras?.enableRepair === 'boolean') parts.push(`repair=${fmtOnOff(extras.enableRepair)}`);
  parts.push(`requireV22=${fmtOnOff(Boolean(extras?.requireV22 ?? policy.requireV22))}`);

  return `Policy: ${parts.join(' | ')}`;
}

