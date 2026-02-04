/**
 * Tests for Policy Enforcement
 * 
 * Tests all policy enforcement functionality:
 * - Tool policy checking (allowed/denied lists)
 * - General policy checking (network, filesystem, etc.)
 * - Tool call interception
 * - Policy-aware executors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkToolPolicy,
  checkPolicy,
  checkToolAllowed,
  validateToolsAllowed,
  getDeniedActions,
  getDeniedTools,
  getAllowedTools,
  ToolCallInterceptor,
  createPolicyAwareExecutor,
  type PolicyAction,
} from './runner.js';
import type { CognitiveModule } from '../types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockModule(overrides: Partial<CognitiveModule> = {}): CognitiveModule {
  return {
    name: 'test-module',
    version: '1.0.0',
    responsibility: 'Test module',
    excludes: [],
    prompt: 'Test prompt',
    location: '/test',
    format: 'v2',
    ...overrides,
  };
}

// =============================================================================
// checkToolPolicy Tests
// =============================================================================

describe('checkToolPolicy', () => {
  it('should allow all tools when no policy defined', () => {
    const module = createMockModule();
    
    expect(checkToolPolicy('write_file', module).allowed).toBe(true);
    expect(checkToolPolicy('shell', module).allowed).toBe(true);
    expect(checkToolPolicy('any_tool', module).allowed).toBe(true);
  });

  it('should deny tools in denied list', () => {
    const module = createMockModule({
      tools: {
        policy: 'allow_by_default',
        allowed: [],
        denied: ['write_file', 'shell', 'network'],
      },
    });
    
    const result = checkToolPolicy('write_file', module);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('explicitly denied');
    expect(result.policy).toBe('tools.denied');
  });

  it('should handle case-insensitive tool names', () => {
    const module = createMockModule({
      tools: {
        policy: 'allow_by_default',
        allowed: [],
        denied: ['Write_File'],
      },
    });
    
    expect(checkToolPolicy('write_file', module).allowed).toBe(false);
    expect(checkToolPolicy('WRITE_FILE', module).allowed).toBe(false);
    expect(checkToolPolicy('write-file', module).allowed).toBe(false);
  });

  it('should enforce deny_by_default policy', () => {
    const module = createMockModule({
      tools: {
        policy: 'deny_by_default',
        allowed: ['read_file', 'list_dir'],
      },
    });
    
    expect(checkToolPolicy('read_file', module).allowed).toBe(true);
    expect(checkToolPolicy('list_dir', module).allowed).toBe(true);
    
    const result = checkToolPolicy('write_file', module);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not in allowed list');
    expect(result.policy).toBe('tools.policy');
  });

  it('should allow tools in allow_by_default mode (not in denied)', () => {
    const module = createMockModule({
      tools: {
        policy: 'allow_by_default',
        allowed: [],
        denied: ['shell'],
      },
    });
    
    expect(checkToolPolicy('read_file', module).allowed).toBe(true);
    expect(checkToolPolicy('write_file', module).allowed).toBe(true);
    expect(checkToolPolicy('shell', module).allowed).toBe(false);
  });
});

// =============================================================================
// checkPolicy Tests
// =============================================================================

describe('checkPolicy', () => {
  it('should allow all actions when no policies defined', () => {
    const module = createMockModule();
    
    expect(checkPolicy('network', module).allowed).toBe(true);
    expect(checkPolicy('filesystem_write', module).allowed).toBe(true);
    expect(checkPolicy('side_effects', module).allowed).toBe(true);
    expect(checkPolicy('code_execution', module).allowed).toBe(true);
  });

  it('should deny actions marked as deny', () => {
    const module = createMockModule({
      policies: {
        network: 'deny',
        filesystem_write: 'deny',
        side_effects: 'allow',
        code_execution: 'deny',
      },
    });
    
    const networkResult = checkPolicy('network', module);
    expect(networkResult.allowed).toBe(false);
    expect(networkResult.reason).toContain("'network' is denied");
    expect(networkResult.policy).toBe('policies.network');
    
    expect(checkPolicy('filesystem_write', module).allowed).toBe(false);
    expect(checkPolicy('side_effects', module).allowed).toBe(true);
    expect(checkPolicy('code_execution', module).allowed).toBe(false);
  });
});

// =============================================================================
// checkToolAllowed Tests (Combined Check)
// =============================================================================

describe('checkToolAllowed', () => {
  it('should check both tool policy and general policies', () => {
    const module = createMockModule({
      policies: {
        filesystem_write: 'deny',
        side_effects: 'deny',
      },
      tools: {
        policy: 'allow_by_default',
        allowed: [],
      },
    });
    
    // write_file maps to filesystem_write and side_effects
    const result = checkToolAllowed('write_file', module);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('filesystem_write');
  });

  it('should block tools that require denied actions', () => {
    const module = createMockModule({
      policies: {
        network: 'deny',
      },
    });
    
    // Network tools should be blocked
    expect(checkToolAllowed('fetch', module).allowed).toBe(false);
    expect(checkToolAllowed('http', module).allowed).toBe(false);
    expect(checkToolAllowed('curl', module).allowed).toBe(false);
    
    // Non-network tools should be allowed
    expect(checkToolAllowed('read_file', module).allowed).toBe(true);
  });

  it('should block shell/exec when code_execution denied', () => {
    const module = createMockModule({
      policies: {
        code_execution: 'deny',
      },
    });
    
    expect(checkToolAllowed('shell', module).allowed).toBe(false);
    expect(checkToolAllowed('exec', module).allowed).toBe(false);
    expect(checkToolAllowed('code_interpreter', module).allowed).toBe(false);
  });

  it('should check explicit tools policy first', () => {
    const module = createMockModule({
      policies: {
        network: 'allow', // Allow network in general
      },
      tools: {
        policy: 'allow_by_default',
        allowed: [],
        denied: ['fetch'], // But explicitly deny fetch
      },
    });
    
    const result = checkToolAllowed('fetch', module);
    expect(result.allowed).toBe(false);
    expect(result.policy).toBe('tools.denied');
  });
});

// =============================================================================
// validateToolsAllowed Tests
// =============================================================================

describe('validateToolsAllowed', () => {
  it('should return empty array when all tools allowed', () => {
    const module = createMockModule();
    
    const violations = validateToolsAllowed(['read_file', 'write_file', 'shell'], module);
    expect(violations).toHaveLength(0);
  });

  it('should return all violations', () => {
    const module = createMockModule({
      policies: {
        network: 'deny',
        code_execution: 'deny',
      },
    });
    
    const violations = validateToolsAllowed(['fetch', 'shell', 'read_file'], module);
    expect(violations).toHaveLength(2);
    expect(violations.some(v => v.reason?.includes('fetch'))).toBe(true);
    expect(violations.some(v => v.reason?.includes('shell'))).toBe(true);
  });
});

// =============================================================================
// Helper Functions Tests
// =============================================================================

describe('getDeniedActions', () => {
  it('should return list of denied actions', () => {
    const module = createMockModule({
      policies: {
        network: 'deny',
        filesystem_write: 'deny',
        side_effects: 'allow',
      },
    });
    
    const denied = getDeniedActions(module);
    expect(denied).toContain('network');
    expect(denied).toContain('filesystem_write');
    expect(denied).not.toContain('side_effects');
  });

  it('should return empty array when no policies', () => {
    const module = createMockModule();
    expect(getDeniedActions(module)).toHaveLength(0);
  });
});

describe('getDeniedTools', () => {
  it('should return denied tools list', () => {
    const module = createMockModule({
      tools: {
        policy: 'allow_by_default',
        allowed: [],
        denied: ['shell', 'network', 'write_file'],
      },
    });
    
    const denied = getDeniedTools(module);
    expect(denied).toContain('shell');
    expect(denied).toContain('network');
    expect(denied).toContain('write_file');
  });
});

describe('getAllowedTools', () => {
  it('should return null for allow_by_default', () => {
    const module = createMockModule({
      tools: {
        policy: 'allow_by_default',
        allowed: ['read_file'],
      },
    });
    
    expect(getAllowedTools(module)).toBeNull();
  });

  it('should return allowed list for deny_by_default', () => {
    const module = createMockModule({
      tools: {
        policy: 'deny_by_default',
        allowed: ['read_file', 'list_dir'],
      },
    });
    
    const allowed = getAllowedTools(module);
    expect(allowed).toEqual(['read_file', 'list_dir']);
  });
});

// =============================================================================
// ToolCallInterceptor Tests
// =============================================================================

describe('ToolCallInterceptor', () => {
  let module: CognitiveModule;
  let interceptor: ToolCallInterceptor;

  beforeEach(() => {
    module = createMockModule({
      policies: {
        network: 'deny',
        filesystem_write: 'deny',
      },
      tools: {
        policy: 'deny_by_default',
        allowed: ['read_file', 'list_dir'],
      },
    });
    interceptor = new ToolCallInterceptor(module);
  });

  it('should check if tool is allowed', () => {
    expect(interceptor.checkAllowed('read_file').allowed).toBe(true);
    expect(interceptor.checkAllowed('write_file').allowed).toBe(false);
    expect(interceptor.checkAllowed('fetch').allowed).toBe(false);
  });

  it('should execute allowed tool', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('file content');
    interceptor.registerTool('read_file', mockExecutor);
    
    const result = await interceptor.execute({
      name: 'read_file',
      arguments: { path: '/test.txt' },
    });
    
    expect(result.success).toBe(true);
    expect(result.result).toBe('file content');
    expect(mockExecutor).toHaveBeenCalledWith({ path: '/test.txt' });
  });

  it('should block denied tool', async () => {
    const mockExecutor = vi.fn().mockResolvedValue('done');
    interceptor.registerTool('write_file', mockExecutor);
    
    const result = await interceptor.execute({
      name: 'write_file',
      arguments: { path: '/test.txt', content: 'hello' },
    });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TOOL_NOT_ALLOWED');
    expect(mockExecutor).not.toHaveBeenCalled();
  });

  it('should log all calls', async () => {
    interceptor.registerTool('read_file', vi.fn().mockResolvedValue('ok'));
    interceptor.registerTool('write_file', vi.fn().mockResolvedValue('ok'));
    
    await interceptor.execute({ name: 'read_file', arguments: {} });
    await interceptor.execute({ name: 'write_file', arguments: {} });
    await interceptor.execute({ name: 'read_file', arguments: {} });
    
    const log = interceptor.getCallLog();
    expect(log).toHaveLength(3);
    expect(log[0].tool).toBe('read_file');
    expect(log[0].allowed).toBe(true);
    expect(log[1].tool).toBe('write_file');
    expect(log[1].allowed).toBe(false);
  });

  it('should get denied calls', async () => {
    interceptor.registerTool('read_file', vi.fn().mockResolvedValue('ok'));
    
    await interceptor.execute({ name: 'read_file', arguments: {} });
    await interceptor.execute({ name: 'write_file', arguments: {} });
    await interceptor.execute({ name: 'shell', arguments: {} });
    
    const denied = interceptor.getDeniedCalls();
    expect(denied).toHaveLength(2);
    expect(denied.some(d => d.tool === 'write_file')).toBe(true);
    expect(denied.some(d => d.tool === 'shell')).toBe(true);
  });

  it('should execute many and stop on policy violation', async () => {
    interceptor.registerTool('read_file', vi.fn().mockResolvedValue('ok'));
    interceptor.registerTool('list_dir', vi.fn().mockResolvedValue(['a', 'b']));
    
    const results = await interceptor.executeMany([
      { name: 'read_file', arguments: {} },
      { name: 'write_file', arguments: {} }, // Blocked
      { name: 'list_dir', arguments: {} }, // Should not execute
    ]);
    
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it('should provide policy summary', () => {
    const summary = interceptor.getPolicySummary();
    
    expect(summary.deniedActions).toContain('network');
    expect(summary.deniedActions).toContain('filesystem_write');
    expect(summary.allowedTools).toEqual(['read_file', 'list_dir']);
    expect(summary.toolsPolicy).toBe('deny_by_default');
  });
});

// =============================================================================
// createPolicyAwareExecutor Tests
// =============================================================================

describe('createPolicyAwareExecutor', () => {
  it('should execute allowed tool', async () => {
    const module = createMockModule();
    const executor = vi.fn().mockResolvedValue('result');
    
    const safeExecutor = createPolicyAwareExecutor(module, 'read_file', executor);
    const result = await safeExecutor({ path: '/test.txt' });
    
    expect(result).toBe('result');
    expect(executor).toHaveBeenCalledWith({ path: '/test.txt' });
  });

  it('should throw on policy violation', async () => {
    const module = createMockModule({
      policies: {
        filesystem_write: 'deny',
      },
    });
    const executor = vi.fn().mockResolvedValue('result');
    
    const safeExecutor = createPolicyAwareExecutor(module, 'write_file', executor);
    
    await expect(safeExecutor({ path: '/test.txt' })).rejects.toThrow('Policy violation');
    expect(executor).not.toHaveBeenCalled();
  });
});
