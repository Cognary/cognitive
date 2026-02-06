---
sidebar_position: 100
---

# Specification

Complete Cognitive Modules v2.2 specification.

## Overview

Cognitive Modules is a specification for defining verifiable, structured AI task modules with:

- **Strong contracts** - JSON Schema for input/output validation
- **Explainability** - Mandatory confidence and rationale
- **Control/Data separation** - Meta plane for routing, data plane for business logic
- **Tiered strictness** - exec/decision/exploration levels

## Module Structure

### v2.2 Format

```
module-name/
├── module.yaml      # Machine-readable manifest
├── prompt.md        # Human-readable prompt
├── schema.json      # IO contract (meta + input + data + error)
└── tests/           # Golden tests
```

## Response Envelope

### Success

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.0-1.0,
    "risk": "none" | "low" | "medium" | "high",
    "explain": "≤280 chars summary"
  },
  "data": {
    "...business fields...",
    "rationale": "detailed reasoning",
    "extensions": {
      "insights": [...]
    }
  }
}
```

### Error

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0-1.0,
    "risk": "none" | "low" | "medium" | "high",
    "explain": "≤280 chars"
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "partial_data": { ... }
}
```

## Tiers

| Tier | Schema Strictness | Overflow | Use Case |
|------|-------------------|----------|----------|
| `exec` | high | disabled | Auto-execution (patches, commands) |
| `decision` | medium | enabled | Judgment (review, prioritization) |
| `exploration` | low | enabled | Creative (UI specs, analysis) |

## module.yaml Schema

```yaml
# Required
name: string           # Module identifier
version: semver        # Semantic version
responsibility: string # One-sentence description
tier: exec | decision | exploration
excludes: string[]     # What module doesn't do

# Optional
schema_strictness: high | medium | low

policies:
  network: allow | deny
  filesystem_write: allow | deny
  side_effects: allow | deny
  code_execution: allow | deny

tools:
  policy: deny_by_default | allow_by_default
  allowed: string[]
  denied: string[]

overflow:
  enabled: boolean
  recoverable: boolean
  max_items: number
  require_suggested_mapping: boolean

enums:
  strategy: strict | extensible

failure:
  contract: error_union
  partial_allowed: boolean
  must_return_error_schema: boolean

runtime_requirements:
  structured_output: boolean
  max_input_tokens: number
  preferred_capabilities: string[]

io:
  input: string    # JSON pointer to input schema
  data: string     # JSON pointer to data schema
  meta: string     # JSON pointer to meta schema
  error: string    # JSON pointer to error schema

compat:
  accepts_v21_payload: boolean
  runtime_auto_wrap: boolean
  schema_output_alias: string
```

## schema.json Schema

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "risk": { "enum": ["none", "low", "medium", "high"] },
      "explain": { "type": "string", "maxLength": 280 }
    }
  },
  
  "input": {
    "type": "object",
    "required": [...],
    "properties": { ... }
  },
  
  "data": {
    "type": "object",
    "required": ["rationale", ...],
    "properties": {
      "rationale": { "type": "string" },
      "extensions": { "$ref": "#/$defs/extensions" },
      ...
    }
  },
  
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "type": "string" },
      "message": { "type": "string" }
    }
  },
  
  "$defs": {
    "extensions": {
      "type": "object",
      "properties": {
        "insights": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "object",
            "required": ["text", "suggested_mapping"],
            "properties": {
              "text": { "type": "string" },
              "suggested_mapping": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## Extensible Enums

```json
{
  "type": {
    "oneOf": [
      { "enum": ["known_value_1", "known_value_2"] },
      {
        "type": "object",
        "required": ["custom", "reason"],
        "properties": {
          "custom": { "type": "string", "maxLength": 32 },
          "reason": { "type": "string" }
        }
      }
    ]
  }
}
```

## Validation Rules

### v2.2 Strict Validation

1. `module.yaml` must have `tier`
2. `schema.json` must have `meta` schema
3. `meta.explain` must have `maxLength ≤ 280`
4. `data` must require `rationale`
5. If `overflow.enabled`, must have `$defs.extensions`
6. `prompt.md` must describe v2.2 envelope format

## Version History

| Version | Changes |
|---------|---------|
| v2.2 | Control/Data separation, tiers, extensible enums |
| v2.1 | Envelope format (`{ok, data}`) |
| v1 | Single MODULE.md file |
| v0 | Deprecated 6-file format |
