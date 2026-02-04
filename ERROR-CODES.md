# Cognitive Modules Error Codes

> **Version**: 2.5  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines the standard error code taxonomy for Cognitive Modules. Implementations SHOULD use these codes to ensure consistent error handling across the ecosystem.

---

## Error Code Format

Error codes follow the pattern: `E{category}{sequence}`

- **Category** (1 digit): Error layer
  - `1` = Input layer
  - `2` = Processing layer
  - `3` = Output layer
  - `4` = Runtime layer
- **Sequence** (3 digits): Specific error within category

Example: `E2001` = Processing layer, first error type (confidence below threshold)

---

## Legacy Code Mapping

For backward compatibility, legacy string codes are mapped to numeric codes:

| Legacy Code | Numeric Code | Notes |
|-------------|--------------|-------|
| `PARSE_ERROR` | E1000 | JSON parsing failed |
| `INVALID_INPUT` | E1001 | Input validation failed |
| `SCHEMA_VALIDATION_FAILED` | E3001 | Output schema violation |
| `UNSUPPORTED_LANGUAGE` | E1004 | Module-specific |
| `NO_SIMPLIFICATION_POSSIBLE` | E2004 | Module-specific |
| `BEHAVIOR_CHANGE_REQUIRED` | E2005 | Module-specific |
| `INTERNAL_ERROR` | E4000 | Generic runtime error |

Implementations SHOULD accept both formats and MAY normalize to numeric codes.

---

## Error Categories

### E1xxx: Input Errors

Errors in this category indicate problems with the input provided to the module. These are typically caller errors that can be fixed by modifying the input.

| Code | Name | Description | Recoverable |
|------|------|-------------|-------------|
| E1000 | PARSE_ERROR | JSON parsing failed | No |
| E1001 | INVALID_INPUT | Input does not match schema | Yes |
| E1002 | MISSING_REQUIRED_FIELD | Required field is missing | Yes |
| E1003 | TYPE_MISMATCH | Field type does not match schema | Yes |
| E1004 | UNSUPPORTED_VALUE | Value not supported (e.g., language) | Maybe |
| E1005 | INPUT_TOO_LARGE | Input exceeds max_input_tokens | Yes |
| E1006 | INVALID_REFERENCE | Referenced resource not found | Yes |
| E1010 | UNSUPPORTED_MEDIA_TYPE | Media type not supported by module (v2.5) | Yes |
| E1011 | MEDIA_TOO_LARGE | Media file exceeds size limit (v2.5) | Yes |
| E1012 | MEDIA_FETCH_FAILED | Failed to fetch media from URL (v2.5) | Yes |
| E1013 | MEDIA_DECODE_FAILED | Failed to decode base64 media (v2.5) | Yes |
| E1014 | MEDIA_TYPE_MISMATCH | Media content does not match declared type (v2.5) | Yes |
| E1015 | MEDIA_DIMENSION_EXCEEDED | Media dimensions exceed max allowed (v2.5) | Yes |
| E1016 | MEDIA_DIMENSION_TOO_SMALL | Media dimensions below minimum required (v2.5) | Yes |
| E1017 | MEDIA_PIXEL_LIMIT | Total pixels exceed maximum allowed (v2.5) | Yes |
| E1018 | UPLOAD_EXPIRED | Pre-uploaded file has expired (v2.5) | Yes |
| E1019 | UPLOAD_NOT_FOUND | Pre-upload reference not found (v2.5) | Yes |
| E1020 | CHECKSUM_MISMATCH | Media checksum validation failed (v2.5) | Yes |

#### Example Response

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "Input validation failed: 'code' field is required"
  },
  "error": {
    "code": "E1002",
    "message": "Missing required field 'code' in input",
    "recoverable": true,
    "suggestion": "Provide the 'code' field with the source code to analyze"
  }
}
```

---

### E2xxx: Processing Errors

Errors in this category occur during module execution. The module understood the input but could not complete the task satisfactorily.

| Code | Name | Description | Recoverable |
|------|------|-------------|-------------|
| E2001 | LOW_CONFIDENCE | Confidence below threshold | Yes |
| E2002 | TIMEOUT | Execution timeout exceeded | Maybe |
| E2003 | TOKEN_LIMIT | Token limit reached during generation | Yes |
| E2004 | NO_ACTION_POSSIBLE | Cannot perform requested action | No |
| E2005 | SEMANTIC_CONFLICT | Action would violate constraints | Maybe |
| E2006 | AMBIGUOUS_INPUT | Input is ambiguous, multiple interpretations | Yes |
| E2007 | INSUFFICIENT_CONTEXT | Need more context to proceed | Yes |
| E2010 | STREAM_INTERRUPTED | Streaming response was interrupted (v2.5) | Maybe |
| E2011 | STREAM_TIMEOUT | Stream exceeded maximum duration (v2.5) | Yes |

#### Example Response

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.45,
    "risk": "medium",
    "explain": "Confidence 0.45 below threshold 0.7 for exec tier"
  },
  "error": {
    "code": "E2001",
    "message": "Confidence score 0.45 is below the required threshold of 0.7 for exec tier modules",
    "recoverable": true,
    "suggestion": "Use decision tier instead, or provide additional context"
  },
  "partial_data": {
    "simplified_code": "...",
    "rationale": "Simplification applied but behavior equivalence uncertain"
  }
}
```

---

### E3xxx: Output Errors

Errors in this category indicate problems with the generated output. The module attempted to produce output but it does not meet requirements.

| Code | Name | Description | Recoverable |
|------|------|-------------|-------------|
| E3001 | OUTPUT_SCHEMA_VIOLATION | Output does not match schema | No |
| E3002 | PARTIAL_RESULT | Only partial result available | Maybe |
| E3003 | MISSING_RATIONALE | Rationale field is empty or missing | No |
| E3004 | OVERFLOW_LIMIT | Too many insights in extensions | No |
| E3005 | INVALID_ENUM | Enum value not in allowed set | No |
| E3006 | CONSTRAINT_VIOLATION | Output violates declared constraints | No |

#### Example Response

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "Output schema validation failed after repair pass"
  },
  "error": {
    "code": "E3001",
    "message": "Output missing required field 'behavior_equivalence'",
    "recoverable": false
  },
  "partial_data": {
    "simplified_code": "...",
    "changes": [...],
    "rationale": "..."
  }
}
```

---

### E4xxx: Runtime Errors

Errors in this category are infrastructure or system-level failures. These are typically not the caller's fault and may be transient.

| Code | Name | Description | Recoverable |
|------|------|-------------|-------------|
| E4000 | INTERNAL_ERROR | Unexpected internal error | No |
| E4001 | PROVIDER_UNAVAILABLE | LLM provider is unavailable | Yes |
| E4002 | RATE_LIMITED | Rate limit exceeded | Yes |
| E4003 | CONTEXT_OVERFLOW | Context window exceeded | Maybe |
| E4004 | CIRCULAR_DEPENDENCY | Circular module dependency detected | No |
| E4005 | MAX_DEPTH_EXCEEDED | Maximum call depth exceeded | No |
| E4006 | MODULE_NOT_FOUND | Requested module not installed | Yes |
| E4007 | PERMISSION_DENIED | Policy blocks this operation | No |
| E4010 | STREAMING_NOT_SUPPORTED | Runtime does not support streaming (v2.5) | No |
| E4011 | MULTIMODAL_NOT_SUPPORTED | Runtime does not support multimodal (v2.5) | No |
| E4012 | RECOVERY_NOT_SUPPORTED | Stream recovery not supported by runtime (v2.5) | No |
| E4013 | SESSION_EXPIRED | Stream session has expired, cannot recover (v2.5) | No |
| E4014 | CHECKPOINT_INVALID | Recovery checkpoint does not match (v2.5) | Yes |

#### Example Response

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "LLM provider rate limit exceeded"
  },
  "error": {
    "code": "E4002",
    "message": "Rate limit exceeded for provider 'openai'. Retry after 60 seconds.",
    "recoverable": true,
    "suggestion": "Wait 60 seconds before retrying, or use a different provider"
  }
}
```

---

## Error Response Schema

All error responses MUST follow this structure:

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "Brief error summary (≤280 chars)"
  },
  "error": {
    "code": "E1001",
    "message": "Human-readable error description",
    "recoverable": true,
    "suggestion": "How to fix this error"
  },
  "partial_data": {
    "...": "Optional partial results"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | string | Error code (E-format or legacy) |
| `error.message` | string | Human-readable description |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `error.recoverable` | boolean | Whether retry/fix may succeed |
| `error.suggestion` | string | Recommended action |
| `error.details` | object | Additional error context |
| `partial_data` | object | Partial results if available |

---

## Confidence Values for Errors

| Error Type | Recommended Confidence | Rationale |
|------------|----------------------|-----------|
| Input errors (E1xxx) | 0.0 | Cannot execute at all |
| Processing errors (E2xxx) | 0.0 - 0.5 | Partial understanding |
| Output errors (E3xxx) | 0.0 | Cannot produce valid output |
| Runtime errors (E4xxx) | 0.0 | Infrastructure failure |

---

## Risk Levels for Errors

| Error Type | Recommended Risk | Rationale |
|------------|-----------------|-----------|
| Input errors | "high" | Invalid state |
| Processing errors | "medium" or "high" | Depends on partial results |
| Output errors | "high" | Invalid output |
| Runtime errors | "high" | System failure |

---

## Implementation Guidelines

### Error Code Selection

1. Use the most specific code that applies
2. Prefer E-format codes for new implementations
3. Accept legacy codes for backward compatibility

### Recoverable Errors

Mark an error as `recoverable: true` when:
- Caller can fix by modifying input
- Transient failure (rate limit, timeout)
- Alternative approach exists

Mark as `recoverable: false` when:
- Internal system failure
- Constraint violation that cannot be bypassed
- Circular dependency or depth limit

### Suggestions

Always provide actionable suggestions:

```json
// Good
"suggestion": "Add type annotations to function parameters"

// Bad
"suggestion": "Fix the input"
```

---

## Module-Specific Codes

Modules MAY define custom error codes in the E5xxx-E9xxx range:

```yaml
# module.yaml
error_codes:
  E5001: "Code contains syntax errors"
  E5002: "Refactoring would change public API"
```

Custom codes SHOULD be documented in the module's schema.json:

```json
{
  "error": {
    "properties": {
      "code": {
        "type": "string",
        "enum": [
          "E1001", "E2001", "E3001",
          "E5001", "E5002"
        ]
      }
    }
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.5.1-draft | 2026-02 | Added media validation codes (E1014-E1020), recovery codes (E4012-E4014) |
| 2.5-draft | 2026-02 | Added v2.5 codes: E1010-E1013 (media), E2010-E2011 (streaming), E4010-E4011 (capability) |
| 2.2-draft | 2026-02 | Initial error taxonomy |
