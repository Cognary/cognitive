/**
 * Cognitive Runtime - Core Types
 * Version 2.5 - With streaming response and multimodal support
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

// =============================================================================
// v2.5 Streaming Types
// =============================================================================

/** Response mode configuration */
export type ResponseMode = 'sync' | 'streaming' | 'both';

/** Chunk type for streaming */
export type ChunkType = 'delta' | 'snapshot';

/** Response configuration in module.yaml */
export interface ResponseConfig {
  mode: ResponseMode;
  chunk_type?: ChunkType;
  buffer_size?: number;
  heartbeat_interval_ms?: number;
  max_duration_ms?: number;
}

/** Meta chunk - initial streaming response */
export interface MetaChunk {
  ok: true;
  streaming: true;
  session_id: string;
  meta: Partial<EnvelopeMeta>;
}

/** Delta chunk - incremental content */
export interface DeltaChunk {
  chunk: {
    seq: number;
    type: 'delta';
    field?: string;
    delta: string;
  };
}

/** Snapshot chunk - full state replacement */
export interface SnapshotChunk {
  chunk: {
    seq: number;
    type: 'snapshot';
    field?: string;
    data: unknown;
  };
}

/** Progress chunk - progress update */
export interface ProgressChunk {
  progress: {
    percent: number;
    stage?: string;
    message?: string;
  };
}

/** Final chunk - completion signal */
export interface FinalChunk {
  final: true;
  meta: EnvelopeMeta;
  data: ModuleResultData;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/** Recovery checkpoint for stream resume */
export interface Checkpoint {
  offset: number;
  hash: string;  // First 6 chars of SHA256
}

/** Recovery information in error */
export interface RecoveryInfo {
  last_seq: number;
  last_checkpoint?: Checkpoint;
  retry_after_ms?: number;
  max_retries?: number;
}

/** Error with optional recovery information */
export interface ErrorWithRecovery {
  code: string;
  message: string;
  recoverable?: boolean;
  recovery?: RecoveryInfo;
  details?: Record<string, unknown>;
}

/** Error chunk during streaming */
export interface ErrorChunk {
  ok: false;
  streaming: true;
  session_id?: string;
  error: ErrorWithRecovery;
  partial_data?: unknown;
}

/** Union of all streaming chunk types */
export type StreamingChunk = 
  | MetaChunk 
  | DeltaChunk 
  | SnapshotChunk 
  | ProgressChunk 
  | FinalChunk 
  | ErrorChunk;

/** Streaming session state */
export interface StreamingSession {
  session_id: string;
  module_name: string;
  started_at: number;
  chunks_sent: number;
  accumulated_data: Record<string, unknown>;
  accumulated_text: Record<string, string>;
  last_checkpoint?: Checkpoint;
}

// =============================================================================
// v2.5 Response Mode Negotiation
// =============================================================================

/** Request options for response mode negotiation */
export interface RequestOptions {
  response_mode?: ResponseMode;
  chunk_type?: ChunkType;
}

/** Recovery context for stream retry */
export interface RecoveryContext {
  session_id: string;
  last_seq: number;
  last_checkpoint?: Checkpoint;
}

/** Warning in response (for fallback scenarios) */
export interface ResponseWarning {
  code: string;
  message: string;
  fallback_used?: string;
}

/** Execute options with negotiation support */
export interface ExecuteOptionsV25 {
  input: Record<string, unknown>;
  _options?: RequestOptions;
  _recovery?: RecoveryContext;
}

/** Negotiation result */
export interface NegotiationResult {
  mode: ResponseMode;
  reason: 'header' | 'body_option' | 'query_param' | 'accept_header' | 'module_default';
  warnings?: ResponseWarning[];
}

// =============================================================================
// v2.5 Multimodal Types
// =============================================================================

/** Supported modality types */
export type ModalityType = 'text' | 'image' | 'audio' | 'video' | 'document';

/** Modalities configuration in module.yaml */
export interface ModalitiesConfig {
  input: ModalityType[];
  output: ModalityType[];
  constraints?: MediaConstraints;
}

/** Media size/duration constraints */
export interface MediaConstraints {
  max_image_size_mb?: number;
  max_audio_size_mb?: number;
  max_video_size_mb?: number;
  max_audio_duration_s?: number;
  max_video_duration_s?: number;
  allowed_image_types?: string[];
  allowed_audio_types?: string[];
  allowed_video_types?: string[];
}

/** Media input - URL reference */
export interface UrlMediaInput {
  type: 'url';
  url: string;
  media_type?: string;
}

/** Media input - Base64 inline */
export interface Base64MediaInput {
  type: 'base64';
  media_type: string;
  data: string;
}

/** Media input - File path */
export interface FileMediaInput {
  type: 'file';
  path: string;
}

/** Media input - Upload reference (for pre-uploaded files) */
export interface UploadRefMediaInput {
  type: 'upload_ref';
  upload_id: string;
  media_type?: string;
}

/** Union of media input types */
export type MediaInput = UrlMediaInput | Base64MediaInput | FileMediaInput | UploadRefMediaInput;

/** Checksum for media integrity */
export interface MediaChecksum {
  algorithm: 'sha256' | 'md5' | 'crc32';
  value: string;
}

/** Media validation result */
export interface MediaValidationResult {
  index: number;
  media_type: string;
  size_bytes: number;
  dimensions?: {
    width: number;
    height: number;
  };
  duration_ms?: number;
  valid: boolean;
  errors?: string[];
}

/** Media validation summary in meta */
export interface MediaValidationSummary {
  input_count: number;
  validated: MediaValidationResult[];
}

/** Magic bytes for media type detection */
export const MEDIA_MAGIC_BYTES: Record<string, string[]> = {
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e470d0a1a0a'],
  'image/gif': ['47494638'],
  'image/webp': ['52494646'],
  'audio/mpeg': ['fffb', 'fffa', '494433'],
  'audio/wav': ['52494646'],
  'audio/ogg': ['4f676753'],
  'video/mp4': ['0000001866747970', '0000002066747970'],
  'video/webm': ['1a45dfa3'],
  'application/pdf': ['25504446'],
};

/** Media size limits in bytes */
export const MEDIA_SIZE_LIMITS: Record<string, number> = {
  'image': 20 * 1024 * 1024,  // 20MB
  'audio': 25 * 1024 * 1024,  // 25MB
  'video': 100 * 1024 * 1024, // 100MB
  'document': 50 * 1024 * 1024, // 50MB
};

/** Media dimension limits */
export const MEDIA_DIMENSION_LIMITS = {
  max_width: 8192,
  max_height: 8192,
  min_width: 10,
  min_height: 10,
  max_pixels: 67108864,  // 8192 x 8192
};

/** Media output with metadata */
export interface MediaOutput {
  type: 'url' | 'base64' | 'file';
  media_type: string;
  url?: string;
  data?: string;
  path?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  expires_at?: string;
  generation_params?: Record<string, unknown>;
}

/** Supported image MIME types */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

/** Supported audio MIME types */
export const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm'
] as const;

/** Supported video MIME types */
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime'
] as const;

// =============================================================================
// v2.5 Error Codes
// =============================================================================

/** v2.5 Error codes for streaming and multimodal */
export const ErrorCodesV25 = {
  // Media errors (E1xxx)
  UNSUPPORTED_MEDIA_TYPE: 'E1010',
  MEDIA_TOO_LARGE: 'E1011',
  MEDIA_FETCH_FAILED: 'E1012',
  MEDIA_DECODE_FAILED: 'E1013',
  MEDIA_TYPE_MISMATCH: 'E1014',
  MEDIA_DIMENSION_EXCEEDED: 'E1015',
  MEDIA_DIMENSION_TOO_SMALL: 'E1016',
  MEDIA_PIXEL_LIMIT: 'E1017',
  UPLOAD_EXPIRED: 'E1018',
  UPLOAD_NOT_FOUND: 'E1019',
  CHECKSUM_MISMATCH: 'E1020',
  
  // Streaming errors (E2xxx)
  STREAM_INTERRUPTED: 'E2010',
  STREAM_TIMEOUT: 'E2011',
  
  // Capability errors (E4xxx)
  STREAMING_NOT_SUPPORTED: 'E4010',
  MULTIMODAL_NOT_SUPPORTED: 'E4011',
  RECOVERY_NOT_SUPPORTED: 'E4012',
  SESSION_EXPIRED: 'E4013',
  CHECKPOINT_INVALID: 'E4014',
} as const;

export type ErrorCodeV25 = typeof ErrorCodesV25[keyof typeof ErrorCodesV25];

// =============================================================================
// v2.5 Runtime Capabilities
// =============================================================================

/** Runtime capability declaration */
export interface RuntimeCapabilities {
  streaming: boolean;
  multimodal: {
    input: ModalityType[];
    output: ModalityType[];
  };
  max_media_size_mb: number;
  supported_transports: ('sse' | 'websocket' | 'ndjson')[];
}

/** Default runtime capabilities */
export const DEFAULT_RUNTIME_CAPABILITIES: RuntimeCapabilities = {
  streaming: true,
  multimodal: {
    input: ['text', 'image'],
    output: ['text']
  },
  max_media_size_mb: 20,
  supported_transports: ['sse', 'ndjson']
};

// =============================================================================
// v2.5 Extended Provider Interface
// =============================================================================

/** Extended invoke params with streaming support */
export interface InvokeParamsV25 extends InvokeParams {
  stream?: boolean;
  images?: MediaInput[];
  audio?: MediaInput[];
  video?: MediaInput[];
}

/** Streaming invoke result */
export interface StreamingInvokeResult {
  stream: AsyncIterable<string>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Extended provider interface for v2.5 */
export interface ProviderV25 extends Provider {
  /** Check if provider supports streaming */
  supportsStreaming?(): boolean;
  
  /** Check if provider supports multimodal input */
  supportsMultimodal?(): { input: ModalityType[]; output: ModalityType[] };
  
  /** Invoke with streaming */
  invokeStream?(params: InvokeParamsV25): Promise<StreamingInvokeResult>;
}

/** Type guard for v2.5 provider */
export function isProviderV25(provider: Provider): provider is ProviderV25 {
  return 'invokeStream' in provider || 'supportsStreaming' in provider;
}

// =============================================================================
// v2.5 Module Configuration Extensions
// =============================================================================

/** Extended module interface for v2.5 */
export interface CognitiveModuleV25 extends CognitiveModule {
  /** v2.5: Response configuration */
  response?: ResponseConfig;
  
  /** v2.5: Modalities configuration */
  modalities?: ModalitiesConfig;
}

/** Type guard for v2.5 module */
export function isModuleV25(module: CognitiveModule): module is CognitiveModuleV25 {
  return 'response' in module || 'modalities' in module;
}

/** Check if module supports streaming */
export function moduleSupportsStreaming(module: CognitiveModule): boolean {
  if (!isModuleV25(module)) return false;
  const mode = module.response?.mode;
  return mode === 'streaming' || mode === 'both';
}

/** Check if module supports multimodal input */
export function moduleSupportsMultimodal(module: CognitiveModule): boolean {
  if (!isModuleV25(module)) return false;
  const modalities = module.modalities?.input ?? ['text'];
  return modalities.some(m => m !== 'text');
}

/** Get supported input modalities for module */
export function getModuleInputModalities(module: CognitiveModule): ModalityType[] {
  if (!isModuleV25(module)) return ['text'];
  return module.modalities?.input ?? ['text'];
}

/** Get supported output modalities for module */
export function getModuleOutputModalities(module: CognitiveModule): ModalityType[] {
  if (!isModuleV25(module)) return ['text'];
  return module.modalities?.output ?? ['text'];
}
