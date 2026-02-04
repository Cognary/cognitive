/**
 * Module Runner - Execute Cognitive Modules
 * v2.2: Envelope format with meta/data separation, risk_rule, repair pass
 * v2.2.1: Version field, enhanced error taxonomy, observability hooks, streaming
 */

import _Ajv from 'ajv';
const Ajv = _Ajv.default || _Ajv;
import type { 
  Provider, 
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
  RiskLevel,
  RiskRule
} from '../types.js';
import { aggregateRisk, isV22Envelope } from '../types.js';

// =============================================================================
// Schema Validation
// =============================================================================

const ajv = new Ajv({ allErrors: true, strict: false });

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
        
        // Check if this is a custom enum object
        if ('custom' in record && 'reason' in record && Object.keys(record).length === 2) {
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

/** Error codes and their default properties */
export const ERROR_PROPERTIES: Record<string, { recoverable: boolean; retry_after_ms: number | null }> = {
  MODULE_NOT_FOUND: { recoverable: false, retry_after_ms: null },
  INVALID_INPUT: { recoverable: false, retry_after_ms: null },
  PARSE_ERROR: { recoverable: true, retry_after_ms: 1000 },
  SCHEMA_VALIDATION_FAILED: { recoverable: true, retry_after_ms: 1000 },
  META_VALIDATION_FAILED: { recoverable: true, retry_after_ms: 1000 },
  POLICY_VIOLATION: { recoverable: false, retry_after_ms: null },
  TOOL_NOT_ALLOWED: { recoverable: false, retry_after_ms: null },
  LLM_ERROR: { recoverable: true, retry_after_ms: 5000 },
  RATE_LIMITED: { recoverable: true, retry_after_ms: 10000 },
  TIMEOUT: { recoverable: true, retry_after_ms: 5000 },
  UNKNOWN: { recoverable: false, retry_after_ms: null },
};

export interface MakeErrorResponseOptions {
  code: string;
  message: string;
  explain?: string;
  partialData?: unknown;
  details?: Record<string, unknown>;
  recoverable?: boolean;
  retryAfterMs?: number;
  confidence?: number;
  risk?: RiskLevel;
}

/**
 * Build a standardized error response with enhanced taxonomy.
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
  } = options;

  // Get default properties from error code
  const defaults = ERROR_PROPERTIES[code] || ERROR_PROPERTIES.UNKNOWN;

  const errorObj: {
    code: string;
    message: string;
    recoverable?: boolean;
    retry_after_ms?: number;
    details?: Record<string, unknown>;
  } = {
    code,
    message,
  };

  // Add recoverable flag
  const isRecoverable = recoverable ?? defaults.recoverable;
  if (isRecoverable !== undefined) {
    errorObj.recoverable = isRecoverable;
  }

  // Add retry suggestion
  const retryMs = retryAfterMs ?? defaults.retry_after_ms;
  if (retryMs !== null) {
    errorObj.retry_after_ms = retryMs;
  }

  // Add details if provided
  if (details) {
    errorObj.details = details;
  }

  return {
    ok: false,
    version: ENVELOPE_VERSION,
    meta: {
      confidence,
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
  // Trim whitespace only (lossless), validate is valid RiskLevel
  if (typeof meta.risk === 'string') {
    const trimmedRisk = meta.risk.trim().toLowerCase();
    const validRisks = ['none', 'low', 'medium', 'high'];
    meta.risk = validRisks.includes(trimmedRisk) ? trimmedRisk : 'medium';
  } else {
    meta.risk = 'medium'; // Default for invalid type
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
    error: (repaired.error as { code: string; message: string }) ?? { code: 'UNKNOWN', message: 'Unknown error' },
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
    error: (repaired.error as { code: string; message: string }) ?? { code: 'UNKNOWN', message: 'Unknown error' },
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
      error: response.error ?? { code: 'UNKNOWN', message: errorMsg },
      partial_data: response.partial_data
    };
  }
}

/**
 * Convert legacy format (no envelope) to v2.2 envelope.
 */
function convertLegacyToEnvelope(
  data: Record<string, unknown>,
  isError: boolean = false
): EnvelopeResponseV22<unknown> {
  if (isError || 'error' in data) {
    const error = (data.error ?? {}) as Record<string, unknown>;
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
    const confidence = (data.confidence as number) ?? 0.5;
    const rationale = (data.rationale as string) ?? '';
    
    return {
      ok: true,
      version: ENVELOPE_VERSION,
      meta: {
        confidence,
        risk: aggregateRisk(data),
        explain: rationale.slice(0, 280) || 'No explanation provided',
      },
      data,
    };
  }
}

// =============================================================================
// Main Runner
// =============================================================================

export async function runModule(
  module: CognitiveModule,
  provider: Provider,
  options: RunOptions = {}
): Promise<ModuleResult> {
  const { args, input, verbose = false, validateInput = true, validateOutput = true, useEnvelope, useV22, enableRepair = true, traceId, model: modelOverride } = options;
  const startTime = Date.now();

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

  // Invoke before hooks
  _invokeBeforeHooks(module.name, inputData, module);

  // Validate input against schema
  if (validateInput && module.inputSchema && Object.keys(module.inputSchema).length > 0) {
    const inputErrors = validateData(inputData, module.inputSchema, 'Input');
    if (inputErrors.length > 0) {
      const errorResult = makeErrorResponse({
        code: 'INVALID_INPUT',
        message: inputErrors.join('; '),
        explain: 'Input validation failed.',
        confidence: 1.0,
        risk: 'none',
        details: { validation_errors: inputErrors },
      });
      _invokeErrorHooks(module.name, new Error(inputErrors.join('; ')), null);
      return errorResult as ModuleResult;
    }
  }

  // Build prompt with clean substitution
  const prompt = buildPrompt(module, inputData);

  if (verbose) {
    console.error('--- Module ---');
    console.error(`Name: ${module.name} (${module.format})`);
    console.error(`Responsibility: ${module.responsibility}`);
    console.error(`Envelope: ${shouldUseEnvelope}`);
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
    const result = await provider.invoke({
      messages,
      jsonSchema: module.outputSchema,
      temperature: 0.3,
    });

    if (verbose) {
      console.error('--- Response ---');
      console.error(result.content);
      console.error('--- End Response ---');
    }

    // Calculate latency
    const latencyMs = Date.now() - startTime;

    // Parse response
    let parsed: unknown;
    try {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : result.content;
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      const errorResult = makeErrorResponse({
        code: 'PARSE_ERROR',
        message: `Failed to parse JSON response: ${(e as Error).message}`,
        explain: 'Failed to parse LLM response as JSON.',
        details: { raw_response: result.content.substring(0, 500) },
      });
      _invokeErrorHooks(module.name, e as Error, null);
      return errorResult as ModuleResult;
    }

    // Convert to v2.2 envelope
    let response: EnvelopeResponseV22<unknown>;
    if (isV22Envelope(parsed as EnvelopeResponse<unknown>)) {
      response = parsed as EnvelopeResponseV22<unknown>;
    } else if (isEnvelopeResponse(parsed)) {
      response = wrapV21ToV22(parsed as EnvelopeResponse<unknown>, riskRule);
    } else {
      response = convertLegacyToEnvelope(parsed as Record<string, unknown>);
    }

    // Add version and meta fields
    response.version = ENVELOPE_VERSION;
    if (response.meta) {
      response.meta.latency_ms = latencyMs;
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
            code: 'SCHEMA_VALIDATION_FAILED',
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
          code: 'SCHEMA_VALIDATION_FAILED',
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
          code: 'SCHEMA_VALIDATION_FAILED',
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
              code: 'META_VALIDATION_FAILED',
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
      code: 'UNKNOWN',
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
export type StreamEventType = 'start' | 'chunk' | 'meta' | 'complete' | 'error';

/** Event emitted during streaming execution */
export interface StreamEvent {
  type: StreamEventType;
  timestamp_ms: number;
  module_name: string;
  chunk?: string;
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
}

/**
 * Run a cognitive module with streaming output.
 * 
 * Yields StreamEvent objects as the module executes:
 * - type="start": Module execution started
 * - type="chunk": Incremental data chunk (if LLM supports streaming)
 * - type="meta": Meta information available early
 * - type="complete": Final complete result
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
  const { input, args, validateInput = true, validateOutput = true, useV22 = true, enableRepair = true, traceId, model } = options;
  const startTime = Date.now();
  const moduleName = module.name;

  function makeEvent(type: StreamEventType, extra: Partial<StreamEvent> = {}): StreamEvent {
    return {
      type,
      timestamp_ms: Date.now() - startTime,
      module_name: moduleName,
      ...extra,
    };
  }

  try {
    // Emit start event
    yield makeEvent('start');

    // Build input data
    const inputData: ModuleInput = input || {};
    if (args && !inputData.code && !inputData.query) {
      if (looksLikeCode(args)) {
        inputData.code = args;
      } else {
        inputData.query = args;
      }
    }

    // Validate input if enabled
    if (validateInput && module.inputSchema && Object.keys(module.inputSchema).length > 0) {
      const inputErrors = validateData(inputData, module.inputSchema, 'Input');
      if (inputErrors.length > 0) {
        const errorResult = makeErrorResponse({
          code: 'INVALID_INPUT',
          message: inputErrors.join('; '),
          confidence: 1.0,
          risk: 'none',
        });
        const errorObj = (errorResult as { error: { code: string; message: string } }).error;
        yield makeEvent('error', { error: errorObj });
        yield makeEvent('complete', { result: errorResult });
        return;
      }
    }

    // Get risk_rule from module config
    const riskRule: RiskRule = module.metaConfig?.risk_rule ?? 'max_changes_risk';

    // Build prompt
    const prompt = buildPrompt(module, inputData);

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

    // Invoke provider (streaming not yet supported in provider interface, so we fallback)
    const result = await provider.invoke({
      messages,
      jsonSchema: module.outputSchema,
      temperature: 0.3,
    });

    // Emit chunk event with full response
    yield makeEvent('chunk', { chunk: result.content });

    // Parse response
    let parsed: unknown;
    try {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : result.content;
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      const errorResult = makeErrorResponse({
        code: 'PARSE_ERROR',
        message: `Failed to parse JSON: ${(e as Error).message}`,
      });
      // errorResult is always an error response from makeErrorResponse
      const errorObj = (errorResult as { error: { code: string; message: string } }).error;
      yield makeEvent('error', { error: errorObj });
      yield makeEvent('complete', { result: errorResult });
      return;
    }

    // Convert to v2.2 envelope
    let response: EnvelopeResponseV22<unknown>;
    if (isV22Envelope(parsed as EnvelopeResponse<unknown>)) {
      response = parsed as EnvelopeResponseV22<unknown>;
    } else if (isEnvelopeResponse(parsed)) {
      response = wrapV21ToV22(parsed as EnvelopeResponse<unknown>, riskRule);
    } else {
      response = convertLegacyToEnvelope(parsed as Record<string, unknown>);
    }

    // Add version and meta
    response.version = ENVELOPE_VERSION;
    const latencyMs = Date.now() - startTime;
    if (response.meta) {
      response.meta.latency_ms = latencyMs;
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
        const dataToValidate = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
        let dataErrors = validateData(dataToValidate, dataSchema, 'Data');
        
        if (dataErrors.length > 0 && enableRepair) {
          response = repairEnvelope(response as unknown as Record<string, unknown>, riskRule);
          response.version = ENVELOPE_VERSION;
          // Re-validate after repair
          const repairedData = (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data ?? {};
          dataErrors = validateData(repairedData, dataSchema, 'Data');
        }
        
        if (dataErrors.length > 0) {
          const errorResult = makeErrorResponse({
            code: 'SCHEMA_VALIDATION_FAILED',
            message: dataErrors.join('; '),
            explain: 'Schema validation failed after repair attempt.',
            partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
            details: { validation_errors: dataErrors },
          });
          const errorObj = (errorResult as { error: { code: string; message: string } }).error;
          yield makeEvent('error', { error: errorObj });
          yield makeEvent('complete', { result: errorResult });
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
              code: 'META_VALIDATION_FAILED',
              message: metaErrors.join('; '),
              explain: 'Meta validation failed after repair attempt.',
              partialData: (response as EnvelopeResponseV22<unknown> & { data?: unknown }).data,
              details: { validation_errors: metaErrors },
            });
            const errorObj = (errorResult as { error: { code: string; message: string } }).error;
            yield makeEvent('error', { error: errorObj });
            yield makeEvent('complete', { result: errorResult });
            return;
          }
        }
      }
    } else if (!response.ok && enableRepair) {
      response = repairErrorEnvelope(response as unknown as Record<string, unknown>);
      response.version = ENVELOPE_VERSION;
    }

    // Emit complete event
    yield makeEvent('complete', { result: response });

  } catch (e) {
    const errorResult = makeErrorResponse({
      code: 'UNKNOWN',
      message: (e as Error).message,
      explain: `Unexpected error: ${(e as Error).name}`,
    });
    // errorResult is always an error response from makeErrorResponse
    const errorObj = (errorResult as { error: { code: string; message: string } }).error;
    yield makeEvent('error', { error: errorObj });
    yield makeEvent('complete', { result: errorResult });
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
    const error = 'error' in result ? result.error : { code: 'UNKNOWN', message: 'Unknown error' };
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
