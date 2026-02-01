/**
 * Cognitive Runtime - Core Types
 * Version 2.2 - With Control/Data plane separation, tier, overflow, extensible enums
 */

// =============================================================================
// Provider Interface
// =============================================================================

export interface Provider {
  name: string;
  invoke(params: InvokeParams): Promise<InvokeResult>;
  isConfigured(): boolean;
}

export interface InvokeParams {
  messages: Message[];
  jsonSchema?: object;
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InvokeResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// =============================================================================
// v2.2 Core Types
// =============================================================================

/** Module classification for schema strictness */
export type ModuleTier = 'exec' | 'decision' | 'exploration';

/** Schema validation strictness level */
export type SchemaStrictness = 'high' | 'medium' | 'low';

/** Risk level (used in both meta and changes) */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/** Enum extension strategy */
export type EnumStrategy = 'strict' | 'extensible';

/** Risk aggregation rule */
export type RiskRule = 'max_changes_risk' | 'max_issues_risk' | 'explicit';

// =============================================================================
// Module Configuration (v2.2)
// =============================================================================

export interface CognitiveModule {
  // Core identity
  name: string;
  version: string;
  responsibility: string;
  
  // Constraints
  excludes: string[];
  constraints?: ModuleConstraints;
  
  // Unified policies (v2.1+)
  policies?: ModulePolicies;
  
  // Tools policy
  tools?: ToolsPolicy;
  
  // Output contract
  output?: OutputContract;
  
  // Failure contract
  failure?: FailureContract;
  
  // Runtime requirements
  runtimeRequirements?: RuntimeRequirements;
  
  // v2.2: Module tier
  tier?: ModuleTier;
  
  // v2.2: Schema strictness
  schemaStrictness?: SchemaStrictness;
  
  // v2.2: Overflow configuration
  overflow?: OverflowConfig;
  
  // v2.2: Enum configuration
  enums?: EnumConfig;
  
  // v2.2: Compatibility configuration
  compat?: CompatConfig;
  
  // v2.2: Meta configuration (including risk_rule)
  metaConfig?: MetaConfig;
  
  // Execution context
  context?: 'fork' | 'main';
  
  // Prompt (from prompt.md or MODULE.md body)
  prompt: string;
  
  // Schemas
  inputSchema?: object;
  outputSchema?: object;  // v2.1 compat
  dataSchema?: object;    // v2.2: same as outputSchema
  metaSchema?: object;    // v2.2: control plane schema
  errorSchema?: object;
  
  // Metadata
  location: string;
  format: 'v0' | 'v1' | 'v2';
  formatVersion?: string;  // v2.0, v2.1, v2.2
}

export interface ModuleConstraints {
  no_network?: boolean;
  no_side_effects?: boolean;
  no_file_write?: boolean;
  no_inventing_data?: boolean;
  behavior_equivalence_false_max_confidence?: number;
}

export interface ModulePolicies {
  network?: 'allow' | 'deny';
  filesystem_write?: 'allow' | 'deny';
  side_effects?: 'allow' | 'deny';
  code_execution?: 'allow' | 'deny';
}

export interface ToolsPolicy {
  policy?: 'allow_by_default' | 'deny_by_default';
  allowed: string[];
  denied?: string[];
}

export interface OutputContract {
  format?: 'json_strict' | 'json_lenient' | 'text';
  envelope?: boolean;
  require?: string[];
  require_confidence?: boolean;
  require_rationale?: boolean;
  require_behavior_equivalence?: boolean;
}

export interface FailureContract {
  contract?: 'error_union' | 'throw';
  partial_allowed?: boolean;
  must_return_error_schema?: boolean;
  schema?: object;
}

export interface RuntimeRequirements {
  structured_output?: boolean;
  max_input_tokens?: number;
  preferred_capabilities?: string[];
}

// =============================================================================
// v2.2 New Configuration Types
// =============================================================================

/** Overflow configuration for extensions.insights */
export interface OverflowConfig {
  enabled: boolean;
  recoverable?: boolean;
  max_items?: number;
  require_suggested_mapping?: boolean;
}

/** Enum extension configuration */
export interface EnumConfig {
  strategy: EnumStrategy;
  unknown_tag?: string;  // How to represent unknown enums (default: "custom")
}

/** Compatibility configuration for migration */
export interface CompatConfig {
  accepts_v21_payload?: boolean;
  runtime_auto_wrap?: boolean;
  schema_output_alias?: 'data' | 'output';
}

/** Meta field configuration (v2.2) */
export interface MetaConfig {
  required?: string[];
  risk_rule?: RiskRule;
  confidence?: { min?: number; max?: number };
  explain?: { max_chars?: number };
}

// =============================================================================
// Envelope Types (v2.2)
// =============================================================================

/**
 * Control plane metadata - unified across all modules.
 * Used for routing, logging, UI cards, and middleware decisions.
 */
export interface EnvelopeMeta {
  /** Confidence score [0, 1] - unified across all modules */
  confidence: number;
  
  /** Aggregated risk level: max(changes[*].risk) */
  risk: RiskLevel;
  
  /** Short explanation for middleware/UI (max 280 chars) */
  explain: string;
  
  /** Distributed tracing ID */
  trace_id?: string;
  
  /** Provider and model identifier */
  model?: string;
  
  /** Execution latency in milliseconds */
  latency_ms?: number;
}

/** Success response in v2.2 envelope format */
export interface EnvelopeSuccessV22<T = unknown> {
  ok: true;
  meta: EnvelopeMeta;
  data: T;
}

/** Error response in v2.2 envelope format */
export interface EnvelopeErrorV22 {
  ok: false;
  meta: EnvelopeMeta;
  error: {
    code: string;
    message: string;
  };
  partial_data?: unknown;
}

/** v2.2 envelope response (union type) */
export type EnvelopeResponseV22<T = unknown> = EnvelopeSuccessV22<T> | EnvelopeErrorV22;

// =============================================================================
// Legacy Envelope Types (v2.1 - for backward compatibility)
// =============================================================================

export interface EnvelopeSuccessV21<T = unknown> {
  ok: true;
  data: T;
}

export interface EnvelopeErrorV21 {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  partial_data?: unknown;
}

export type EnvelopeResponseV21<T = unknown> = EnvelopeSuccessV21<T> | EnvelopeErrorV21;

/** Generic envelope response (supports both v2.1 and v2.2) */
export type EnvelopeResponse<T = unknown> = EnvelopeResponseV22<T> | EnvelopeResponseV21<T>;

// =============================================================================
// Overflow Types (v2.2)
// =============================================================================

/** An insight that doesn't fit the schema but is valuable */
export interface Insight {
  /** The observation or insight */
  text: string;
  
  /** Suggested field/enum to add to schema for future versions */
  suggested_mapping: string;
  
  /** Supporting evidence for this insight */
  evidence?: string;
}

/** Extensions container for overflow data */
export interface Extensions {
  insights?: Insight[];
}

// =============================================================================
// Extensible Enum Pattern (v2.2)
// =============================================================================

/**
 * Extensible enum type - allows both predefined values and custom extensions.
 * 
 * Usage:
 * type ChangeType = ExtensibleEnum<'remove_redundancy' | 'simplify_logic' | 'other'>;
 * 
 * Valid values:
 * - "remove_redundancy" (predefined)
 * - { custom: "inline_callback", reason: "Converted callback to arrow function" }
 */
export type ExtensibleEnum<T extends string> = T | { custom: string; reason: string };

// =============================================================================
// Module Result Types
// =============================================================================

/** Base interface for module result data */
export interface ModuleResultData {
  [key: string]: unknown;
  rationale: string;
  extensions?: Extensions;
}

/** v2.2 module result with meta and data separation */
export interface ModuleResultV22 {
  ok: boolean;
  meta: EnvelopeMeta;
  data?: ModuleResultData;
  error?: {
    code: string;
    message: string;
  };
  partial_data?: unknown;
  raw?: string;
}

/** Legacy module result (v2.1) */
export interface ModuleResultV21 {
  ok: boolean;
  data?: ModuleResultData & { confidence: number };
  error?: {
    code: string;
    message: string;
  };
  partial_data?: unknown;
  raw?: string;
}

/** Generic module result */
export type ModuleResult = ModuleResultV22 | ModuleResultV21;

// =============================================================================
// Legacy Types (for backward compatibility)
// =============================================================================

export interface LegacyModuleResult {
  output: unknown;
  confidence: number;
  rationale: string;
  behaviorEquivalence?: boolean;
  raw?: string;
}

// =============================================================================
// Command Types
// =============================================================================

export interface CommandContext {
  cwd: string;
  provider: Provider;
  verbose?: boolean;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// =============================================================================
// Module Input
// =============================================================================

export interface ModuleInput {
  code?: string;
  query?: string;
  language?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

// =============================================================================
// Utility Types
// =============================================================================

/** Check if response is v2.2 format */
export function isV22Envelope<T>(response: EnvelopeResponse<T>): response is EnvelopeResponseV22<T> {
  return 'meta' in response;
}

/** Check if response is successful */
export function isEnvelopeSuccess<T>(
  response: EnvelopeResponse<T>
): response is EnvelopeSuccessV22<T> | EnvelopeSuccessV21<T> {
  return response.ok === true;
}

/** Extract meta from any envelope response */
export function extractMeta<T>(
  response: EnvelopeResponse<T>,
  riskRule: RiskRule = 'max_changes_risk'
): EnvelopeMeta {
  if (isV22Envelope(response)) {
    return response.meta;
  }
  
  // Synthesize meta from v2.1 response
  if (response.ok) {
    const data = (response.data ?? {}) as Record<string, unknown>;
    return {
      confidence: (data.confidence as number) ?? 0.5,
      risk: aggregateRisk(data, riskRule),
      explain: ((data.rationale as string) ?? '').slice(0, 280) || 'No explanation',
    };
  } else {
    return {
      confidence: 0,
      risk: 'high',
      explain: response.error?.message?.slice(0, 280) ?? 'Error occurred',
    };
  }
}

/** Aggregate risk from list of items */
function aggregateRiskFromList(items: Array<{ risk?: RiskLevel }>): RiskLevel {
  const riskLevels: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
  const riskNames: RiskLevel[] = ['none', 'low', 'medium', 'high'];
  
  if (!items || items.length === 0) {
    return 'medium';
  }
  
  let maxLevel = 0;
  for (const item of items) {
    const level = riskLevels[item.risk ?? 'medium'];
    maxLevel = Math.max(maxLevel, level);
  }
  
  return riskNames[maxLevel];
}

/** 
 * Aggregate risk based on configured rule.
 * 
 * Rules:
 * - max_changes_risk: max(data.changes[*].risk) - default
 * - max_issues_risk: max(data.issues[*].risk) - for review modules
 * - explicit: return "medium", module should set risk explicitly
 */
export function aggregateRisk(
  data: Record<string, unknown>,
  riskRule: RiskRule = 'max_changes_risk'
): RiskLevel {
  if (riskRule === 'max_changes_risk') {
    const changes = (data.changes as Array<{ risk?: RiskLevel }>) ?? [];
    return aggregateRiskFromList(changes);
  } else if (riskRule === 'max_issues_risk') {
    const issues = (data.issues as Array<{ risk?: RiskLevel }>) ?? [];
    return aggregateRiskFromList(issues);
  } else if (riskRule === 'explicit') {
    return 'medium'; // Module should override
  }
  // Fallback to changes
  const changes = (data.changes as Array<{ risk?: RiskLevel }>) ?? [];
  return aggregateRiskFromList(changes);
}

/** Check if result should be escalated to human review */
export function shouldEscalate<T>(
  response: EnvelopeResponse<T>,
  confidenceThreshold: number = 0.7
): boolean {
  const meta = extractMeta(response);
  
  // Escalate if low confidence
  if (meta.confidence < confidenceThreshold) {
    return true;
  }
  
  // Escalate if high risk
  if (meta.risk === 'high') {
    return true;
  }
  
  // Escalate if error
  if (!response.ok) {
    return true;
  }
  
  return false;
}
