/**
 * Cognitive Modules - Unified Error Handling
 * 
 * Provides consistent error structures across HTTP, MCP, and CLI layers.
 * Based on ERROR-CODES.md specification.
 */

import type { EnvelopeMeta, EnvelopeError, RiskLevel } from '../types.js';

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard error codes per ERROR-CODES.md specification.
 * 
 * Format: E{category}{sequence}
 * - Category 1: Input errors
 * - Category 2: Processing errors  
 * - Category 3: Output errors
 * - Category 4: Runtime errors
 * - Category 5-9: Module-specific (reserved)
 */
export const ErrorCodes = {
  // E1xxx: Input Errors
  PARSE_ERROR: 'E1000',
  INVALID_INPUT: 'E1001',
  MISSING_REQUIRED_FIELD: 'E1002',
  TYPE_MISMATCH: 'E1003',
  UNSUPPORTED_VALUE: 'E1004',
  INPUT_TOO_LARGE: 'E1005',
  INVALID_REFERENCE: 'E1006',
  
  // E2xxx: Processing Errors
  LOW_CONFIDENCE: 'E2001',
  TIMEOUT: 'E2002',
  TOKEN_LIMIT: 'E2003',
  NO_ACTION_POSSIBLE: 'E2004',
  SEMANTIC_CONFLICT: 'E2005',
  AMBIGUOUS_INPUT: 'E2006',
  INSUFFICIENT_CONTEXT: 'E2007',
  
  // E3xxx: Output Errors
  OUTPUT_SCHEMA_VIOLATION: 'E3001',
  PARTIAL_RESULT: 'E3002',
  MISSING_RATIONALE: 'E3003',
  OVERFLOW_LIMIT: 'E3004',
  INVALID_ENUM: 'E3005',
  CONSTRAINT_VIOLATION: 'E3006',
  
  // E4xxx: Runtime Errors
  INTERNAL_ERROR: 'E4000',
  PROVIDER_UNAVAILABLE: 'E4001',
  RATE_LIMITED: 'E4002',
  CONTEXT_OVERFLOW: 'E4003',
  CIRCULAR_DEPENDENCY: 'E4004',
  MAX_DEPTH_EXCEEDED: 'E4005',
  MODULE_NOT_FOUND: 'E4006',
  PERMISSION_DENIED: 'E4007',
  ENDPOINT_NOT_FOUND: 'E4008',
  RESOURCE_NOT_FOUND: 'E4009',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// =============================================================================
// Legacy Code Mapping
// =============================================================================

const LEGACY_CODE_MAP: Record<string, ErrorCode> = {
  // Input errors
  'PARSE_ERROR': ErrorCodes.PARSE_ERROR,
  'INVALID_INPUT': ErrorCodes.INVALID_INPUT,
  'MISSING_REQUIRED_FIELD': ErrorCodes.MISSING_REQUIRED_FIELD,
  'TYPE_MISMATCH': ErrorCodes.TYPE_MISMATCH,
  'UNSUPPORTED_VALUE': ErrorCodes.UNSUPPORTED_VALUE,
  'UNSUPPORTED_LANGUAGE': ErrorCodes.UNSUPPORTED_VALUE,
  'INPUT_TOO_LARGE': ErrorCodes.INPUT_TOO_LARGE,
  'INVALID_REFERENCE': ErrorCodes.INVALID_REFERENCE,
  
  // Processing errors
  'LOW_CONFIDENCE': ErrorCodes.LOW_CONFIDENCE,
  'TIMEOUT': ErrorCodes.TIMEOUT,
  'TOKEN_LIMIT': ErrorCodes.TOKEN_LIMIT,
  'NO_ACTION_POSSIBLE': ErrorCodes.NO_ACTION_POSSIBLE,
  'NO_SIMPLIFICATION_POSSIBLE': ErrorCodes.NO_ACTION_POSSIBLE,
  'SEMANTIC_CONFLICT': ErrorCodes.SEMANTIC_CONFLICT,
  'BEHAVIOR_CHANGE_REQUIRED': ErrorCodes.SEMANTIC_CONFLICT,
  'AMBIGUOUS_INPUT': ErrorCodes.AMBIGUOUS_INPUT,
  'INSUFFICIENT_CONTEXT': ErrorCodes.INSUFFICIENT_CONTEXT,
  
  // Output errors
  'SCHEMA_VALIDATION_FAILED': ErrorCodes.OUTPUT_SCHEMA_VIOLATION,
  'OUTPUT_SCHEMA_VIOLATION': ErrorCodes.OUTPUT_SCHEMA_VIOLATION,
  'PARTIAL_RESULT': ErrorCodes.PARTIAL_RESULT,
  
  // Runtime errors
  'INTERNAL_ERROR': ErrorCodes.INTERNAL_ERROR,
  'PROVIDER_UNAVAILABLE': ErrorCodes.PROVIDER_UNAVAILABLE,
  'RATE_LIMITED': ErrorCodes.RATE_LIMITED,
  'MODULE_NOT_FOUND': ErrorCodes.MODULE_NOT_FOUND,
  'PERMISSION_DENIED': ErrorCodes.PERMISSION_DENIED,
  'ENDPOINT_NOT_FOUND': ErrorCodes.ENDPOINT_NOT_FOUND,
  'RESOURCE_NOT_FOUND': ErrorCodes.RESOURCE_NOT_FOUND,
  'NOT_FOUND': ErrorCodes.RESOURCE_NOT_FOUND,
};

/**
 * Normalize error code to E-format.
 * Accepts both legacy string codes and E-format codes.
 */
export function normalizeErrorCode(code: string): ErrorCode {
  // Already E-format
  if (/^E\d{4}$/.test(code)) {
    return code as ErrorCode;
  }
  
  // Legacy format
  return LEGACY_CODE_MAP[code] || ErrorCodes.INTERNAL_ERROR;
}

// =============================================================================
// Unified Error Response Types
// =============================================================================

/**
 * Standard error envelope structure for all layers.
 * 
 * Use this as the canonical error response format:
 * - HTTP API: Return as JSON body with appropriate status code
 * - MCP: Return as content[0].text (JSON stringified)
 * - CLI: Convert to user-friendly message using toCliError()
 */
export interface CognitiveErrorEnvelope {
  ok: false;
  version: string;
  meta: EnvelopeMeta;
  error: EnvelopeError;
  partial_data?: unknown;
}

export interface EnvelopeContext {
  module?: string;
  provider?: string;
}

export type ContextualErrorEnvelope = CognitiveErrorEnvelope & EnvelopeContext;

/**
 * Options for creating an error envelope.
 * Exported for external use in type-safe error creation.
 */
export interface ErrorEnvelopeOptions {
  code: ErrorCode | string;
  message: string;
  recoverable?: boolean;
  suggestion?: string;
  retry_after_ms?: number;
  details?: Record<string, unknown>;
  partial_data?: unknown;
  explain?: string;
  confidence?: number;
  risk?: RiskLevel;
  trace_id?: string;
  version?: string;
}

// =============================================================================
// Error Envelope Factory
// =============================================================================

/**
 * Default recoverability by error category.
 */
function getDefaultRecoverable(code: string): boolean {
  const category = code.charAt(1);
  switch (category) {
    case '1': return true;   // Input errors are usually recoverable
    case '2': return true;   // Processing errors may be recoverable
    case '3': return false;  // Output errors are not recoverable
    case '4': {
      // Runtime errors: some are recoverable
      const recoverable4xxx: string[] = [
        ErrorCodes.PROVIDER_UNAVAILABLE,
        ErrorCodes.RATE_LIMITED,
        ErrorCodes.MODULE_NOT_FOUND,
      ];
      return recoverable4xxx.includes(code);
    }
    default: return false;
  }
}

/**
 * Create a standardized error envelope.
 * 
 * @example
 * // Simple error
 * makeErrorEnvelope({
 *   code: ErrorCodes.MODULE_NOT_FOUND,
 *   message: "Module 'code-reviewer' not found",
 *   suggestion: "Use 'cog list' to see available modules"
 * });
 * 
 * @example
 * // Error with retry info
 * makeErrorEnvelope({
 *   code: ErrorCodes.RATE_LIMITED,
 *   message: "Rate limit exceeded",
 *   retry_after_ms: 60000
 * });
 */
export function makeErrorEnvelope(options: ErrorEnvelopeOptions): CognitiveErrorEnvelope {
  const code = normalizeErrorCode(options.code);
  const recoverable = options.recoverable ?? getDefaultRecoverable(code);
  
  const error: EnvelopeError = {
    code,
    message: options.message,
    recoverable,
  };
  
  if (options.suggestion) {
    error.suggestion = options.suggestion;
  }
  if (options.retry_after_ms !== undefined) {
    error.retry_after_ms = options.retry_after_ms;
  }
  if (options.details) {
    error.details = options.details;
  }
  
  return {
    ok: false,
    version: options.version || '2.2',
    meta: {
      confidence: options.confidence ?? 0.0,
      risk: options.risk ?? 'high',
      explain: (options.explain || options.message).slice(0, 280),
      trace_id: options.trace_id,
    },
    error,
    partial_data: options.partial_data,
  };
}

// =============================================================================
// Layer-Specific Helpers
// =============================================================================

export function attachContext<T extends object>(envelope: T, context?: EnvelopeContext): T & EnvelopeContext {
  if (!context) return envelope as T & EnvelopeContext;
  const { module, provider } = context;
  if (!module && !provider) return envelope as T & EnvelopeContext;
  return {
    ...envelope,
    ...(module ? { module } : {}),
    ...(provider ? { provider } : {}),
  };
}

/**
 * Map a CEP error code to an HTTP status code.
 *
 * This is used to keep HTTP behavior consistent with the error model while
 * allowing callers to attach context without rebuilding envelopes.
 */
export function httpStatusForErrorCode(code: string): number {
  const normalized = normalizeErrorCode(code);

  const category = normalized.charAt(1);
  switch (category) {
    case '1': {
      // Input errors -> Bad Request (with specific overrides)
      if (normalized === ErrorCodes.INPUT_TOO_LARGE) return 413;
      return 400;
    }
    case '2': return 422; // Processing errors -> Unprocessable Entity
    case '3': return 500; // Output errors -> Internal Server Error
    case '4': {
      // Runtime errors -> map to appropriate HTTP status
      if (
        normalized === ErrorCodes.MODULE_NOT_FOUND ||
        normalized === ErrorCodes.ENDPOINT_NOT_FOUND ||
        normalized === ErrorCodes.RESOURCE_NOT_FOUND
      ) {
        return 404;
      }
      if (normalized === ErrorCodes.PERMISSION_DENIED) return 403;
      if (normalized === ErrorCodes.RATE_LIMITED) return 429;
      return 500;
    }
    default: return 500;
  }
}

/**
 * Create error envelope for HTTP API responses.
 * 
 * @returns Tuple of [statusCode, body]
 */
export function makeHttpError(options: ErrorEnvelopeOptions & EnvelopeContext): [number, ContextualErrorEnvelope] {
  const envelope = attachContext(makeErrorEnvelope(options), options);
  const statusCode = httpStatusForErrorCode(String(options.code));
  return [statusCode, envelope];
}

/**
 * Create error envelope for MCP tool responses.
 */
export function makeMcpError(options: ErrorEnvelopeOptions & EnvelopeContext): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const envelope = attachContext(makeErrorEnvelope(options), {
    module: options.module ?? 'unknown',
    provider: options.provider ?? 'unknown',
  });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(envelope, null, 2),
      },
    ],
  };
}

/**
 * Convert error envelope to CLI-friendly error message.
 */
export function toCliError(envelope: CognitiveErrorEnvelope): string {
  const { error } = envelope;
  let message = `Error [${error.code}]: ${error.message}`;
  
  if (error.suggestion) {
    message += `\n  Suggestion: ${error.suggestion}`;
  }
  
  if (error.retry_after_ms) {
    const seconds = Math.ceil(error.retry_after_ms / 1000);
    message += `\n  Retry after: ${seconds}s`;
  }
  
  return message;
}

/**
 * Convert CLI CommandResult-style error to standard envelope.
 * Used for backward compatibility during migration.
 */
export function fromCliError(
  errorMessage: string,
  code: ErrorCode = ErrorCodes.INTERNAL_ERROR
): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code,
    message: errorMessage,
  });
}

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error envelope indicates a recoverable error.
 */
export function isRecoverable(envelope: CognitiveErrorEnvelope): boolean {
  return envelope.error.recoverable === true;
}

/**
 * Check if an error envelope has partial data.
 */
export function hasPartialData(envelope: CognitiveErrorEnvelope): boolean {
  return envelope.partial_data !== undefined;
}

/**
 * Check if an error envelope suggests retrying.
 */
export function shouldRetry(envelope: CognitiveErrorEnvelope): boolean {
  const retryableCodes: string[] = [
    ErrorCodes.RATE_LIMITED,
    ErrorCodes.PROVIDER_UNAVAILABLE,
    ErrorCodes.TIMEOUT,
  ];
  return (
    envelope.error.recoverable === true &&
    (envelope.error.retry_after_ms !== undefined || 
     retryableCodes.includes(envelope.error.code))
  );
}

// =============================================================================
// Success Envelope Factory
// =============================================================================

/**
 * Options for creating a success envelope.
 */
export interface SuccessEnvelopeOptions<T = unknown> {
  data: T;
  confidence?: number;
  risk?: RiskLevel;
  explain?: string;
  trace_id?: string;
  version?: string;
}

/**
 * Standard success envelope structure.
 */
export interface CognitiveSuccessEnvelope<T = unknown> {
  ok: true;
  version: string;
  meta: EnvelopeMeta;
  data: T;
}

/**
 * Create a standardized success envelope.
 * Use this for consistent success responses across HTTP and MCP layers.
 */
export function makeSuccessEnvelope<T>(options: SuccessEnvelopeOptions<T>): CognitiveSuccessEnvelope<T> {
  const explain = (options.explain || 'Operation completed successfully').slice(0, 280);
  // Envelope schema requires data to be an object with at least `rationale`.
  // For non-module operations (list/info), we still emit a conforming envelope by
  // injecting a minimal rationale if missing, or wrapping non-objects.
  const normalizedData = (() => {
    const d = options.data as unknown;
    const isPlainObject = typeof d === 'object' && d !== null && !Array.isArray(d);
    if (!isPlainObject) {
      return { result: d, rationale: explain } as unknown as T;
    }
    const obj = d as Record<string, unknown>;
    if (typeof obj.rationale === 'string') return options.data;
    return { ...obj, rationale: explain } as unknown as T;
  })();

  return {
    ok: true,
    version: options.version || '2.2',
    meta: {
      confidence: options.confidence ?? 1.0,
      risk: options.risk ?? 'none',
      explain,
      trace_id: options.trace_id,
    },
    data: normalizedData,
  };
}

/**
 * Create success envelope for MCP tool responses.
 */
export function makeMcpSuccess<T>(options: SuccessEnvelopeOptions<T>): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const envelope = makeSuccessEnvelope(options);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(envelope, null, 2),
      },
    ],
  };
}

// =============================================================================
// Common Error Factories
// =============================================================================

/**
 * Create MODULE_NOT_FOUND error.
 */
export function moduleNotFoundError(moduleName: string, options?: {
  suggestion?: string;
  trace_id?: string;
}): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.MODULE_NOT_FOUND,
    message: `Module '${moduleName}' not found`,
    suggestion: options?.suggestion || "Use 'cog list' to see available modules, or 'cog search' to find modules in registry",
    trace_id: options?.trace_id,
  });
}

/**
 * Create PARSE_ERROR error.
 */
export function parseError(details?: string, options?: {
  trace_id?: string;
}): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.PARSE_ERROR,
    message: details ? `JSON parsing failed: ${details}` : 'Invalid JSON body',
    recoverable: false,
    trace_id: options?.trace_id,
  });
}

/**
 * Create RATE_LIMITED error.
 */
export function rateLimitedError(retryAfterMs: number, provider?: string): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.RATE_LIMITED,
    message: `Rate limit exceeded${provider ? ` for provider '${provider}'` : ''}`,
    retry_after_ms: retryAfterMs,
    suggestion: `Wait ${Math.ceil(retryAfterMs / 1000)} seconds before retrying`,
  });
}

/**
 * Create INTERNAL_ERROR error.
 */
export function internalError(message: string, options?: {
  details?: Record<string, unknown>;
  trace_id?: string;
}): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.INTERNAL_ERROR,
    message,
    recoverable: false,
    details: options?.details,
    trace_id: options?.trace_id,
  });
}

/**
 * Create MISSING_REQUIRED_FIELD error.
 */
export function missingFieldError(fieldName: string, options?: {
  suggestion?: string;
}): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.MISSING_REQUIRED_FIELD,
    message: `Missing required field: ${fieldName}`,
    suggestion: options?.suggestion || `Provide the '${fieldName}' field in your request`,
  });
}

/**
 * Create PERMISSION_DENIED error.
 */
export function permissionDeniedError(reason: string): CognitiveErrorEnvelope {
  return makeErrorEnvelope({
    code: ErrorCodes.PERMISSION_DENIED,
    message: reason,
    recoverable: false,
  });
}
