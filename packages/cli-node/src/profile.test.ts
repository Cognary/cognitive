import { describe, it, expect } from 'vitest';
import { resolveExecutionPolicy } from './profile.js';

describe('resolveExecutionPolicy', () => {
  it('defaults to profile=default', () => {
    const p = resolveExecutionPolicy({});
    expect(p.profile).toBe('default');
    expect(p.validate).toBe('auto');
    expect(p.audit).toBe(false);
    expect(p.enableRepair).toBe(true);
    expect(p.structured).toBe('auto');
    expect(p.requireV22).toBe(false);
  });

  it('core profile disables validation by default', () => {
    const p = resolveExecutionPolicy({ profile: 'core' });
    expect(p.profile).toBe('core');
    expect(p.validate).toBe('off');
  });

  it('certified profile enables audit and requires v2.2', () => {
    const p = resolveExecutionPolicy({ profile: 'certified' });
    expect(p.profile).toBe('certified');
    expect(p.audit).toBe(true);
    expect(p.validate).toBe('on');
    expect(p.enableRepair).toBe(false);
    expect(p.requireV22).toBe(true);
  });

  it('audit forces validation on unless explicitly disabled', () => {
    const p1 = resolveExecutionPolicy({ profile: 'core', audit: true });
    expect(p1.audit).toBe(true);
    expect(p1.validate).toBe('on');

    const p2 = resolveExecutionPolicy({ profile: 'default', audit: true, validate: 'off' });
    expect(p2.audit).toBe(true);
    expect(p2.validate).toBe('off');
  });
});
