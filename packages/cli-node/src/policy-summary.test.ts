import { describe, expect, it } from 'vitest';
import { formatPolicySummaryLine } from './policy-summary.js';
import type { ExecutionPolicy } from './types.js';

describe('formatPolicySummaryLine', () => {
  it('formats a readable one-line summary', () => {
    const policy: ExecutionPolicy = {
      profile: 'standard',
      validate: 'auto',
      audit: false,
      enableRepair: true,
      structured: 'auto',
      requireV22: false,
    };

    const line = formatPolicySummaryLine(
      policy,
      { validateInput: false, validateOutput: true, reason: 'auto: tier=decision defaults to validate output' },
      { requested: 'auto', applied: 'native', reason: 'auto: native JSON Schema supported' },
      { enableRepair: true, requireV22: false }
    );

    expect(line.startsWith('Policy: ')).toBe(true);
    expect(line).toContain('profile=standard');
    expect(line).toContain('validate=auto');
    expect(line).toContain('structured=auto->native');
    expect(line).toContain('audit=off');
  });
});

