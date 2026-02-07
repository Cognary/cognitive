import { describe, it, expect } from 'vitest';
import { parseCliArgs } from './cli-args.js';

describe('parseCliArgs', () => {
  it('supports global flags before the command', () => {
    const parsed = parseCliArgs([
      '--provider',
      'minimax',
      '--model',
      'MiniMax-M2.1',
      'core',
      'run',
      '--stdin',
      '--args',
      'hello',
      '--pretty',
      '--verbose',
    ]);

    expect(parsed.command).toBe('core');
    expect(parsed.positionals).toEqual(['run']);
    expect(parsed.values.provider).toBe('minimax');
    expect(parsed.values.model).toBe('MiniMax-M2.1');
    expect(parsed.values.stdin).toBe(true);
    expect(parsed.values.args).toBe('hello');
    expect(parsed.values.pretty).toBe(true);
    expect(parsed.values.verbose).toBe(true);
  });

  it('supports flags after the command (mixed ordering)', () => {
    const parsed = parseCliArgs([
      'core',
      'run',
      '--stdin',
      '--provider',
      'minimax',
      '--model',
      'MiniMax-M2.1',
      '--args',
      'hello',
    ]);

    expect(parsed.command).toBe('core');
    expect(parsed.positionals).toEqual(['run']);
    expect(parsed.values.provider).toBe('minimax');
    expect(parsed.values.stdin).toBe(true);
  });
});

