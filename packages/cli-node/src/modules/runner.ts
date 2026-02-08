/**
 * Module Runner - Execute Cognitive Modules
 * v2.2: Envelope format with meta/data separation, risk_rule, repair pass
 * v2.2.1: Version field, enhanced error taxonomy, observability hooks, streaming
 */

import _Ajv from 'ajv';
const Ajv = _Ajv.default || _Ajv;
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { 
  Provider, 
  ProviderCapabilities,
  JsonSchemaMode,
  StructuredOutputPreference,
  CognitiveModule, 
  ModuleResult, 
  ModuleResultV21,
  ModuleResultV22,
  Message, 
  ModuleInput,
  EnvelopeResponse,
  EnvelopeResponseV22,
  EnvelopeMeta,
  ModuleResultData,
  ModuleTier,
  SchemaStrictness,
  RiskLevel,
  RiskRule,
  InvokeResult,
  ExecutionPolicy,
} from '../types.js';
import { aggregateRisk, isV22Envelope } from '../types.js';
import { readModuleProvenance, verifyModuleIntegrity } from '../provenance.js';
import { extractJsonCandidates, type JsonExtractResult } from './json-extract.js';
import { formatPolicySummaryLine } from '../policy-summary.js';

// =============================================================================
// Schema Validation
// =============================================================================

const ajv = new Ajv({ allErrors: true, strict: false });

type JsonParseAttempt = { strategy: string; error: string };

function safeSnippet(s: string, max = 500): string {
  const raw = String(s ?? '');
  if (raw.length <= max) return raw;
  return raw.slice(0, max) + `…(+${raw.length - max} chars)`;
}

function parseJsonWithCandidates(raw: string): { parsed: unknown; extracted: JsonExtractResult; attempts: JsonParseAttempt[] } {
  const candidates = extractJsonCandidates(raw);
  const attempts: JsonParseAttempt[] = [];

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.json.trim());
      return { parsed, extracted: c, attempts };
    } catch (e) {
      attempts.push({ strategy: c.strategy, error: (e as Error).message });
    }
  }

  const err = new Error(attempts[0]?.error ?? 'Unable to parse JSON');
  (err as any).details = {
    parse_attempts: attempts,
    raw_response_snippet: safeSnippet(raw, 500),
  };
  throw err;
}

/**
 * Validate data against JSON schema. Returns list of errors.
 */
export function validateData(data: unknown, schema: object, label: string = 'Data'): string[] {
  const errors: string[] = [];
  if (!schema || Object.keys(schema).length === 0) {
    return errors;
  }
  
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        const path = err.instancePath || '/';
        errors.push(`${label} validation error: ${err.message} at ${path}`);
      }
    }
  } catch (e) {
    errors.push(`Schema error: ${(e as Error).message}`);
  }
  
  return errors;
}

// =============================================================================
// v2.2 Policy Enforcement
// =============================================================================

/** Action types that can be checked against policies */
export type PolicyAction = 'network' | 'filesystem_write' | 'side_effects' | 'code_execution';

/** Tool categories for automatic policy mapping */
const TOOL_POLICY_MAPPING: Record<string, PolicyAction[]> = {
  // Network tools
  'fetch': ['network'],
  'http': ['network'],
  'request': ['network'],
  'curl': ['network'],
  'wget': ['network'],
  'api_call': ['network'],
  
  // Filesystem tools
  'write_file': ['filesystem_write', 'side_effects'],
  'create_file': ['filesystem_write', 'side_effects'],
  'delete_file': ['filesystem_write', 'side_effects'],
  'rename_file': ['filesystem_write', 'side_effects'],
  'mkdir': ['filesystem_write', 'side_effects'],
  'rmdir': ['filesystem_write', 'side_effects'],
  
  // Code execution tools
  'shell': ['code_execution', 'side_effects'],
  'exec': ['code_execution', 'side_effects'],
  'run_code': ['code_execution', 'side_effects'],
  'code_interpreter': ['code_execution', 'side_effects'],
  'eval': ['code_execution', 'side_effects'],
  
  // Database tools
  'sql_query': ['side_effects'],
  'db_write': ['side_effects'],
};

/** Result of a policy check */
export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  policy?: string;
}

/**
 * Check if a tool is allowed by the module's tools policy.
 * 
 * @param toolName The name of the tool to check
 * @param module The cognitive module config
 * @returns PolicyCheckResult indicating if the tool is allowed
 * 
 * @example
 * const result = checkToolPolicy('write_file', module);
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 */
export function checkToolPolicy(
  toolName: string,
  module: CognitiveModule
): PolicyCheckResult {
  const toolsPolicy = module.tools;
  
  // No policy = allow all
  if (!toolsPolicy) {
    return { allowed: true };
  }
  
  const normalizedName = toolName.toLowerCase().replace(/[-\s]/g, '_');
  
  // Check explicit denied list first
  if (toolsPolicy.denied?.some(d => d.toLowerCase().replace(/[-\s]/g, '_') === normalizedName)) {
    return {
      allowed: false,
      reason: `Tool '${toolName}' is explicitly denied by module tools policy`,
      policy: 'tools.denied'
    };
  }
  
  // Check policy mode
  if (toolsPolicy.policy === 'deny_by_default') {
    // In deny_by_default mode, tool must be in allowed list
    const isAllowed = toolsPolicy.allowed?.some(
      a => a.toLowerCase().replace(/[-\s]/g, '_') === normalizedName
    );
    
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' not in allowed list (policy: deny_by_default)`,
        policy: 'tools.policy'
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Check if an action is allowed by the module's policies.
 * 
 * @param action The action to check (network, filesystem_write, etc.)
 * @param module The cognitive module config
 * @returns PolicyCheckResult indicating if the action is allowed
 * 
 * @example
 * const result = checkPolicy('network', module);
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 */
export function checkPolicy(
  action: PolicyAction,
  module: CognitiveModule
): PolicyCheckResult {
  const policies = module.policies;
  
  // No policies = allow all
  if (!policies) {
    return { allowed: true };
  }
  
  // Check the specific policy
  if (policies[action] === 'deny') {
    return {
      allowed: false,
      reason: `Action '${action}' is denied by module policy`,
      policy: `policies.${action}`
    };
  }
  
  return { allowed: true };
}

/**
 * Check if a tool is allowed considering both tools policy and general policies.
 * This performs a comprehensive check that:
 * 1. Checks the tools policy (allowed/denied lists)
 * 2. Maps the tool to policy actions and checks those
 * 
 * @param toolName The name of the tool to check
 * @param module The cognitive module config
 * @returns PolicyCheckResult with detailed information
 * 
 * @example
 * const result = checkToolAllowed('write_file', module);
 * if (!result.allowed) {
 *   return makeErrorResponse({
 *     code: 'POLICY_VIOLATION',
 *     message: result.reason,
 *   });
 * }
 */
export function checkToolAllowed(
  toolName: string,
  module: CognitiveModule
): PolicyCheckResult {
  // First check explicit tools policy
  const toolCheck = checkToolPolicy(toolName, module);
  if (!toolCheck.allowed) {
    return toolCheck;
  }
  
  // Then check mapped policies
  const normalizedName = toolName.toLowerCase().replace(/[-\s]/g, '_');
  const mappedActions = TOOL_POLICY_MAPPING[normalizedName] || [];
  
  for (const action of mappedActions) {
    const policyCheck = checkPolicy(action, module);
    if (!policyCheck.allowed) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' requires '${action}' which is denied by policy`,
        policy: policyCheck.policy
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Validate that a list of tools are all allowed by the module's policies.
 * Returns all violations found.
 * 
 * @param toolNames List of tool names to check
 * @param module The cognitive module config
 * @returns Array of PolicyCheckResult for denied tools
 */
export function validateToolsAllowed(
  toolNames: string[],
  module: CognitiveModule
): PolicyCheckResult[] {
  const violations: PolicyCheckResult[] = [];
  
  for (const toolName of toolNames) {
    const result = checkToolAllowed(toolName, module);
    if (!result.allowed) {
      violations.push(result);
    }
  }
  
  return violations;
}

/**
 * Get all denied actions for a module based on its policies.
 * Useful for informing LLM about restrictions.
 */
export function getDeniedActions(module: CognitiveModule): PolicyAction[] {
  const denied: PolicyAction[] = [];
  const policies = module.policies;
  
  if (!policies) return denied;
  
  const actions: PolicyAction[] = ['network', 'filesystem_write', 'side_effects', 'code_execution'];
  for (const action of actions) {
    if (policies[action] === 'deny') {
      denied.push(action);
    }
  }
  
  return denied;
}

/**
 * Get all denied tools for a module based on its tools policy.
 */
export function getDeniedTools(module: CognitiveModule): string[] {
  return module.tools?.denied || [];
}

/**
 * Get all allowed tools for a module (only meaningful in deny_by_default mode).
 */
export function getAllowedTools(module: CognitiveModule): string[] | null {
  if (module.tools?.policy === 'deny_by_default') {
    return module.tools.allowed || [];
  }
  return null; // null means "all allowed except denied list"
}

// =============================================================================
// Tool Call Interceptor
// =============================================================================

/** Tool call request from LLM */
export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/** Tool call result */
export interface ToolCallResult {
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

/** Tool executor function type */
export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * ToolCallInterceptor - Intercepts and validates tool calls against module policies.
 * 
 * Use this class to wrap tool execution with policy enforcement:
 * 
 * @example
 * const interceptor = new ToolCallInterceptor(module);
 * 
 * // Register tool executors
 * interceptor.registerTool('read_file', async (args) => {
 *   return fs.readFile(args.path as string, 'utf-8');
 * });
 * 
 * // Execute tool with policy check
 * const result = await interceptor.execute({
 *   name: 'write_file',
 *   arguments: { path: '/tmp/test.txt', content: 'hello' }
 * });
 * 
 * if (!result.success) {
 *   console.error('Tool blocked:', result.error);
 * }
 */
export class ToolCallInterceptor {
  private module: CognitiveModule;
  private tools: Map<string, ToolExecutor> = new Map();
  private callLog: Array<{ tool: string; allowed: boolean; timestamp: number }> = [];
  
  constructor(module: CognitiveModule) {
    this.module = module;
  }
  
  /**
   * Register a tool executor.
   */
  registerTool(name: string, executor: ToolExecutor): void {
    this.tools.set(name.toLowerCase(), executor);
  }
  
  /**
   * Register multiple tools at once.
   */
  registerTools(tools: Record<string, ToolExecutor>): void {
    for (const [name, executor] of Object.entries(tools)) {
      this.registerTool(name, executor);
    }
  }
  
  /**
   * Check if a tool call is allowed without executing it.
   */
  checkAllowed(toolName: string): PolicyCheckResult {
    return checkToolAllowed(toolName, this.module);
  }
  
  /**
   * Execute a tool call with policy enforcement.
   * 
   * @param request The tool call request
   * @returns ToolCallResult with success/error
   */
  async execute(request: ToolCallRequest): Promise<ToolCallResult> {
    const { name, arguments: args } = request;
    const timestamp = Date.now();
    
    // Check policy
    const policyResult = checkToolAllowed(name, this.module);
    
    if (!policyResult.allowed) {
      this.callLog.push({ tool: name, allowed: false, timestamp });
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_ALLOWED',
          message: policyResult.reason || `Tool '${name}' is not allowed`,
        },
      };
    }
    
    // Find executor
    const executor = this.tools.get(name.toLowerCase());
    if (!executor) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${name}' is not registered`,
        },
      };
    }
    
    // Execute
    try {
      this.callLog.push({ tool: name, allowed: true, timestamp });
      const result = await executor(args);
      return { success: true, result };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: (e as Error).message,
        },
      };
    }
  }
  
  /**
   * Execute multiple tool calls in sequence.
   * Stops on first policy violation.
   */
  async executeMany(requests: ToolCallRequest[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];
    
    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);
      
      // Stop on policy violation (not execution error)
      if (!result.success && result.error?.code === 'TOOL_NOT_ALLOWED') {
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Get the call log for auditing.
   */
  getCallLog(): Array<{ tool: string; allowed: boolean; timestamp: number }> {
    return [...this.callLog];
  }
  
  /**
   * Get summary of denied calls.
   */
  getDeniedCalls(): Array<{ tool: string; timestamp: number }> {
    return this.callLog
      .filter(c => !c.allowed)
      .map(({ tool, timestamp }) => ({ tool, timestamp }));
  }
  
  /**
   * Clear the call log.
   */
  clearLog(): void {
    this.callLog = [];
  }
  
  /**
   * Get policy summary for this module.
   */
  getPolicySummary(): {
    deniedActions: PolicyAction[];
    deniedTools: string[];
    allowedTools: string[] | null;
    toolsPolicy: 'allow_by_default' | 'deny_by_default' | undefined;
  } {
    return {
      deniedActions: getDeniedActions(this.module),
      deniedTools: getDeniedTools(this.module),
      allowedTools: getAllowedTools(this.module),
      toolsPolicy: this.module.tools?.policy,
    };
  }
}

/**
 * Create a policy-aware tool executor wrapper.
 * 
 * @example
 * const safeExecutor = createPolicyAwareExecutor(module, 'write_file', async (args) => {
 *   return fs.writeFile(args.path, args.content);
 * });
 * 
 * // This will throw if write_file is denied
 * await safeExecutor({ path: '/tmp/test.txt', content: 'hello' });
 */
export function createPolicyAwareExecutor(
  module: CognitiveModule,
  toolName: string,
  executor: ToolExecutor
): ToolExecutor {
  return async (args: Record<string, unknown>) => {
    const policyResult = checkToolAllowed(toolName, module);
    
    if (!policyResult.allowed) {
      throw new Error(`Policy violation: ${policyResult.reason}`);
    }
    
    return executor(args);
  };
}

// =============================================================================
// v2.2 Runtime Enforcement - Overflow & Enum
// =============================================================================

/**
 * Validate overflow.insights against module's max_items config.
 * 
 * @param data The response data object
 * @param module The cognitive module config
 * @returns Array of errors if insights exceed limit
 */
export function validateOverflowLimits(
  data: Record<string, unknown>,
  module: CognitiveModule
): string[] {
  const errors: string[] = [];
  
  const overflowConfig = module.overflow;
  if (!overflowConfig?.enabled) {
    // If overflow disabled, insights should not exist
    const extensions = data.extensions as Record<string, unknown> | undefined;
    if (extensions?.insights && Array.isArray(extensions.insights) && extensions.insights.length > 0) {
      errors.push('Overflow is disabled but extensions.insights contains data');
    }
    return errors;
  }
  
  const maxItems = overflowConfig.max_items ?? 5;
  const extensions = data.extensions as Record<string, unknown> | undefined;
  
  if (extensions?.insights && Array.isArray(extensions.insights)) {
    const insights = extensions.insights as unknown[];
    
    if (insights.length > maxItems) {
      errors.push(`overflow.max_items exceeded: ${insights.length} > ${maxItems}`);
    }
    
    // Check require_suggested_mapping
    if (overflowConfig.require_suggested_mapping) {
      for (let i = 0; i < insights.length; i++) {
        const insight = insights[i] as Record<string, unknown>;
        if (!insight.suggested_mapping) {
          errors.push(`insight[${i}] missing required suggested_mapping`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validate enum values against module's enum strategy.
 * For strict mode, custom enum objects are not allowed.
 * 
 * @param data The response data object
 * @param module The cognitive module config
 * @returns Array of errors if enum violations found
 */
export function validateEnumStrategy(
  data: Record<string, unknown>,
  module: CognitiveModule
): string[] {
  const errors: string[] = [];
  
  const enumStrategy = module.enums?.strategy ?? 'strict';
  
  if (enumStrategy === 'strict') {
    // In strict mode, custom enum objects (with 'custom' key) are not allowed
    const checkForCustomEnums = (obj: unknown, path: string): void => {
      if (obj === null || obj === undefined) return;
      
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => checkForCustomEnums(item, `${path}[${i}]`));
      } else if (typeof obj === 'object') {
        const record = obj as Record<string, unknown>;
        
        // Check if this is a custom enum object (any presence of 'custom' is disallowed in strict mode)
        if ('custom' in record) {
          errors.push(`Custom enum not allowed in strict mode at ${path}: { custom: "${record.custom}" }`);
          return;
        }
        
        // Recurse into nested objects
        for (const [key, value] of Object.entries(record)) {
          checkForCustomEnums(value, `${path}.${key}`);
        }
      }
    };
    
    checkForCustomEnums(data, 'data');
  }
  
  return errors;
}

// =============================================================================
// Constants
// =============================================================================

const ENVELOPE_VERSION = '2.2';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Deep clone an object to avoid mutation issues.
 * Handles nested objects, arrays, and primitive values.
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

// =============================================================================
// Observability Hooks
// =============================================================================

/** Hook called before module execution */
export type BeforeCallHook = (moduleName: string, inputData: ModuleInput, moduleConfig: CognitiveModule) => void;

/** Hook called after successful module execution */
export type AfterCallHook = (moduleName: string, result: EnvelopeResponseV22<unknown>, latencyMs: number) => void;

/** Hook called when an error occurs */
export type ErrorHook = (moduleName: string, error: Error, partialResult: unknown | null) => void;

// Global hook registries
const _beforeCallHooks: BeforeCallHook[] = [];
const _afterCallHooks: AfterCallHook[] = [];
const _errorHooks: ErrorHook[] = [];

/**
 * Decorator to register a before-call hook.
 * 
 * @example
 * onBeforeCall((moduleName, inputData, config) => {
 *   console.log(`Calling ${moduleName} with`, inputData);
 * });
 */
export function onBeforeCall(hook: BeforeCallHook): BeforeCallHook {
  _beforeCallHooks.push(hook);
  return hook;
}

/**
 * Decorator to register an after-call hook.
 * 
 * @example
 * onAfterCall((moduleName, result, latencyMs) => {
 *   console.log(`${moduleName} completed in ${latencyMs}ms`);
 * });
 */
export function onAfterCall(hook: AfterCallHook): AfterCallHook {
  _afterCallHooks.push(hook);
  return hook;
}

/**
 * Decorator to register an error hook.
 * 
 * @example
 * onError((moduleName, error, partialResult) => {
 *   console.error(`Error in ${moduleName}:`, error);
 * });
 */
export function onError(hook: ErrorHook): ErrorHook {
  _errorHooks.push(hook);
  return hook;
}

/**
 * Register a hook programmatically.
 */
export function registerHook(
  hookType: 'before_call' | 'after_call' | 'error',
  hook: BeforeCallHook | AfterCallHook | ErrorHook
): void {
  if (hookType === 'before_call') {
    _beforeCallHooks.push(hook as BeforeCallHook);
  } else if (hookType === 'after_call') {
    _afterCallHooks.push(hook as AfterCallHook);
  } else if (hookType === 'error') {
    _errorHooks.push(hook as ErrorHook);
  } else {
    throw new Error(`Unknown hook type: ${hookType}`);
  }
}

/**
 * Unregister a hook. Returns true if found and removed.
 */
export function unregisterHook(
  hookType: 'before_call' | 'after_call' | 'error',
  hook: BeforeCallHook | AfterCallHook | ErrorHook
): boolean {
  let hooks: unknown[];
  if (hookType === 'before_call') {
    hooks = _beforeCallHooks;
  } else if (hookType === 'after_call') {
    hooks = _afterCallHooks;
  } else if (hookType === 'error') {
    hooks = _errorHooks;
  } else {
    return false;
  }
  
  const index = hooks.indexOf(hook);
  if (index !== -1) {
    hooks.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Clear all registered hooks.
 */
export function clearHooks(): void {
  _beforeCallHooks.length = 0;
  _afterCallHooks.length = 0;
  _errorHooks.length = 0;
}

function _invokeBeforeHooks(moduleName: string, inputData: ModuleInput, moduleConfig: CognitiveModule): void {
  for (const hook of _beforeCallHooks) {
    try {
      hook(moduleName, inputData, moduleConfig);
    } catch {
      // Hooks should not break the main flow
    }
  }
}

function _invokeAfterHooks(moduleName: string, result: EnvelopeResponseV22<unknown>, latencyMs: number): void {
  for (const hook of _afterCallHooks) {
    try {
      hook(moduleName, result, latencyMs);
    } catch {
      // Hooks should not break the main flow
    }
  }
}

function _invokeErrorHooks(moduleName: string, error: Error, partialResult: unknown | null): void {
  for (const hook of _errorHooks) {
    try {
      hook(moduleName, error, partialResult);
    } catch {
      // Hooks should not break the main flow
    }
  }
}

// =============================================================================
// Error Response Builder
// =============================================================================

/**
 * Error code taxonomy following CONFORMANCE.md E1xxx-E4xxx structure.
 * 
 * E1xxx: Input errors (caller errors, fixable by modifying input)
 * E2xxx: Processing errors (module understood input but couldn't complete)
 * E3xxx: Output errors (generated output doesn't meet requirements)
 * E4xxx: Runtime errors (infrastructure/system-level failures)
 */

/** Standard error codes with E-format (as per ERROR-CODES.md) */
export const ERROR_CODES = {
  // E1xxx: Input errors
  E1000: 'PARSE_ERROR',
  E1001: 'INVALID_INPUT',
  E1002: 'MISSING_REQUIRED_FIELD',
  E1003: 'TYPE_MISMATCH',
  E1004: 'UNSUPPORTED_VALUE',
  E1005: 'INPUT_TOO_LARGE',
  E1006: 'INVALID_REFERENCE',
  
  // E2xxx: Processing errors
  E2001: 'LOW_CONFIDENCE',
  E2002: 'TIMEOUT',
  E2003: 'TOKEN_LIMIT',
  E2004: 'NO_ACTION_POSSIBLE',
  E2005: 'SEMANTIC_CONFLICT',
  E2006: 'AMBIGUOUS_INPUT',
  E2007: 'INSUFFICIENT_CONTEXT',
  
  // E3xxx: Output errors
  E3001: 'OUTPUT_SCHEMA_VIOLATION',
  E3002: 'PARTIAL_RESULT',
  E3003: 'MISSING_RATIONALE',
  E3004: 'OVERFLOW_LIMIT',
  E3005: 'INVALID_ENUM',
  E3006: 'CONSTRAINT_VIOLATION',
  
  // E4xxx: Runtime errors
  E4000: 'INTERNAL_ERROR',
  E4001: 'PROVIDER_UNAVAILABLE',
  E4002: 'RATE_LIMITED',
  E4003: 'CONTEXT_OVERFLOW',
  E4004: 'CIRCULAR_DEPENDENCY',
  E4005: 'MAX_DEPTH_EXCEEDED',
  E4006: 'MODULE_NOT_FOUND',
  E4007: 'PERMISSION_DENIED',
} as const;

/** Reverse mapping: legacy code -> E-format code */
export const LEGACY_TO_E_CODE: Record<string, string> = {
  PARSE_ERROR: 'E1000',
  INVALID_INPUT: 'E1001',
  MISSING_REQUIRED_FIELD: 'E1002',
  TYPE_MISMATCH: 'E1003',
  UNSUPPORTED_VALUE: 'E1004',
  INPUT_TOO_LARGE: 'E1005',
  INVALID_REFERENCE: 'E1006',
  
  LOW_CONFIDENCE: 'E2001',
  TIMEOUT: 'E2002',
  TOKEN_LIMIT: 'E2003',
  NO_ACTION_POSSIBLE: 'E2004',
  SEMANTIC_CONFLICT: 'E2005',
  AMBIGUOUS_INPUT: 'E2006',
  INSUFFICIENT_CONTEXT: 'E2007',
  
  OUTPUT_SCHEMA_VIOLATION: 'E3001',
  SCHEMA_VALIDATION_FAILED: 'E3001', // Alias
  PARTIAL_RESULT: 'E3002',
  MISSING_RATIONALE: 'E3003',
  OVERFLOW_LIMIT: 'E3004',
  INVALID_ENUM: 'E3005',
  CONSTRAINT_VIOLATION: 'E3006',
  META_VALIDATION_FAILED: 'E3001', // Alias (output validation)
  
  INTERNAL_ERROR: 'E4000',
  PROVIDER_UNAVAILABLE: 'E4001',
  LLM_ERROR: 'E4001', // Alias
  RATE_LIMITED: 'E4002',
  CONTEXT_OVERFLOW: 'E4003',
  CIRCULAR_DEPENDENCY: 'E4004',
  MAX_DEPTH_EXCEEDED: 'E4005',
  MODULE_NOT_FOUND: 'E4006',
  PERMISSION_DENIED: 'E4007',
  POLICY_VIOLATION: 'E4007', // Alias
  TOOL_NOT_ALLOWED: 'E4007', // Alias
  UNKNOWN: 'E4000', // Fallback to internal error
};

/** Error codes and their default properties */
export const ERROR_PROPERTIES: Record<string, { recoverable: boolean; retry_after_ms: number | null }> = {
  // E1xxx: Input errors (mostly recoverable by fixing input)
  E1000: { recoverable: false, retry_after_ms: null }, // PARSE_ERROR
  E1001: { recoverable: true, retry_after_ms: null },  // INVALID_INPUT
  E1002: { recoverable: true, retry_after_ms: null },  // MISSING_REQUIRED_FIELD
  E1003: { recoverable: true, retry_after_ms: null },  // TYPE_MISMATCH
  E1004: { recoverable: false, retry_after_ms: null }, // UNSUPPORTED_VALUE
  E1005: { recoverable: true, retry_after_ms: null },  // INPUT_TOO_LARGE
  E1006: { recoverable: true, retry_after_ms: null },  // INVALID_REFERENCE
  
  // E2xxx: Processing errors (may have partial results)
  E2001: { recoverable: true, retry_after_ms: null },  // LOW_CONFIDENCE
  E2002: { recoverable: true, retry_after_ms: 5000 },  // TIMEOUT
  E2003: { recoverable: true, retry_after_ms: null },  // TOKEN_LIMIT
  E2004: { recoverable: false, retry_after_ms: null }, // NO_ACTION_POSSIBLE
  E2005: { recoverable: false, retry_after_ms: null }, // SEMANTIC_CONFLICT
  E2006: { recoverable: true, retry_after_ms: null },  // AMBIGUOUS_INPUT
  E2007: { recoverable: true, retry_after_ms: null },  // INSUFFICIENT_CONTEXT
  
  // E3xxx: Output errors (schema violations)
  E3001: { recoverable: true, retry_after_ms: 1000 },  // OUTPUT_SCHEMA_VIOLATION
  E3002: { recoverable: true, retry_after_ms: null },  // PARTIAL_RESULT
  E3003: { recoverable: false, retry_after_ms: null }, // MISSING_RATIONALE
  E3004: { recoverable: false, retry_after_ms: null }, // OVERFLOW_LIMIT
  E3005: { recoverable: false, retry_after_ms: null }, // INVALID_ENUM
  E3006: { recoverable: false, retry_after_ms: null }, // CONSTRAINT_VIOLATION
  
  // E4xxx: Runtime errors (infrastructure failures)
  E4000: { recoverable: false, retry_after_ms: null },   // INTERNAL_ERROR
  E4001: { recoverable: true, retry_after_ms: 5000 },    // PROVIDER_UNAVAILABLE
  E4002: { recoverable: true, retry_after_ms: 10000 },   // RATE_LIMITED
  E4003: { recoverable: false, retry_after_ms: null },   // CONTEXT_OVERFLOW
  E4004: { recoverable: false, retry_after_ms: null },   // CIRCULAR_DEPENDENCY
  E4005: { recoverable: false, retry_after_ms: null },   // MAX_DEPTH_EXCEEDED
  E4006: { recoverable: true, retry_after_ms: null },    // MODULE_NOT_FOUND
  E4007: { recoverable: false, retry_after_ms: null },   // PERMISSION_DENIED
  
  // Legacy codes (for backward compatibility)
  MODULE_NOT_FOUND: { recoverable: true, retry_after_ms: null },
  INVALID_INPUT: { recoverable: true, retry_after_ms: null },
  PARSE_ERROR: { recoverable: false, retry_after_ms: null },
  SCHEMA_VALIDATION_FAILED: { recoverable: true, retry_after_ms: 1000 },
  META_VALIDATION_FAILED: { recoverable: true, retry_after_ms: 1000 },
  POLICY_VIOLATION: { recoverable: false, retry_after_ms: null },
  TOOL_NOT_ALLOWED: { recoverable: false, retry_after_ms: null },
  LLM_ERROR: { recoverable: true, retry_after_ms: 5000 },
  RATE_LIMITED: { recoverable: true, retry_after_ms: 10000 },
  TIMEOUT: { recoverable: true, retry_after_ms: 5000 },
  UNKNOWN: { recoverable: false, retry_after_ms: null },
};

/**
 * Normalize error code to E-format.
 * Accepts both E-format (E1001) and legacy format (INVALID_INPUT).
 * 
 * @param code Error code in any format
 * @returns E-format code (e.g., "E1001")
 */
export function normalizeErrorCode(code: string): string {
  // Already E-format
  if (/^E\d{4}$/.test(code)) {
    return code;
  }
  
  // Map legacy to E-format
  const eCode = LEGACY_TO_E_CODE[code];
  return eCode || 'E4000'; // Default to INTERNAL_ERROR
}

/**
 * Get error category from E-format code.
 * 
 * @param code E-format error code (e.g., "E1001")
 * @returns Category: 'input' | 'processing' | 'output' | 'runtime'
 */
export function getErrorCategory(code: string): 'input' | 'processing' | 'output' | 'runtime' {
  const normalized = normalizeErrorCode(code);
  const category = normalized.charAt(1);
  
  switch (category) {
    case '1': return 'input';
    case '2': return 'processing';
    case '3': return 'output';
    case '4': return 'runtime';
    default: return 'runtime';
  }
}

export interface MakeErrorResponseOptions {
  /** Error code - accepts both E-format (E1001) and legacy format (INVALID_INPUT) */
  code: string;
  message: string;
  explain?: string;
  partialData?: unknown;
  details?: Record<string, unknown>;
  recoverable?: boolean;
  retryAfterMs?: number;
  confidence?: number;
  risk?: RiskLevel;
  /** Suggestion for how to fix the error */
  suggestion?: string;
  /** Whether to use E-format codes in output (default: true) */
  useEFormat?: boolean;
}

/**
 * Build a standardized error response with enhanced taxonomy.
 * Supports both E-format (E1001) and legacy format (INVALID_INPUT) error codes.
 * 
 * @param options Error response options
 * @returns Standardized error envelope
 */
export function makeErrorResponse(options: MakeErrorResponseOptions): EnvelopeResponseV22<unknown> {
  const {
    code,
    message,
    explain,
    partialData,
    details,
    recoverable,
    retryAfterMs,
    confidence = 0.0,
    risk = 'high',
    suggestion,
    useEFormat = true,
  } = options;

  // Normalize error code to E-format if requested
  const normalizedCode = useEFormat ? normalizeErrorCode(code) : code;
  
  // Get default properties from error code (try normalized first, then original)
  const defaults = ERROR_PROPERTIES[normalizedCode] || ERROR_PROPERTIES[code] || ERROR_PROPERTIES.UNKNOWN || { recoverable: false, retry_after_ms: null };

  const errorObj: {
    code: string;
    message: string;
    recoverable?: boolean;
    retry_after_ms?: number;
    details?: Record<string, unknown>;
    suggestion?: string;
  } = {
    code: normalizedCode,
    message,
  };

  // Add recoverable flag
  const isRecoverable = recoverable ?? defaults.recoverable;
  if (isRecoverable !== undefined) {
    errorObj.recoverable = isRecoverable;
  }

  // Add retry suggestion
  const retryMs = retryAfterMs ?? defaults.retry_after_ms;
  if (retryMs !== null && retryMs !== undefined) {
    errorObj.retry_after_ms = retryMs;
  }

  // Add suggestion if provided
  if (suggestion) {
    errorObj.suggestion = suggestion;
  }

  // Add details if provided
  if (details) {
    errorObj.details = details;
  }

  // Determine confidence based on error category (if not explicitly provided)
  let finalConfidence = confidence;
  if (confidence === 0.0 && partialData) {
    // If we have partial data, may have some confidence
    const category = getErrorCategory(normalizedCode);
    if (category === 'processing') {
      finalConfidence = 0.3; // Some partial understanding
    }
  }

  return {
    ok: false,
    version: ENVELOPE_VERSION,
    meta: {
      confidence: finalConfidence,
      risk,
      explain: (explain || message).slice(0, 280),
    },
    error: errorObj,
    partial_data: partialData,
  };
}

export interface MakeSuccessResponseOptions {
  data: unknown;
  confidence: number;
  risk: RiskLevel;
  explain: string;
  latencyMs?: number;
  model?: string;
  traceId?: string;
}

/**
 * Build a standardized success response.
 */
export function makeSuccessResponse(options: MakeSuccessResponseOptions): EnvelopeResponseV22<unknown> {
  const { data, confidence, risk, explain, latencyMs, model, traceId } = options;

  const meta: EnvelopeMeta = {
    confidence: Math.max(0.0, Math.min(1.0, confidence)),
    risk,
    explain: explain ? explain.slice(0, 280) : 'No explanation provided',
  };

  if (latencyMs !== undefined) {
    meta.latency_ms = latencyMs;
  }
  if (model) {
    meta.model = model;
  }
  if (traceId) {
    meta.trace_id = traceId;
  }

  return {
    ok: true,
    version: ENVELOPE_VERSION,
    meta,
    data,
  };
}

// =============================================================================
// Run Options
// =============================================================================

export interface RunOptions {
  // Clean input (v2 style)
  input?: ModuleInput;
  
  // Legacy CLI args (v1 compatibility) - mapped to input.code or input.query
  args?: string;
  
  // Runtime options
  verbose?: boolean;
  
  // Whether to validate input against schema (default: true)
  validateInput?: boolean;
  
  // Whether to validate output against schema (default: true)
  validateOutput?: boolean;
  
  // Force envelope format (default: auto-detect from module.output.envelope)
  useEnvelope?: boolean;
  
  // Force v2.2 format (default: auto-detect from module.tier)
  useV22?: boolean;
  
  // Enable repair pass for validation failures (default: true)
  enableRepair?: boolean;
  
  // Trace ID for distributed tracing
  traceId?: string;
  
  // Model identifier (for meta.model tracking)
  model?: string;

  // Progressive complexity policy (certified gates, validation defaults, etc.)
  policy?: ExecutionPolicy;

  /**
   * Structured output preference override (CLI/tests).
   * If omitted, uses policy.structured (or auto).
   */
  structured?: StructuredOutputPreference;
}

// =============================================================================
// Repair Pass (v2.2)
// =============================================================================

/**
 * Attempt to repair envelope format issues without changing semantics.
 * 
 * Repairs (mostly lossless, except explain truncation):
 * - Missing meta fields (fill with conservative defaults)
 * - Truncate explain if too long
 * - Trim whitespace from string fields
 * - Clamp confidence to [0, 1] range
 * 
 * Does NOT repair:
 * - Invalid enum values (treated as validation failure)
 * 
 * Note: Returns a deep copy to avoid modifying the original data.
 */
function repairEnvelope(
  response: Record<string, unknown>,
  riskRule: RiskRule = 'max_changes_risk',
  maxExplainLength: number = 280
): EnvelopeResponseV22<unknown> {
  // Deep clone to avoid mutation
  const repaired = deepClone(response);
  
  // Ensure meta exists
  if (!repaired.meta || typeof repaired.meta !== 'object') {
    repaired.meta = {};
  }
  
  const meta = repaired.meta as Record<string, unknown>;
  const data = (repaired.data ?? {}) as Record<string, unknown>;
  
  // Repair confidence
  if (typeof meta.confidence !== 'number') {
    meta.confidence = (data.confidence as number) ?? 0.5;
  }
  meta.confidence = Math.max(0, Math.min(1, meta.confidence as number));
  
  // Repair risk using configurable aggregation rule
  if (!meta.risk) {
    meta.risk = aggregateRisk(data, riskRule);
  }
  // Trim whitespace only (lossless). Do NOT repair invalid enum values.
  if (typeof meta.risk === 'string') {
    const trimmedRisk = meta.risk.trim().toLowerCase();
    const validRisks = ['none', 'low', 'medium', 'high'];
    if (validRisks.includes(trimmedRisk)) {
      meta.risk = trimmedRisk;
    }
  }
  
  // Repair explain
  if (typeof meta.explain !== 'string') {
    const rationale = data.rationale as string | undefined;
    meta.explain = rationale ? String(rationale).slice(0, maxExplainLength) : 'No explanation provided';
  }
  // Trim whitespace (lossless)
  const explainStr = meta.explain as string;
  meta.explain = explainStr.trim();
  if ((meta.explain as string).length > maxExplainLength) {
    meta.explain = (meta.explain as string).slice(0, maxExplainLength - 3) + '...';
  }
  
  // Build proper v2.2 response with version
  const builtMeta: EnvelopeMeta = {
    confidence: meta.confidence as number,
    risk: meta.risk as RiskLevel,
    explain: meta.explain as string
  };
  
  const result: EnvelopeResponseV22<unknown> = repaired.ok === false ? {
    ok: false,
    version: ENVELOPE_VERSION,
    meta: builtMeta,
    // E4000 is an internal/runtime error fallback (should rarely happen after repair).
    error: (repaired.error as { code: string; message: string }) ?? { code: 'E4000', message: 'Unknown error' },
    partial_data: repaired.partial_data
  } : {
    ok: true,
    version: ENVELOPE_VERSION,
    meta: builtMeta,
    data: repaired.data
  };
  
  return result;
}

/**
 * Repair error envelope format.
 * 
 * Note: Returns a deep copy to avoid modifying the original data.
 */
function repairErrorEnvelope(
  data: Record<string, unknown>,
  maxExplainLength: number = 280
): EnvelopeResponseV22<unknown> {
  // Deep clone to avoid mutation
  const repaired = deepClone(data);
  
  // Ensure meta exists for errors
  if (!repaired.meta || typeof repaired.meta !== 'object') {
    repaired.meta = {};
  }
  
  const meta = repaired.meta as Record<string, unknown>;
  
  // Set default meta for errors
  if (typeof meta.confidence !== 'number') {
    meta.confidence = 0.0;
  }
  if (!meta.risk) {
    meta.risk = 'high';
  }
  if (typeof meta.explain !== 'string') {
    const error = (repaired.error ?? {}) as Record<string, unknown>;
    meta.explain = ((error.message as string) ?? 'An error occurred').slice(0, maxExplainLength);
  }
  
  return {
    ok: false,
    version: ENVELOPE_VERSION,
    meta: {
      confidence: meta.confidence as number,
      risk: meta.risk as RiskLevel,
      explain: meta.explain as string,
    },
    // E4000 is an internal/runtime error fallback (should rarely happen after repair).
    error: (repaired.error as { code: string; message: string }) ?? { code: 'E4000', message: 'Unknown error' },
    partial_data: repaired.partial_data,
  };
}

/**
 * Wrap v2.1 response to v2.2 format
 */
function wrapV21ToV22(
  response: EnvelopeResponse<unknown>,
  riskRule: RiskRule = 'max_changes_risk'
): EnvelopeResponseV22<unknown> {
  if (isV22Envelope(response)) {
    // Already v2.2, but ensure version field exists
    if (!('version' in response) || !response.version) {
      return { ...deepClone(response), version: ENVELOPE_VERSION };
    }
    return response;
  }
  
  if (response.ok) {
    const data = (response.data ?? {}) as Record<string, unknown>;
    const confidence = (data.confidence as number) ?? 0.5;
    const rationale = (data.rationale as string) ?? '';
    
    return {
      ok: true,
      version: ENVELOPE_VERSION,
      meta: {
        confidence,
        risk: aggregateRisk(data, riskRule),
        explain: rationale.slice(0, 280) || 'No explanation provided'
      },
      data: data as ModuleResultData
    };
  } else {
    const errorMsg = response.error?.message ?? 'Unknown error';
    return {
      ok: false,
      version: ENVELOPE_VERSION,
      meta: {
        confidence: 0,
        risk: 'high',
        explain: errorMsg.slice(0, 280)
      },
      error: response.error ?? { code: 'E4000', message: errorMsg }, // INTERNAL_ERROR fallback
      partial_data: response.partial_data
    };
  }
}

/**
 * Convert legacy format (no envelope) to v2.2 envelope.
 */
function convertLegacyToEnvelope(
  data: unknown,
  isError: boolean = false
): EnvelopeResponseV22<unknown> {
  const isPlainObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  const dataObj = isPlainObject ? (data as Record<string, unknown>) : { result: data };
  
  if (isError || (isPlainObject && 'error' in dataObj)) {
    const error = (dataObj.error ?? {}) as Record<string, unknown>;
    const errorMsg = typeof error === 'object' 
      ? ((error.message as string) ?? String(error))
      : String(error);
    
    return {
      ok: false,
      version: ENVELOPE_VERSION,
      meta: {
        confidence: 0.0,
        risk: 'high',
        explain: errorMsg.slice(0, 280),
      },
      error: {
        code: (typeof error === 'object' ? (error.code as string) : undefined) ?? 'UNKNOWN',
        message: errorMsg,
      },
      partial_data: undefined,
    };
  } else {
    const confidence = (dataObj.confidence as number) ?? 0.5;
    const rationale = (dataObj.rationale as string) ?? '';
    
    return {
      ok: true,
      version: ENVELOPE_VERSION,
      meta: {
        confidence,
        risk: aggregateRisk(dataObj),
        explain: rationale.slice(0, 280) || 'No explanation provided',
      },
      data: dataObj,
    };
  }
}

async function enforcePolicyGates(
  module: CognitiveModule,
  policy: ExecutionPolicy | undefined
): Promise<EnvelopeResponseV22<unknown> | null> {
  if (!policy) return null;

  if (policy.requireV22) {
    const fv = module.formatVersion ?? 'unknown';
    if (fv !== 'v2.2') {
      return makeErrorResponse({
        code: 'E4007', // PERMISSION_DENIED
        message: `Certified policy requires v2.2 modules; got: ${fv} (${module.format})`,
        explain: 'Refused by execution policy.',
        confidence: 1.0,
        risk: 'none',
        suggestion: 'Migrate the module to v2.2, or rerun with --profile standard.',
      });
    }
  }

  if (policy.profile !== 'certified') return null;

  const loc = module.location;
  if (typeof loc !== 'string' || loc.trim().length === 0) {
    return makeErrorResponse({
      code: 'E4007', // PERMISSION_DENIED
      message: 'Certified policy requires an installed module with provenance; module location is missing.',
      explain: 'Refused by execution policy.',
      confidence: 1.0,
      risk: 'none',
      suggestion: 'Reinstall the module from a registry tarball that writes provenance.json.',
    });
  }

  // Single-file modules (5-minute path) are intentionally not allowed in certified flows.
  try {
    const st = await fs.stat(loc);
    if (!st.isDirectory()) {
      return makeErrorResponse({
        code: 'E4007', // PERMISSION_DENIED
        message: `Certified policy requires module directory provenance; got a non-directory location: ${loc}`,
        explain: 'Refused by execution policy.',
        confidence: 1.0,
        risk: 'none',
        suggestion: 'Install the module via `cog add <name>` (registry tarball) or rerun with --profile standard.',
      });
    }
  } catch {
    return makeErrorResponse({
      code: 'E4007',
      message: `Certified policy requires module directory provenance, but location does not exist: ${loc}`,
      explain: 'Refused by execution policy.',
      confidence: 1.0,
      risk: 'none',
      suggestion: 'Reinstall the module from a registry tarball and retry.',
    });
  }

  const prov = await readModuleProvenance(loc);
  if (!prov) {
    return makeErrorResponse({
      code: 'E4007', // PERMISSION_DENIED
      message: `Certified policy requires provenance.json in the module directory: ${loc}`,
      explain: 'Refused by execution policy.',
      confidence: 1.0,
      risk: 'none',
      suggestion: 'Reinstall the module from a registry tarball (distribution.tarball + checksum), then retry.',
    });
  }

  if (prov.source.type !== 'registry') {
    return makeErrorResponse({
      code: 'E4007', // PERMISSION_DENIED
      message: `Certified policy requires registry provenance; module provenance is type=${prov.source.type}`,
      explain: 'Refused by execution policy.',
      confidence: 1.0,
      risk: 'none',
      suggestion: 'Reinstall the module from a registry tarball and retry, or rerun with --profile standard.',
    });
  }

  // Integrity check (tamper detection).
  const ok = await verifyModuleIntegrity(loc, prov);
  if (!ok.ok) {
    return makeErrorResponse({
      code: 'E4007', // PERMISSION_DENIED
      message: `Certified policy integrity check failed: ${ok.reason}`,
      explain: 'Module contents appear to have been modified after install.',
      confidence: 1.0,
      risk: 'none',
      suggestion: 'Reinstall the module from the registry tarball to restore integrity.',
      details: { location: loc, reason: ok.reason },
    });
  }

  // Optional: enforce that the module directory remains within itself (defense-in-depth for weird paths).
  const resolved = path.resolve(loc);
  if (!resolved) return null;

  return null;
}

function resolveValidationFlags(
  module: CognitiveModule,
  policy: ExecutionPolicy | undefined,
  validateInputOpt: boolean | undefined,
  validateOutputOpt: boolean | undefined
): { validateInput: boolean; validateOutput: boolean; reason: string } {
  // Explicit overrides win.
  if (typeof validateInputOpt === 'boolean' || typeof validateOutputOpt === 'boolean') {
    const validateInput = typeof validateInputOpt === 'boolean' ? validateInputOpt : true;
    const validateOutput = typeof validateOutputOpt === 'boolean' ? validateOutputOpt : true;
    return { validateInput, validateOutput, reason: 'explicit validateInput/validateOutput' };
  }

  if (!policy) {
    return { validateInput: true, validateOutput: true, reason: 'no policy (default on)' };
  }

  if (policy.validate === 'off') {
    return { validateInput: false, validateOutput: false, reason: 'policy.validate=off' };
  }

  if (policy.validate === 'on') {
    return { validateInput: true, validateOutput: true, reason: 'policy.validate=on' };
  }

  // auto: decide based on module intent.
  const tier: ModuleTier = (module.tier as ModuleTier | undefined) ?? 'decision';
  const strictness: SchemaStrictness = (module.schemaStrictness as SchemaStrictness | undefined) ?? 'medium';

  // Certified flows already set policy.validate=on in resolveExecutionPolicy().
  // Keep auto conservative for exec/decision.
  // For exploration: do not validate inputs by default, but still validate outputs post-hoc.
  // This preserves "5-minute path" ergonomics while keeping envelopes structurally reliable.
  if (strictness === 'high') {
    return { validateInput: true, validateOutput: true, reason: `auto: schema_strictness=high (tier=${tier})` };
  }

  if (tier === 'exploration') {
    return { validateInput: false, validateOutput: true, reason: 'auto: tier=exploration (post-hoc output only)' };
  }

  // exec + decision default to validation on.
  return { validateInput: true, validateOutput: true, reason: `auto: tier=${tier}` };
}

function getProviderCapabilities(provider: Provider): ProviderCapabilities {
  const caps = provider.getCapabilities?.();
  if (caps) return caps;
  return {
    structuredOutput: 'prompt',
    streaming: provider.supportsStreaming?.() ?? false,
  };
}

function providerSupportsNativeStructuredOutput(caps: ProviderCapabilities): boolean {
  return caps.structuredOutput === 'native';
}

function providerSupportsNativeJsonSchema(caps: ProviderCapabilities): boolean {
  if (!providerSupportsNativeStructuredOutput(caps)) return false;
  const dialect = caps.nativeSchemaDialect ?? 'json-schema';
  return dialect === 'json-schema';
}

function schemaByteLength(schema: object): number {
  try {
    return Buffer.byteLength(JSON.stringify(schema), 'utf8');
  } catch {
    // If something is non-serializable, treat as huge and disable native.
    return Number.MAX_SAFE_INTEGER;
  }
}

function resolveJsonSchemaParams(
  module: CognitiveModule,
  provider: Provider,
  validateOutput: boolean,
  structured: StructuredOutputPreference | undefined
): { jsonSchema?: object; jsonSchemaMode?: JsonSchemaMode; allowSchemaFallback?: boolean; policy?: { requested: StructuredOutputPreference; resolved: StructuredOutputPreference; reason: string } } {
  if (!validateOutput) return {};
  if (!module.outputSchema) return {};

  const pref: StructuredOutputPreference = structured ?? 'auto';
  if (pref === 'off') return { policy: { requested: pref, resolved: 'off', reason: 'structured=off' } };

  if (pref === 'prompt') {
    return { jsonSchema: module.outputSchema, jsonSchemaMode: 'prompt', allowSchemaFallback: false, policy: { requested: pref, resolved: 'prompt', reason: 'structured=prompt' } };
  }

  const caps = getProviderCapabilities(provider);
  if (caps.structuredOutput === 'none') return {};

  if (pref === 'native') {
    // "native" means "prefer native", not "fail hard".
    // If the provider doesn't support native structured output at all, safely downgrade to prompt guidance.
    // If the provider uses a non-JSON-schema dialect (e.g. Gemini responseSchema), still attempt native,
    // but allow a retry in prompt mode on compatibility errors.
    if (!providerSupportsNativeStructuredOutput(caps)) {
      const dialect = caps.nativeSchemaDialect ?? 'unknown';
      return {
        jsonSchema: module.outputSchema,
        jsonSchemaMode: 'prompt',
        allowSchemaFallback: false,
        policy: {
          requested: pref,
          resolved: 'prompt',
          reason:
            `provider lacks native structured output (${caps.structuredOutput}); dialect=${dialect}`,
        },
      };
    }
    const maxBytes = caps.maxNativeSchemaBytes;
    if (typeof maxBytes === 'number' && maxBytes > 0) {
      const bytes = schemaByteLength(module.outputSchema);
      if (bytes > maxBytes) {
        return {
          jsonSchema: module.outputSchema,
          jsonSchemaMode: 'prompt',
          allowSchemaFallback: false,
          policy: { requested: pref, resolved: 'prompt', reason: `native schema too large (${bytes}B > ${maxBytes}B)` },
        };
      }
    }

    // Some providers accept only a restricted schema subset and can reject otherwise-valid JSON Schema.
    // Retrying once in prompt mode yields a much better UX while still keeping the initial attempt "native".
    const dialect = caps.nativeSchemaDialect ?? 'json-schema';
    return {
      jsonSchema: module.outputSchema,
      jsonSchemaMode: 'native',
      allowSchemaFallback: true,
      policy: {
        requested: pref,
        resolved: 'native',
        reason: dialect === 'json-schema' ? 'structured=native' : `structured=native (dialect=${dialect}; may downgrade)`,
      },
    };
  }

  // auto: choose based on provider capabilities.
  let jsonSchemaMode: JsonSchemaMode = providerSupportsNativeJsonSchema(caps) ? 'native' : 'prompt';
  let sizeReason: string | null = null;
  if (jsonSchemaMode === 'native') {
    const maxBytes = caps.maxNativeSchemaBytes;
    if (typeof maxBytes === 'number' && maxBytes > 0) {
      const bytes = schemaByteLength(module.outputSchema);
      if (bytes > maxBytes) {
        jsonSchemaMode = 'prompt';
        sizeReason = `native schema too large (${bytes}B > ${maxBytes}B)`;
      }
    }
  }
  return {
    jsonSchema: module.outputSchema,
    jsonSchemaMode,
    allowSchemaFallback: true,
    policy: {
      requested: pref,
      resolved: jsonSchemaMode,
      reason: sizeReason
        ? `auto: ${sizeReason}`
        : providerSupportsNativeJsonSchema(caps)
          ? `auto: native JSON Schema supported`
        : caps.structuredOutput === 'native'
          ? `auto: native schema dialect is not JSON Schema (${caps.nativeSchemaDialect ?? 'unknown'})`
          : `auto: provider structuredOutput=${caps.structuredOutput}`,
    },
  };
}

function isSchemaCompatibilityError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return (
    msg.includes('responseSchema') ||
    msg.includes('response_schema') ||
    msg.includes('Invalid JSON payload') ||
    msg.includes('INVALID_ARGUMENT') ||
    msg.includes('Unknown name') ||
    msg.includes('should be non-empty for OBJECT type')
  );
}

function resolveStructuredSchemaPlan(
  module: CognitiveModule,
  provider: Provider,
  validateOutput: boolean,
  structuredPref: StructuredOutputPreference | undefined,
  policy: ExecutionPolicy | undefined
): {
  jsonSchema?: object;
  jsonSchemaMode?: JsonSchemaMode;
  allowSchemaFallback?: boolean;
  policy?: { requested: StructuredOutputPreference; resolved: StructuredOutputPreference; reason: string };
} {
  // If output validation is disabled, never pass schema hints to providers.
  if (!validateOutput) return {};
  if (!module.outputSchema) return {};

  const requested: StructuredOutputPreference = structuredPref ?? 'auto';

  // Progressive Complexity trigger:
  // When validate is `auto` and tier=exploration, default to "post-hoc validation only":
  // do not enforce/guide with schemas at the provider layer unless the user explicitly opts in.
  const tier: ModuleTier = (module.tier as ModuleTier | undefined) ?? 'decision';
  const strictness: SchemaStrictness = (module.schemaStrictness as SchemaStrictness | undefined) ?? 'medium';
  if (requested === 'auto' && policy?.validate === 'auto' && tier === 'exploration' && strictness !== 'high') {
    return {
      policy: {
        requested,
        resolved: 'off',
        reason: 'auto: tier=exploration defaults to post-hoc validation (no provider schema hints)',
      },
    };
  }

  return resolveJsonSchemaParams(module, provider, validateOutput, requested);
}

// =============================================================================
// Main Runner
// =============================================================================

export async function runModule(
  module: CognitiveModule,
  provider: Provider,
  options: RunOptions = {}
): Promise<ModuleResult> {
  const {
    args,
    input,
    verbose = false,
    validateInput: validateInputOpt,
    validateOutput: validateOutputOpt,
    useEnvelope,
    useV22,
    enableRepair: enableRepairOpt,
    traceId,
    model: modelOverride,
    policy,
    structured: structuredOverride,
  } = options;
  const { validateInput, validateOutput, reason: validateReason } = resolveValidationFlags(
    module,
    policy,
    validateInputOpt,
    validateOutputOpt
  );
  const enableRepair = enableRepairOpt ?? policy?.enableRepair ?? true;
  const startTime = Date.now();

  const gate = await enforcePolicyGates(module, policy);
  if (gate) {
    const msg =
      gate.ok === false && 'error' in gate && (gate as any).error?.message
        ? String((gate as any).error.message)
        : 'Refused by execution policy';
    _invokeErrorHooks(module.name, new Error(msg), null);
    return gate as ModuleResult;
  }

  // Determine if we should use envelope format
  const shouldUseEnvelope = useEnvelope ?? (module.output?.envelope === true || module.format === 'v2');
  
  // Determine if we should use v2.2 format
  const isV22Module = module.tier !== undefined || module.formatVersion === 'v2.2';
  const shouldUseV22 = useV22 ?? (isV22Module || module.compat?.runtime_auto_wrap === true);
  
  // Get risk_rule from module config
  const riskRule: RiskRule = module.metaConfig?.risk_rule ?? 'max_changes_risk';

  // Build clean input data (v2 style: no $ARGUMENTS pollution)
  const inputData: ModuleInput = input || {};
  
  // Map legacy --args to clean input
  if (args && !inputData.code && !inputData.query) {
    // Determine if args looks like code or natural language
    if (looksLikeCode(args)) {
      inputData.code = args;
    } else {
      inputData.query = args;
    }
  }

  // Single-file core modules promise "missing fields are empty".
  // Ensure common placeholders like `${query}` / `${code}` don't leak into prompts.
  if (typeof module.location === 'string' && /\.(md|markdown)$/i.test(module.location)) {
    if (inputData.query === undefined) inputData.query = '';
    if (inputData.code === undefined) inputData.code = '';
  }

  // Invoke before hooks
  _invokeBeforeHooks(module.name, inputData, module);

  // Validate input against schema
  if (validateInput && module.inputSchema && Object.keys(module.inputSchema).length > 0) {
    const inputErrors = validateData(inputData, module.inputSchema, 'Input');
    if (inputErrors.length > 0) {
      const errorResult = makeErrorResponse({
        code: 'E1001', // INVALID_INPUT
        message: inputErrors.join('; '),
        explain: 'Input validation failed.',
        confidence: 1.0,
        risk: 'none',
        details: { validation_errors: inputErrors },
        suggestion: 'Check input against the module schema and fix validation errors.',
      });
      _invokeErrorHooks(module.name, new Error(inputErrors.join('; ')), null);
      return errorResult as ModuleResult;
    }
  }

  // Build prompt with clean substitution
  const prompt = buildPrompt(module, inputData);

  const effectiveStructuredPref: StructuredOutputPreference | undefined = structuredOverride ?? policy?.structured;
  const structuredPlan = resolveStructuredSchemaPlan(
    module,
    provider,
    validateOutput,
    effectiveStructuredPref,
    policy
  );

  if (verbose) {
    console.error('--- Module ---');
    console.error(`Name: ${module.name} (${module.format})`);
    console.error(`Responsibility: ${module.responsibility}`);
    console.error(`Envelope: ${shouldUseEnvelope}`);
    if (policy) {
      console.error('--- Policy ---');
      const requested = effectiveStructuredPref ?? 'auto';
      const applied = structuredPlan.jsonSchemaMode ?? 'off';
      const sReason =
        structuredPlan.policy?.reason ??
        (structuredPlan.jsonSchemaMode ? 'auto: schema hints enabled' : 'auto: schema hints disabled');
      console.error(
        formatPolicySummaryLine(
          policy,
          { validateInput, validateOutput, reason: validateReason },
          { requested, applied, reason: sReason },
          { enableRepair, requireV22: policy.requireV22 }
        )
      );
      console.error(
        JSON.stringify(
          {
            profile: policy.profile,
            validate: policy.validate,
            validateInput,
            validateOutput,
            validate_reason: validateReason,
            audit: policy.audit,
            enableRepair,
            structured: requested,
            structured_effective: applied,
            structured_reason: structuredPlan.policy?.reason ?? null,
            requireV22: policy.requireV22,
          },
          null,
          2
        )
      );
    }
    console.error('--- Input ---');
    console.error(JSON.stringify(inputData, null, 2));
    console.error('--- Prompt ---');
    console.error(prompt);
    console.error('--- End ---');
  }

  // Build system message based on module config
  const systemParts: string[] = [
    `You are executing the "${module.name}" Cognitive Module.`,
    '',
    `RESPONSIBILITY: ${module.responsibility}`,
  ];

  if (module.excludes.length > 0) {
    systemParts.push('', 'YOU MUST NOT:');
    module.excludes.forEach(e => systemParts.push(`- ${e}`));
  }

  if (module.constraints) {
    systemParts.push('', 'CONSTRAINTS:');
    if (module.constraints.no_network) systemParts.push('- No network access');
    if (module.constraints.no_side_effects) systemParts.push('- No side effects');
    if (module.constraints.no_file_write) systemParts.push('- No file writes');
    if (module.constraints.no_inventing_data) systemParts.push('- Do not invent data');
  }

  if (module.output?.require_behavior_equivalence) {
    systemParts.push('', 'BEHAVIOR EQUIVALENCE:');
    systemParts.push('- You MUST set behavior_equivalence=true ONLY if the output is functionally identical');
    systemParts.push('- If unsure, set behavior_equivalence=false and explain in rationale');
    
    const maxConfidence = module.constraints?.behavior_equivalence_false_max_confidence ?? 0.7;
    systemParts.push(`- If behavior_equivalence=false, confidence MUST be <= ${maxConfidence}`);
  }

  // Add envelope format instructions
  if (shouldUseEnvelope) {
    if (shouldUseV22) {
      systemParts.push('', 'RESPONSE FORMAT (Envelope v2.2):');
      systemParts.push('- Wrap your response in the v2.2 envelope format with separate meta and data');
      systemParts.push('- Success: { "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "short summary" }, "data": { ...payload... } }');
      systemParts.push('- Error: { "ok": false, "meta": { "confidence": 0.0, "risk": "high", "explain": "error summary" }, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- meta.explain must be ≤280 characters. data.rationale can be longer for detailed reasoning.');
      systemParts.push('- meta.risk must be one of: "none", "low", "medium", "high"');
    } else {
      systemParts.push('', 'RESPONSE FORMAT (Envelope):');
      systemParts.push('- Wrap your response in the envelope format');
      systemParts.push('- Success: { "ok": true, "data": { ...your output... } }');
      systemParts.push('- Error: { "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- Include "confidence" (0-1) and "rationale" in data');
    }
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) in data');
    }
  } else {
    systemParts.push('', 'OUTPUT FORMAT:');
    systemParts.push('- Respond with ONLY valid JSON');
    systemParts.push('- Include "confidence" (0-1) and "rationale" fields');
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) field');
    }
  }

  const messages: Message[] = [
    { role: 'system', content: systemParts.join('\n') },
    { role: 'user', content: prompt },
  ];

  try {
    // Invoke provider
    const { allowSchemaFallback, policy: structuredPolicy, ...invokeSchemaParams } = structuredPlan;
    const invokeParams: Record<string, unknown> = { ...invokeSchemaParams };
    let result: InvokeResult;
    try {
      result = await provider.invoke({
        messages,
        // Progressive Complexity: only enforce schema at the provider layer when validation is enabled.
        ...invokeParams,
        temperature: 0.3,
      });
    } catch (e) {
      // If the provider rejects native structured output schemas, retry once in prompt mode.
      if (
        allowSchemaFallback &&
        invokeParams.jsonSchema &&
        invokeParams.jsonSchemaMode === 'native' &&
        isSchemaCompatibilityError(e)
      ) {
        invokeParams.jsonSchemaMode = 'prompt';
        result = await provider.invoke({
          messages,
          ...invokeParams,
          temperature: 0.3,
        });
      } else {
        throw e;
      }
    }

    if (verbose) {
      console.error('--- Response ---');
      console.error(result.content);
      console.error('--- End Response ---');
    }

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Parse response
    let parsed: unknown;
    let parseExtracted: JsonExtractResult | null = null;
    let parseAttempts: JsonParseAttempt[] = [];
    let parseRetries = 0;
    try {
      const r = parseJsonWithCandidates(result.content);
      parsed = r.parsed;
      parseExtracted = r.extracted;
      parseAttempts = r.attempts;
    } catch (e) {
      const allowParseRetry = policy?.profile !== 'certified';
      const firstDetails = (e as any)?.details;
      if (firstDetails && typeof firstDetails === 'object' && Array.isArray((firstDetails as any).parse_attempts)) {
        parseAttempts = (firstDetails as any).parse_attempts as JsonParseAttempt[];
      }

      if (!allowParseRetry) {
        const details =
          typeof firstDetails === 'object' && firstDetails
            ? firstDetails
            : { raw_response_snippet: safeSnippet(result.content, 500) };
        const errorResult = makeErrorResponse({
          code: 'E1000', // PARSE_ERROR
          message: `Failed to parse JSON response: ${(e as Error).message}`,
          explain: 'Failed to parse LLM response as JSON.',
          details: {
            ...(details as any),
            parse_retry: { attempted: false, reason: 'profile=certified (fail-fast)' },
          },
          suggestion: 'The LLM response was not valid JSON. Fix the module/provider output or switch provider.',
        });
        _invokeErrorHooks(module.name, e as Error, null);
        return errorResult as ModuleResult;
      }

      // Retry once with stronger formatting instructions (prompt-only enforcement).
      parseRetries = 1;
      const retryMessages: Message[] = [
        ...messages,
        {
          role: 'user',
          content:
            'Your previous response was not valid JSON.\n\nReturn ONLY a single valid JSON value (no markdown, no code fences, no commentary, no trailing text).',
        },
      ];
      try {
        const retryResult = await provider.invoke({
          messages: retryMessages,
          ...invokeParams,
          temperature: 0.3,
        });
        if (verbose) {
          console.error('--- Response (retry) ---');
          console.error(retryResult.content);
          console.error('--- End Response (retry) ---');
        }
        const r2 = parseJsonWithCandidates(retryResult.content);
        parsed = r2.parsed;
        parseExtracted = r2.extracted;
        parseAttempts = [...parseAttempts, ...r2.attempts];
      } catch (e2) {
        const combinedAttempts = [
          ...parseAttempts,
          ...((typeof (e2 as any)?.details === 'object' && (e2 as any)?.details && Array.isArray((e2 as any).details.parse_attempts))
            ? ((e2 as any).details.parse_attempts as JsonParseAttempt[])
            : []),
        ];
        const details =
          typeof (e2 as any)?.details === 'object' && (e2 as any)?.details
            ? (e2 as any).details
            : { raw_response_snippet: safeSnippet(result.content, 500) };
        const errorResult = makeErrorResponse({
          code: 'E1000', // PARSE_ERROR
          message: `Failed to parse JSON response: ${(e2 as Error).message}`,
          explain: 'Failed to parse LLM response as JSON.',
          details: {
            ...details,
            parse_attempts: combinedAttempts.length ? combinedAttempts : undefined,
            parse_retry: { attempted: true, count: 1 },
          },
          suggestion: 'The LLM response was not valid JSON. Try again or adjust the prompt.',
        });
        _invokeErrorHooks(module.name, e2 as Error, null);
        return errorResult as ModuleResult;
      }
    }

    // Convert to v2.2 envelope
    let response: EnvelopeResponseV22<unknown>;
    if (isV22Envelope(parsed as EnvelopeResponse<unknown>)) {
      response = parsed as EnvelopeResponseV22<unknown>;
    } else if (isEnvelopeResponse(parsed)) {
      response = wrapV21ToV22(parsed as EnvelopeResponse<unknown>, riskRule);
    } else {
      response = convertLegacyToEnvelope(parsed);
    }

    // Add version and meta fields
    response.version = ENVELOPE_VERSION;
    if (response.meta) {
      response.meta.latency_ms = latencyMs;
      if (structuredPolicy) {
        // Publish-grade parity: record how structured output was applied for this run.
        // This is intentionally small and stable, so users can reason about provider differences.
        (response.meta as any).policy = {
          ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
          structured: structuredPolicy,
        };
      }
      if (policy) {
        (response.meta as any).policy = {
          ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
          validation: {
            mode: policy.validate,
            input: validateInput,
            output: validateOutput,
            reason: validateReason,
          },
          audit: { enabled: policy.audit === true },
          repair: { enabled: enableRepair === true },
        };
      }
      // Record parse strategy and retry count for publish-grade diagnostics.
      const includeParseAttempts = verbose || policy?.profile !== 'core';
      (response.meta as any).policy = {
        ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
        parse: {
          strategy: parseExtracted?.strategy ?? null,
          retries: parseRetries,
          attempts: includeParseAttempts && parseAttempts.length ? parseAttempts : undefined,
        },
      };
      if (traceId) {
        response.meta.trace_id = traceId;
      }
      if (modelOverride) {
        response.meta.model = modelOverride;
      }
    }

    // Validate and potentially repair output
    if (response.ok && validateOutput) {
      // Get data schema (support both "data" and "output" aliases)
      const dataSchema = module.dataSchema || module.outputSchema;
      const metaSchema = module.metaSchema;
      const dataToValidate = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
      
      if (dataSchema && Object.keys(dataSchema).length > 0) {
        let dataErrors = validateData(dataToValidate, dataSchema, 'Data');
        
        if (dataErrors.length > 0 && enableRepair) {
          // Attempt repair pass
          response = repairEnvelope(
            response as unknown as Record<string, unknown>,
            riskRule
          );
          response.version = ENVELOPE_VERSION;
          
          // Re-validate after repair
          const repairedData = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
          dataErrors = validateData(repairedData, dataSchema, 'Data');
        }
        
        if (dataErrors.length > 0) {
          const errorResult = makeErrorResponse({
            code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
            message: dataErrors.join('; '),
            explain: 'Schema validation failed after repair attempt.',
            partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
            details: { validation_errors: dataErrors },
          });
          _invokeErrorHooks(module.name, new Error(dataErrors.join('; ')), (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data);
          return errorResult as ModuleResult;
        }
      }
      
      // v2.2: Validate overflow limits
      const overflowErrors = validateOverflowLimits(dataToValidate as Record<string, unknown>, module);
      if (overflowErrors.length > 0) {
        const errorResult = makeErrorResponse({
          code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
          message: overflowErrors.join('; '),
          explain: 'Overflow validation failed.',
          partialData: dataToValidate,
          details: { overflow_errors: overflowErrors },
        });
        _invokeErrorHooks(module.name, new Error(overflowErrors.join('; ')), dataToValidate);
        return errorResult as ModuleResult;
      }
      
      // v2.2: Validate enum strategy
      const enumErrors = validateEnumStrategy(dataToValidate as Record<string, unknown>, module);
      if (enumErrors.length > 0) {
        const errorResult = makeErrorResponse({
          code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
          message: enumErrors.join('; '),
          explain: 'Enum strategy validation failed.',
          partialData: dataToValidate,
          details: { enum_errors: enumErrors },
        });
        _invokeErrorHooks(module.name, new Error(enumErrors.join('; ')), dataToValidate);
        return errorResult as ModuleResult;
      }
      
      // Validate meta if schema exists
      if (metaSchema && Object.keys(metaSchema).length > 0) {
        let metaErrors = validateData(response.meta ?? {}, metaSchema, 'Meta');
        
        if (metaErrors.length > 0 && enableRepair) {
          response = repairEnvelope(
            response as unknown as Record<string, unknown>,
            riskRule
          );
          response.version = ENVELOPE_VERSION;
          
          // Re-validate meta after repair
          metaErrors = validateData(response.meta ?? {}, metaSchema, 'Meta');
          
          if (metaErrors.length > 0) {
            const errorResult = makeErrorResponse({
              code: 'E3001', // META_VALIDATION_FAILED (maps to OUTPUT_SCHEMA_VIOLATION)
              message: metaErrors.join('; '),
              explain: 'Meta schema validation failed after repair attempt.',
              partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
              details: { validation_errors: metaErrors },
            });
            _invokeErrorHooks(module.name, new Error(metaErrors.join('; ')), (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data);
            return errorResult as ModuleResult;
          }
        }
      }
    } else if (enableRepair) {
      // Repair error envelopes to ensure they have proper meta fields
      response = repairErrorEnvelope(response as unknown as Record<string, unknown>);
      response.version = ENVELOPE_VERSION;
    }

    // Invoke after hooks
    const finalLatencyMs = Date.now() - startTime;
    _invokeAfterHooks(module.name, response, finalLatencyMs);

    return response as ModuleResult;

  } catch (e) {
    const latencyMs = Date.now() - startTime;
    const errorResult = makeErrorResponse({
      code: 'E4000', // INTERNAL_ERROR
      message: (e as Error).message,
      explain: `Unexpected error: ${(e as Error).name}`,
      details: { exception_type: (e as Error).name },
    });
    if (errorResult.meta) {
      errorResult.meta.latency_ms = latencyMs;
    }
    _invokeErrorHooks(module.name, e as Error, null);
    return errorResult as ModuleResult;
  }
}

// =============================================================================
// Streaming Support
// =============================================================================

/** Event types emitted during streaming execution */
export type StreamEventType = 'start' | 'delta' | 'meta' | 'end' | 'error';

/** Event emitted during streaming execution */
export interface StreamEvent {
  type: StreamEventType;
  version: string;
  timestamp_ms: number;
  module: string;
  provider?: string;
  delta?: string;
  meta?: EnvelopeMeta;
  result?: EnvelopeResponseV22<unknown>;
  error?: { code: string; message: string };
}

export interface StreamOptions {
  input?: ModuleInput;
  args?: string;
  validateInput?: boolean;
  validateOutput?: boolean;
  useV22?: boolean;
  enableRepair?: boolean;
  traceId?: string;
  model?: string;  // Model identifier for meta.model
  policy?: ExecutionPolicy;
  /**
   * Structured output preference override (CLI/tests).
   * If omitted, uses policy.structured (or auto).
   */
  structured?: StructuredOutputPreference;
}

/**
 * Run a cognitive module with streaming output.
 * 
 * Yields StreamEvent objects as the module executes:
 * - type="start": Module execution started
 * - type="delta": Incremental output delta (provider streaming chunk)
 * - type="meta": Meta information available early
 * - type="end": Final result envelope (always emitted)
 * - type="error": Error occurred
 * 
 * @example
 * for await (const event of runModuleStream(module, provider, options)) {
 *   if (event.type === 'chunk') {
 *     process.stdout.write(event.chunk);
 *   } else if (event.type === 'complete') {
 *     console.log('Result:', event.result);
 *   }
 * }
 */
export async function* runModuleStream(
  module: CognitiveModule,
  provider: Provider,
  options: StreamOptions = {}
): AsyncGenerator<StreamEvent> {
  const {
    input,
    args,
    validateInput: validateInputOpt,
    validateOutput: validateOutputOpt,
    useV22 = true,
    enableRepair: enableRepairOpt,
    traceId,
    model,
    policy,
    structured: structuredOverride,
  } = options;
  const { validateInput, validateOutput, reason: validateReason } = resolveValidationFlags(
    module,
    policy,
    validateInputOpt,
    validateOutputOpt
  );
  const enableRepair = enableRepairOpt ?? policy?.enableRepair ?? true;
  const startTime = Date.now();
  const moduleName = module.name;
  const providerName = provider?.name;

  function makeEvent(type: StreamEventType, extra: Partial<StreamEvent> = {}): StreamEvent {
    return {
      type,
      version: ENVELOPE_VERSION,
      timestamp_ms: Date.now() - startTime,
      module: moduleName,
      ...(providerName ? { provider: providerName } : {}),
      ...extra,
    };
  }

  try {
    // Emit start event
    yield makeEvent('start');

    const gate = await enforcePolicyGates(module, policy);
    if (gate) {
      const errorObj = (gate as any)?.error ?? { code: 'E4007', message: 'Refused by execution policy' };
      yield makeEvent('error', { error: { code: errorObj.code, message: errorObj.message } });
      yield makeEvent('end', { result: gate });
      return;
    }

    // Build input data
    const inputData: ModuleInput = input || {};
    if (args && !inputData.code && !inputData.query) {
      if (looksLikeCode(args)) {
        inputData.code = args;
      } else {
        inputData.query = args;
      }
    }

    // Single-file core modules promise "missing fields are empty".
    if (typeof module.location === 'string' && /\.(md|markdown)$/i.test(module.location)) {
      if (inputData.query === undefined) inputData.query = '';
      if (inputData.code === undefined) inputData.code = '';
    }

    _invokeBeforeHooks(module.name, inputData, module);

    // Validate input if enabled
    if (validateInput && module.inputSchema && Object.keys(module.inputSchema).length > 0) {
      const inputErrors = validateData(inputData, module.inputSchema, 'Input');
      if (inputErrors.length > 0) {
        const errorResult = makeErrorResponse({
          code: 'E1001', // INVALID_INPUT
          message: inputErrors.join('; '),
          confidence: 1.0,
          risk: 'none',
          suggestion: 'Check input against the module schema and fix validation errors.',
        });
        _invokeErrorHooks(module.name, new Error(inputErrors.join('; ')), null);
        const errorObj = (errorResult as { error: { code: string; message: string } }).error;
        yield makeEvent('error', { error: errorObj });
        yield makeEvent('end', { result: errorResult });
        return;
      }
    }

    // Get risk_rule from module config
    const riskRule: RiskRule = module.metaConfig?.risk_rule ?? 'max_changes_risk';

    // Build prompt
    const prompt = buildPrompt(module, inputData);
    const effectiveStructuredPref: StructuredOutputPreference | undefined = structuredOverride ?? policy?.structured;
    const structuredPlan = resolveStructuredSchemaPlan(
      module,
      provider,
      validateOutput,
      effectiveStructuredPref,
      policy
    );

    // Build messages
    const systemParts: string[] = [
      `You are executing the "${module.name}" Cognitive Module.`,
      '',
      `RESPONSIBILITY: ${module.responsibility}`,
    ];

    if (useV22) {
      systemParts.push('', 'RESPONSE FORMAT (Envelope v2.2):');
      systemParts.push('- Wrap your response in the v2.2 envelope format');
      systemParts.push('- Success: { "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "short summary" }, "data": { ...payload... } }');
      systemParts.push('- Return ONLY valid JSON.');
    }

    const messages: Message[] = [
      { role: 'system', content: systemParts.join('\n') },
      { role: 'user', content: prompt },
    ];

    // Invoke provider with streaming if supported
    let fullContent: string;
    const { allowSchemaFallback, policy: structuredPolicy, ...invokeSchemaParams } = structuredPlan;
    const invokeParams: Record<string, unknown> = { ...invokeSchemaParams };
    
    if (provider.supportsStreaming?.() && provider.invokeStream) {
      // Use true streaming
      const stream = provider.invokeStream({
        messages,
        ...invokeParams,
        temperature: 0.3,
      });
      
      // Iterate through the async generator, yielding chunks as they arrive
      let streamResult: IteratorResult<string, InvokeResult>;
      try {
        while (!(streamResult = await stream.next()).done) {
          const chunk = streamResult.value;
          yield makeEvent('delta', { delta: chunk });
        }

        // Get the final result (returned from the generator)
        fullContent = streamResult.value.content;
      } catch (e) {
        // If streaming fails (e.g., schema rejected), retry once non-streaming in prompt mode.
        if (
          allowSchemaFallback &&
          invokeParams.jsonSchema &&
          invokeParams.jsonSchemaMode === 'native' &&
          isSchemaCompatibilityError(e)
        ) {
          invokeParams.jsonSchemaMode = 'prompt';
          const result = await provider.invoke({
            messages,
            ...invokeParams,
            temperature: 0.3,
          });
          fullContent = result.content;
          yield makeEvent('delta', { delta: result.content });
        } else {
          throw e;
        }
      }
    } else {
      // Fallback to non-streaming invoke
      let result: InvokeResult;
      try {
        result = await provider.invoke({
          messages,
          ...invokeParams,
          temperature: 0.3,
        });
      } catch (e) {
        if (
          allowSchemaFallback &&
          invokeParams.jsonSchema &&
          invokeParams.jsonSchemaMode === 'native' &&
          isSchemaCompatibilityError(e)
        ) {
          invokeParams.jsonSchemaMode = 'prompt';
          result = await provider.invoke({
            messages,
            ...invokeParams,
            temperature: 0.3,
          });
        } else {
          throw e;
        }
      }
      fullContent = result.content;
      
      // Emit chunk event with full response
      yield makeEvent('delta', { delta: result.content });
    }

    // Parse response
    let parsed: unknown;
    let parseExtracted: JsonExtractResult | null = null;
    let parseAttempts: JsonParseAttempt[] = [];
    let parseRetries = 0;
    try {
      const r = parseJsonWithCandidates(fullContent);
      parsed = r.parsed;
      parseExtracted = r.extracted;
      parseAttempts = r.attempts;
    } catch (e) {
      const firstDetails = (e as any)?.details;
      if (firstDetails && typeof firstDetails === 'object' && Array.isArray((firstDetails as any).parse_attempts)) {
        parseAttempts = (firstDetails as any).parse_attempts as JsonParseAttempt[];
      }

      const allowParseRetry = policy?.profile !== 'certified';
      if (!allowParseRetry) {
        const details =
          typeof firstDetails === 'object' && firstDetails
            ? firstDetails
            : { raw_response_snippet: safeSnippet(fullContent, 500) };
        const errorResult = makeErrorResponse({
          code: 'E1000', // PARSE_ERROR
          message: `Failed to parse JSON: ${(e as Error).message}`,
          details: {
            ...(details as any),
            parse_retry: { attempted: false, reason: 'profile=certified (fail-fast)' },
          },
          suggestion: 'The LLM response was not valid JSON. Fix the module/provider output or switch provider.',
        });
        _invokeErrorHooks(module.name, e as Error, null);
        const errorObj = (errorResult as { error: { code: string; message: string } }).error;
        yield makeEvent('error', { error: errorObj });
        yield makeEvent('end', { result: errorResult });
        return;
      }

      // Retry once (non-streaming) with stronger JSON-only instructions.
      parseRetries = 1;
      const retryMessages: Message[] = [
        ...messages,
        {
          role: 'user',
          content:
            'Your previous response was not valid JSON.\n\nReturn ONLY a single valid JSON value (no markdown, no code fences, no commentary, no trailing text).',
        },
      ];
      try {
        const retryResult = await provider.invoke({
          messages: retryMessages,
          ...invokeParams,
          temperature: 0.3,
        });
        fullContent = retryResult.content; // do not emit delta for retry; clients should rely on final envelope
        const r2 = parseJsonWithCandidates(fullContent);
        parsed = r2.parsed;
        parseExtracted = r2.extracted;
        parseAttempts = [...parseAttempts, ...r2.attempts];
      } catch (e2) {
        const combinedAttempts = [
          ...parseAttempts,
          ...((typeof (e2 as any)?.details === 'object' &&
          (e2 as any)?.details &&
          Array.isArray((e2 as any).details.parse_attempts))
            ? ((e2 as any).details.parse_attempts as JsonParseAttempt[])
            : []),
        ];
        const details =
          typeof (e2 as any)?.details === 'object' && (e2 as any)?.details
            ? (e2 as any).details
            : { raw_response_snippet: safeSnippet(fullContent, 500) };
        const errorResult = makeErrorResponse({
          code: 'E1000', // PARSE_ERROR
          message: `Failed to parse JSON: ${(e2 as Error).message}`,
          details: {
            ...details,
            parse_attempts: combinedAttempts.length ? combinedAttempts : undefined,
            parse_retry: { attempted: true, count: 1 },
          },
          suggestion: 'The LLM response was not valid JSON. Try again or adjust the prompt.',
        });
        _invokeErrorHooks(module.name, e2 as Error, null);
        // errorResult is always an error response from makeErrorResponse
        const errorObj = (errorResult as { error: { code: string; message: string } }).error;
        yield makeEvent('error', { error: errorObj });
        yield makeEvent('end', { result: errorResult });
        return;
      }
    }

    // Convert to v2.2 envelope
    let response: EnvelopeResponseV22<unknown>;
    if (isV22Envelope(parsed as EnvelopeResponse<unknown>)) {
      response = parsed as EnvelopeResponseV22<unknown>;
    } else if (isEnvelopeResponse(parsed)) {
      response = wrapV21ToV22(parsed as EnvelopeResponse<unknown>, riskRule);
    } else {
      response = convertLegacyToEnvelope(parsed);
    }

    // Add version and meta
    response.version = ENVELOPE_VERSION;
    const latencyMs = Date.now() - startTime;
    if (response.meta) {
      response.meta.latency_ms = latencyMs;
      if (structuredPolicy) {
        (response.meta as any).policy = {
          ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
          structured: structuredPolicy,
        };
      }
      if (policy) {
        (response.meta as any).policy = {
          ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
          validation: {
            mode: policy.validate,
            input: validateInput,
            output: validateOutput,
            reason: validateReason,
          },
          audit: { enabled: policy.audit === true },
          repair: { enabled: enableRepair === true },
        };
      }
      const includeParseAttempts = policy?.profile !== 'core';
      (response.meta as any).policy = {
        ...(typeof (response.meta as any).policy === 'object' && (response.meta as any).policy ? (response.meta as any).policy : {}),
        parse: {
          strategy: parseExtracted?.strategy ?? null,
          retries: parseRetries,
          attempts: includeParseAttempts && parseAttempts.length ? parseAttempts : undefined,
        },
      };
      if (traceId) {
        response.meta.trace_id = traceId;
      }
      if (model) {
        response.meta.model = model;
      }
      // Emit meta event early
      yield makeEvent('meta', { meta: response.meta });
    }

    // Validate and repair output
    if (response.ok && validateOutput) {
      const dataSchema = module.dataSchema || module.outputSchema;
      const metaSchema = module.metaSchema;
      
      if (dataSchema && Object.keys(dataSchema).length > 0) {
        let dataToValidate = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
        let dataErrors = validateData(dataToValidate, dataSchema, 'Data');
        
        if (dataErrors.length > 0 && enableRepair) {
          response = repairEnvelope(response as unknown as Record<string, unknown>, riskRule);
          response.version = ENVELOPE_VERSION;
          // Re-validate after repair
          const repairedData = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
          dataToValidate = repairedData;
          dataErrors = validateData(repairedData, dataSchema, 'Data');
        }
        
        if (dataErrors.length > 0) {
          const errorResult = makeErrorResponse({
            code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
            message: dataErrors.join('; '),
            explain: 'Schema validation failed after repair attempt.',
            partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
            details: { validation_errors: dataErrors },
          });
          _invokeErrorHooks(module.name, new Error(dataErrors.join('; ')), (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data);
          const errorObj = (errorResult as { error: { code: string; message: string } }).error;
          yield makeEvent('error', { error: errorObj });
          yield makeEvent('end', { result: errorResult });
          return;
        }

        const overflowErrors = validateOverflowLimits(dataToValidate as Record<string, unknown>, module);
        if (overflowErrors.length > 0) {
          const errorResult = makeErrorResponse({
            code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
            message: overflowErrors.join('; '),
            explain: 'Overflow validation failed.',
            partialData: dataToValidate,
            details: { overflow_errors: overflowErrors },
          });
          _invokeErrorHooks(module.name, new Error(overflowErrors.join('; ')), dataToValidate);
          const errorObj = (errorResult as { error: { code: string; message: string } }).error;
          yield makeEvent('error', { error: errorObj });
          yield makeEvent('end', { result: errorResult });
          return;
        }

        const enumErrors = validateEnumStrategy(dataToValidate as Record<string, unknown>, module);
        if (enumErrors.length > 0) {
          const errorResult = makeErrorResponse({
            code: 'E3001', // OUTPUT_SCHEMA_VIOLATION
            message: enumErrors.join('; '),
            explain: 'Enum strategy validation failed.',
            partialData: dataToValidate,
            details: { enum_errors: enumErrors },
          });
          _invokeErrorHooks(module.name, new Error(enumErrors.join('; ')), dataToValidate);
          const errorObj = (errorResult as { error: { code: string; message: string } }).error;
          yield makeEvent('error', { error: errorObj });
          yield makeEvent('end', { result: errorResult });
          return;
        }
      }
      
      // Validate meta if schema exists
      if (metaSchema && Object.keys(metaSchema).length > 0) {
        let metaErrors = validateData(response.meta ?? {}, metaSchema, 'Meta');
        
        if (metaErrors.length > 0 && enableRepair) {
          response = repairEnvelope(response as unknown as Record<string, unknown>, riskRule);
          response.version = ENVELOPE_VERSION;
          metaErrors = validateData(response.meta ?? {}, metaSchema, 'Meta');
          
          if (metaErrors.length > 0) {
            const errorResult = makeErrorResponse({
              code: 'E3001', // META_VALIDATION_FAILED (maps to OUTPUT_SCHEMA_VIOLATION)
              message: metaErrors.join('; '),
              explain: 'Meta validation failed after repair attempt.',
              partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
              details: { validation_errors: metaErrors },
            });
            _invokeErrorHooks(module.name, new Error(metaErrors.join('; ')), (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data);
            const errorObj = (errorResult as { error: { code: string; message: string } }).error;
            yield makeEvent('error', { error: errorObj });
            yield makeEvent('end', { result: errorResult });
            return;
          }
        }
      }
    } else if (!response.ok && enableRepair) {
      response = repairErrorEnvelope(response as unknown as Record<string, unknown>);
      response.version = ENVELOPE_VERSION;
    }

    const finalLatencyMs = Date.now() - startTime;
    _invokeAfterHooks(module.name, response, finalLatencyMs);

    // Emit end event
    yield makeEvent('end', { result: response });

  } catch (e) {
    _invokeErrorHooks(module.name, e as Error, null);
    const errorResult = makeErrorResponse({
      code: 'E4000', // INTERNAL_ERROR
      message: (e as Error).message,
      explain: `Unexpected error: ${(e as Error).name}`,
    });
    // errorResult is always an error response from makeErrorResponse
    const errorObj = (errorResult as { error: { code: string; message: string } }).error;
    yield makeEvent('error', { error: errorObj });
    yield makeEvent('end', { result: errorResult });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if response is in envelope format
 */
function isEnvelopeResponse(obj: unknown): obj is EnvelopeResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.ok === 'boolean';
}

/**
 * Parse envelope format response (supports both v2.1 and v2.2)
 */
function parseEnvelopeResponse(response: EnvelopeResponse<unknown>, raw: string): ModuleResult {
  // Check if v2.2 format (has meta)
  if (isV22Envelope(response)) {
    if (response.ok) {
      return {
        ok: true,
        meta: response.meta,
        data: response.data as ModuleResultData,
        raw,
      } as ModuleResultV22;
    } else {
      return {
        ok: false,
        meta: response.meta,
        error: response.error,
        partial_data: response.partial_data,
        raw,
      } as ModuleResultV22;
    }
  }
  
  // v2.1 format
  if (response.ok) {
    const data = (response.data ?? {}) as ModuleResultData & { confidence?: number };
    return {
      ok: true,
      data: {
        ...data,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
        behavior_equivalence: data.behavior_equivalence,
      },
      raw,
    } as ModuleResultV21;
  } else {
    return {
      ok: false,
      error: response.error,
      partial_data: response.partial_data,
      raw,
    } as ModuleResultV21;
  }
}

/**
 * Parse legacy (non-envelope) format response
 */
function parseLegacyResponse(output: unknown, raw: string): ModuleResult {
  const isPlainObject = typeof output === 'object' && output !== null && !Array.isArray(output);
  if (!isPlainObject) {
    return {
      ok: true,
      data: {
        result: output,
        confidence: 0.5,
        rationale: '',
      },
      raw,
    } as ModuleResultV21;
  }
  
  const outputObj = output as Record<string, unknown>;
  const confidence = typeof outputObj.confidence === 'number' ? outputObj.confidence : 0.5;
  const rationale = typeof outputObj.rationale === 'string' ? outputObj.rationale : '';
  const behaviorEquivalence = typeof outputObj.behavior_equivalence === 'boolean' 
    ? outputObj.behavior_equivalence 
    : undefined;

  // Check if this is an error response (has error.code)
  if (outputObj.error && typeof outputObj.error === 'object') {
    const errorObj = outputObj.error as Record<string, unknown>;
    if (typeof errorObj.code === 'string') {
      return {
        ok: false,
        error: {
          code: errorObj.code,
          message: typeof errorObj.message === 'string' ? errorObj.message : 'Unknown error',
        },
        raw,
      };
    }
  }

  // Return as v2.1 format (data includes confidence)
  return {
    ok: true,
    data: {
      ...outputObj,
      confidence,
      rationale,
      behavior_equivalence: behaviorEquivalence,
    },
    raw,
  } as ModuleResultV21;
}

/**
 * Build prompt with clean variable substitution
 * 
 * Substitution order (important to avoid partial replacements):
 * 1. ${variable} - v2 style placeholders
 * 2. $ARGUMENTS[N] - indexed access (descending order to avoid $1 matching $10)
 * 3. $N - shorthand indexed access (descending order)
 * 4. $ARGUMENTS - full argument string (LAST to avoid partial matches)
 */
function buildPrompt(module: CognitiveModule, input: ModuleInput): string {
  let prompt = module.prompt;

  // v2 style: substitute ${variable} placeholders
  for (const [key, value] of Object.entries(input)) {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), strValue);
  }

  // v1 compatibility: get args value
  const argsValue = input.code || input.query || '';

  // Substitute $ARGUMENTS[N] and $N placeholders FIRST (v1 compatibility)
  // Process in descending order to avoid $1 replacing part of $10
  if (typeof argsValue === 'string') {
    const argsList = argsValue.split(/\s+/);
    for (let i = argsList.length - 1; i >= 0; i--) {
      const arg = argsList[i];
      // Replace $ARGUMENTS[N] first
      prompt = prompt.replace(new RegExp(`\\$ARGUMENTS\\[${i}\\]`, 'g'), arg);
      // Replace $N shorthand
      prompt = prompt.replace(new RegExp(`\\$${i}\\b`, 'g'), arg);
    }
  }

  // Replace $ARGUMENTS LAST (after indexed forms to avoid partial matches)
  prompt = prompt.replace(/\$ARGUMENTS/g, argsValue);

  // Append input summary if not already in prompt
  if (!prompt.includes(argsValue) && argsValue) {
    prompt += '\n\n## Input\n\n';
    if (input.code) {
      prompt += '```\n' + input.code + '\n```\n';
    }
    if (input.query) {
      prompt += input.query + '\n';
    }
    if (input.language) {
      prompt += `\nLanguage: ${input.language}\n`;
    }
  }

  return prompt;
}

/**
 * Heuristic to detect if input looks like code
 */
function looksLikeCode(str: string): boolean {
  const codeIndicators = [
    /^(def|function|class|const|let|var|import|export|public|private)\s/,
    /[{};()]/,
    /=>/,
    /\.(py|js|ts|go|rs|java|cpp|c|rb)$/,
  ];
  return codeIndicators.some(re => re.test(str));
}

// =============================================================================
// Legacy API (for backward compatibility)
// =============================================================================

export interface RunModuleLegacyOptions {
  validateInput?: boolean;
  validateOutput?: boolean;
  model?: string;
}

/**
 * Run a cognitive module (legacy API, returns raw output).
 * For backward compatibility. Throws on error instead of returning error envelope.
 */
export async function runModuleLegacy(
  module: CognitiveModule,
  provider: Provider,
  input: ModuleInput,
  options: RunModuleLegacyOptions = {}
): Promise<unknown> {
  const { validateInput = true, validateOutput = true, model } = options;
  
  const result = await runModule(module, provider, {
    input,
    validateInput,
    validateOutput,
    useEnvelope: false,
    useV22: false,
    model,
  });
  
  if (result.ok && 'data' in result) {
    return result.data;
  } else {
    const error = 'error' in result ? result.error : { code: 'E4000', message: 'Unknown error' }; // INTERNAL_ERROR fallback
    throw new Error(`${error?.code ?? 'UNKNOWN'}: ${error?.message ?? 'Unknown error'}`);
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Extract meta from v2.2 envelope for routing/logging.
 */
export function extractMeta(result: EnvelopeResponseV22<unknown>): EnvelopeMeta {
  return result.meta ?? {
    confidence: 0.5,
    risk: 'medium',
    explain: 'No meta available',
  };
}

// Alias for backward compatibility
export const extractMetaV22 = extractMeta;

/**
 * Determine if result should be escalated to human review based on meta.
 */
export function shouldEscalate(
  result: EnvelopeResponseV22<unknown>,
  confidenceThreshold: number = 0.7
): boolean {
  const meta = extractMeta(result);
  
  // Escalate if low confidence
  if (meta.confidence < confidenceThreshold) {
    return true;
  }
  
  // Escalate if high risk
  if (meta.risk === 'high') {
    return true;
  }
  
  // Escalate if error
  if (!result.ok) {
    return true;
  }
  
  return false;
}

// Alias for backward compatibility
export const shouldEscalateV22 = shouldEscalate;
