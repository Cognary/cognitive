---
sidebar_position: 2
---

# Cognitive Modules Specification v2.2

> **Verifiable Structured AI Task Specification — Second Generation Enhanced**

English | [中文](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC-v2.2_zh.md)

---

## 0. Core Design Goals

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Contract-first** | Input/output/failure semantics must be verifiable |
| 2 | **Control/Data Plane Separation** | Middleware can route without parsing business payload |
| 3 | **Strict where needed** | Module tier determines schema strictness |
| 4 | **Overflow but recoverable** | Allow "brilliant insights" but must be recoverable |
| 5 | **Enum extensible safely** | Type safety without sacrificing expressiveness |

---

## 0.0.1 Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

## 0.0.2 Versioning Policy

Cognitive Modules follows [Semantic Versioning](https://semver.org/):

| Version Type | Example | Description | Deprecation Notice |
|--------------|---------|-------------|-------------------|
| **Major** | 3.0.0 | Breaking changes to envelope or core contracts | 12 months |
| **Minor** | 2.3.0 | New features, backward compatible | - |
| **Patch** | 2.2.1 | Bug fixes, clarifications only | - |

### Compatibility Guarantees

1. **Minor versions** MUST be backward compatible with previous minor versions of the same major
2. **Patch versions** MUST NOT introduce any behavioral changes
3. **Deprecated features** MUST continue to work for the stated deprecation period
4. **Breaking changes** MUST be documented in migration guides

## 0.0.3 Compatibility Matrix

| Spec Version | Min Runtime | Status | Deprecation Date | Migration Guide |
|--------------|-------------|--------|------------------|-----------------|
| v2.2 | 0.5.0 | ✅ Current | - | - |
| v2.1 | 0.4.0 | 🔄 Migrate | 2026-06-01 | [v2.1 → v2.2](#6-migration-strategy-v21--v22) |
| v1.0 | 0.1.0 | ⚠️ Legacy | 2025-12-01 | See v1 docs |

### Runtime Compatibility

Runtimes SHOULD declare which spec versions they support:

```yaml
# runtime config
cognitive:
  spec_versions:
    - "2.2"    # Full support
    - "2.1"    # Compatibility mode
```

## 0.0.4 Related Documents

| Document | Description |
|----------|-------------|
| [CONFORMANCE.md](./conformance) | Conformance levels (Level 1/2/3) for implementations |
| [ERROR-CODES.md](./error-codes) | Standard error code taxonomy (E1xxx-E4xxx) |
| [spec/response-envelope.schema.json](https://github.com/ziel-io/cognitive-modules/blob/main/spec/response-envelope.schema.json) | JSON Schema for response validation |
| [spec/module.yaml.schema.json](https://github.com/ziel-io/cognitive-modules/blob/main/spec/module.yaml.schema.json) | JSON Schema for module.yaml |
| [spec/test-vectors/](https://github.com/ziel-io/cognitive-modules/tree/main/spec/test-vectors) | Official test vectors for compliance |

---

## 0.1 Core Concepts

### Module

A Cognitive Module consists of three parts:

```
Module = Manifest + Prompt + Contract
```

| Component | File | Responsibility | Reader |
|-----------|------|----------------|--------|
| **Manifest** | `module.yaml` | Machine-readable config, policies, tiers | Runtime |
| **Prompt** | `prompt.md` | Human-readable instructions, rules | LLM |
| **Contract** | `schema.json` | Verifiable input/output/error contract | Validator |

### Contract

Contract is the verifiable promise between module and caller, divided into two layers:

#### Schema Contract

Defined in `schema.json`, describes the **structure** of data:

| Schema Contract | Description | Corresponding Field |
|-----------------|-------------|---------------------|
| **Input Schema** | Input data structure | `schema.json#/input` |
| **Meta Schema** | Control plane data structure | `schema.json#/meta` |
| **Data Schema** | Business data structure | `schema.json#/data` |
| **Error Schema** | Error data structure | `schema.json#/error` |

#### Envelope Contract (Normative)

Defines the **fixed wrapper format** for responses, independent of specific modules.

**Success Envelope Requirements:**

1. A success envelope MUST have `ok` set to `true`
2. A success envelope MUST include the `meta` object
3. A success envelope MUST include the `data` object
4. A success envelope MUST NOT include the `error` field
5. A success envelope MUST NOT include the `partial_data` field

**Failure Envelope Requirements:**

1. A failure envelope MUST have `ok` set to `false`
2. A failure envelope MUST include the `meta` object
3. A failure envelope MUST include the `error` object
4. A failure envelope MUST NOT include the `data` field
5. A failure envelope MAY include `partial_data` if `failure.partial_allowed: true` in module.yaml

```json
// Success response
{ "ok": true,  "meta": {...}, "data": {...} }

// Failure response
{ "ok": false, "meta": {...}, "error": {...}, "partial_data"?: {...} }
```

| Field | Type | On Success | On Failure |
|-------|------|------------|------------|
| `ok` | boolean | MUST be `true` | MUST be `false` |
| `meta` | object | MUST be present | MUST be present |
| `data` | object | MUST be present | MUST NOT be present |
| `error` | object | MUST NOT be present | MUST be present |
| `partial_data` | object | MUST NOT be present | MAY be present |

```
┌─────────────────────────────────────────────────────────────────┐
│                    Contract Two-Layer Structure                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Schema Contract (schema.json)                           │   │
│  │  Defines data structure, different for each module       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │  input  │ │  meta   │ │  data   │ │  error  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Envelope Contract (Fixed Format)                        │   │
│  │  Wrapper format, unified across all modules              │   │
│  │  { ok: bool, meta: {...}, data|error: {...} }           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Contract is the core of Cognitive Modules:
- **Verifiable**: Schema Contract validated via JSON Schema
- **Routable**: Envelope Contract lets middleware decide without parsing business
- **Composable**: Unified format enables safe inter-module orchestration

---

## 1. Module Manifest (module.yaml)

### 1.1 Module Tiers

```yaml
tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low
```

**Tier Semantics**:

| Tier | Purpose | Schema Strictness | Overflow |
|------|---------|-------------------|----------|
| `exec` | Auto-execution/deployment (patch, approval, instruction generation) | high | Disabled or limited |
| `decision` | Judgment/evaluation/classification (risk, boundary, comparison, review) | medium | Enabled, recoverable |
| `exploration` | Exploration/research/inspiration generation | low | Relaxed |

> **Principle**: Tier determines "allowed freedom of expression", not "model intelligence".

### 1.2 Overflow Policy

```yaml
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether to allow extensions.insights |
| `recoverable` | boolean | Whether insights must have suggested_mapping |
| `max_items` | number | Maximum number of insights allowed |
| `require_suggested_mapping` | boolean | Whether to require mapping suggestions |

### 1.3 Enum Extension Strategy

```yaml
enums:
  strategy: extensible   # strict | extensible
  unknown_tag: custom    # How to represent unknown enum
```

| Strategy | Default For | Description |
|----------|-------------|-------------|
| `strict` | exec modules | Only allow predefined enum values |
| `extensible` | decision/exploration | Allow custom extensions |

### 1.4 Complete module.yaml Example

```yaml
# Cognitive Module Manifest v2.2
name: code-simplifier
version: 2.2.0
responsibility: Simplify code while preserving behavior

# Module tier
tier: decision
schema_strictness: medium

# Explicit exclusions
excludes:
  - changing observable behavior
  - adding new features
  - removing functionality
  - executing code
  - writing files

# Runtime policies
policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

# Tool policies
tools:
  policy: deny_by_default
  allowed: []
  denied:
    - write_file
    - shell
    - network
    - code_interpreter

# Overflow policy
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

# Enum policy
enums:
  strategy: extensible

# Failure contract
failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

# Runtime requirements
runtime_requirements:
  structured_output: true
  max_input_tokens: 8000
  preferred_capabilities:
    - json_mode
    - long_context

# IO Schemas
io:
  input: ./schema.json#/input
  data: ./schema.json#/data
  meta: ./schema.json#/meta
  error: ./schema.json#/error

# Compatibility configuration
compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
  schema_output_alias: data  # Allow schema to use "output" or "data"

# Test cases
tests:
  - tests/case1.input.json -> tests/case1.expected.json
  - tests/case2.input.json -> tests/case2.expected.json
```

---

## 2. Envelope v2.2: Unified Response Envelope

### 2.1 Design Principles

**Control Plane (meta)**: Cross-module unified, minimum info for routing/policy
**Data Plane (data)**: Business payload, module-specific

```
┌─────────────────────────────────────────┐
│  Envelope                               │
│  ┌───────────────────────────────────┐  │
│  │  meta (Control Plane)             │  │
│  │  - confidence, risk, explain      │  │
│  │  - trace_id, model, latency_ms    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  data (Data Plane)                │  │
│  │  - Business fields                │  │
│  │  - rationale (detailed reasoning) │  │
│  │  - extensions (overflow insights) │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 Success Response

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.86,
    "risk": "low",
    "explain": "Behavior equivalence guaranteed; changes are local and mechanical.",
    "trace_id": "abc-123",
    "model": "gpt-4o",
    "latency_ms": 1234
  },
  "data": {
    "simplified_code": "...",
    "changes": [...],
    "behavior_equivalence": true,
    "rationale": "Detailed explanation of each simplification decision...",
    "extensions": {
      "insights": [...]
    }
  }
}
```

### 2.3 Failure Response (Error Union)

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.62,
    "risk": "medium",
    "explain": "Equivalence cannot be guaranteed without assumptions about input types.",
    "trace_id": "abc-123"
  },
  "error": {
    "code": "BEHAVIOR_CHANGE_REQUIRED",
    "message": "Simplification would change semantics if x is non-boolean."
  },
  "partial_data": {
    "simplified_code": "...",
    "changes": [...]
  }
}
```

### 2.4 meta Field Specification (Normative)

A conforming response envelope MUST include the `meta` object. The following requirements apply:

#### Required Fields

1. **confidence** (number)
   - MUST be present in all responses
   - MUST be a number in the range [0, 1] inclusive
   - MUST represent the module's self-assessed confidence in meeting the declared contract
   - MUST NOT be interpreted as a calibrated probability of correctness

2. **risk** (string)
   - MUST be present in all responses
   - MUST be one of: `"none"`, `"low"`, `"medium"`, `"high"`
   - SHOULD be computed using the aggregation rule specified in module.yaml
   - If no rule is specified, implementations SHOULD use `max(data.changes[*].risk)`

3. **explain** (string)
   - MUST be present in all responses
   - SHOULD NOT exceed 280 characters
   - Implementations MAY truncate to 280 characters during repair pass
   - MUST provide sufficient context for routing decisions

#### Optional Fields

4. **trace_id** (string)
   - MAY be included for distributed tracing
   - If present, SHOULD be a unique identifier for the request

5. **model** (string)
   - MAY be included to identify the LLM provider/model
   - If present, SHOULD follow the format `provider/model-name`

6. **latency_ms** (number)
   - MAY be included to report execution latency
   - If present, MUST be a non-negative number representing milliseconds

| Field | Type | Requirement | Description |
|-------|------|-------------|-------------|
| `confidence` | number [0,1] | MUST | Module's confidence in meeting contract |
| `risk` | enum | MUST | Aggregated risk: `"none"` \| `"low"` \| `"medium"` \| `"high"` |
| `explain` | string (≤280) | MUST | Brief explanation for control plane |
| `trace_id` | string | MAY | Distributed tracing ID |
| `model` | string | MAY | Provider/model identifier |
| `latency_ms` | number | MAY | Execution latency (milliseconds) |

#### confidence Semantic Definition

> **`meta.confidence` is the module's self-assessed confidence in meeting the declared contract, not a calibrated probability of correctness.**

That is: confidence represents the module's self-assessment of "output meets contract", not a calibrated probability of "result is correct".

| Scenario | confidence | Description |
|----------|------------|-------------|
| Normal execution, high certainty | 0.8-1.0 | Module is confident output meets contract |
| Normal execution, some uncertainty | 0.5-0.8 | Module has reasonable confidence |
| Invalid input (`INVALID_INPUT`) | 0.0 | Cannot execute, `explain` must indicate caller error |
| Execution failed | 0.0-0.5 | Module cannot complete task |

#### risk Aggregation Rules

**Default rule**: `meta.risk = max(data.changes[*].risk)` (if changes array exists)

**Module can override**: Declare custom rules in `module.yaml`:

```yaml
meta:
  risk_rule: max_changes_risk   # default
  # or: max_issues_risk, explicit, custom_function
```

| risk_rule | Description |
|-----------|-------------|
| `max_changes_risk` | `max(data.changes[*].risk)`, default |
| `max_issues_risk` | `max(data.issues[*].risk)`, for review modules |
| `explicit` | Module calculates, no aggregation |

If risk source field doesn't exist, default to `"medium"`

### 2.5 explain vs rationale (Normative)

| Field | Location | Length Limit | Purpose | Consumer |
|-------|----------|--------------|---------|----------|
| `meta.explain` | Control plane | ≤280 chars | Brief summary | Middleware, routing, card UI, logs |
| `data.rationale` | Data plane | Unlimited | Complete reasoning | Human review, audit, debug, archive |

**Requirements:**

1. A conforming success response MUST include both `meta.explain` AND `data.rationale`
2. `meta.explain` SHOULD NOT exceed 280 characters
3. `data.rationale` MUST provide complete reasoning sufficient for audit
4. Implementations SHOULD NOT truncate `data.rationale`
5. If `meta.explain` is missing, implementations MAY generate it from the first 200 characters of `data.rationale`

**Rationale for dual fields:**
- `explain` enables quick control plane decisions without parsing business data
- `rationale` preserves complete audit capability for compliance and debugging

---

## 3. Schema v2.2

### 3.1 schema.json File Structure

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  "meta": { /* meta schema */ },
  "input": { /* input schema */ },
  "data": { /* payload schema (business data) */ },
  "error": { /* error schema */ }
}
```

> **Compatibility**: If `output` field exists but no `data` field, runtime should treat `output` as alias for `data`.

### 3.2 meta Schema (Common, Reusable)

```json
{
  "type": "object",
  "required": ["confidence", "risk", "explain"],
  "properties": {
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score, unified across all modules"
    },
    "risk": {
      "type": "string",
      "enum": ["none", "low", "medium", "high"],
      "description": "Aggregated risk level: max(changes[*].risk)"
    },
    "explain": {
      "type": "string",
      "maxLength": 280,
      "description": "Short explanation for control plane (middleware, UI cards, logs)"
    },
    "trace_id": {
      "type": "string",
      "description": "Distributed tracing ID"
    },
    "model": {
      "type": "string",
      "description": "Provider and model identifier"
    },
    "latency_ms": {
      "type": "number",
      "minimum": 0,
      "description": "Execution latency in milliseconds"
    }
  }
}
```

### 3.3 data Schema (Module-Specific, Normative)

The data schema is defined by each module, with the following requirements:

**Required Properties:**

1. Every data schema MUST declare `rationale` as a required property
2. The `rationale` property MUST be of type `string`
3. The `rationale` value MUST NOT be empty for success responses

**Optional Properties:**

4. Data schemas SHOULD include an `extensions` property for overflow handling
5. Module-specific business fields MAY be added as needed
6. Implementations MUST validate data against the module's declared schema

```json
{
  "type": "object",
  "required": ["rationale"],
  "properties": {
    "rationale": {
      "type": "string",
      "minLength": 1,
      "description": "Detailed reasoning for audit and human review. MUST NOT be empty."
    },
    "extensions": {
      "$ref": "#/$defs/extensions"
    }
  }
}
```

### 3.4 extensions Schema (Recoverable Overflow)

```json
{
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
              "text": {
                "type": "string",
                "description": "The insight or observation"
              },
              "suggested_mapping": {
                "type": "string",
                "description": "Suggested field or enum to add to schema"
              },
              "evidence": {
                "type": "string",
                "description": "Supporting evidence for this insight"
              }
            }
          }
        }
      }
    }
  }
}
```

**Core mechanism**: `suggested_mapping` enables insights to be recovered into structure, driving schema evolution.

### 3.5 Extensible Enum Pattern

For enum fields that need extensibility (like `change.type`), use this pattern:

```json
{
  "type": {
    "oneOf": [
      {
        "type": "string",
        "enum": ["remove_redundancy", "improve_naming", "reduce_nesting", "extract_pattern", "simplify_logic", "other"]
      },
      {
        "type": "object",
        "required": ["custom", "reason"],
        "properties": {
          "custom": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32,
            "description": "Custom type not in predefined enum"
          },
          "reason": {
            "type": "string",
            "description": "Why this custom type is needed"
          }
        }
      }
    ]
  }
}
```

**Advantages**:
- ✅ Type safe (structure still verifiable)
- ✅ Expressive (allows new insights)
- ✅ Evolvable (custom can be tracked → added to enum)

---

## 4. Runtime Behavior Specification (Normative)

### 4.1 Schema Validation and Repair

```
LLM Output
    ↓
[Parse JSON]
    ↓ Fail → PARSE_ERROR (E1000)
[Validate Schema]
    ↓ Fail
[Repair Pass] ← Fix format only, don't change semantics
    ↓ Still fail → SCHEMA_VALIDATION_FAILED (E3001) + partial_data
    ↓ Success
[Return ok=true]
```

**Repair Pass Requirements:**

Implementations SHOULD implement a repair pass. When implemented, the following rules apply:

1. Implementations MAY fill missing `meta` fields with conservative defaults
2. Implementations MAY truncate `meta.explain` to 280 characters
3. Implementations MAY trim leading/trailing whitespace from string fields
4. Implementations MUST NOT modify business data semantics
5. Implementations MUST NOT invent new enum values
6. Implementations MUST NOT change field types
7. Implementations MUST NOT add fields that don't exist in the schema

If repair fails, implementations MUST return `E3001` (SCHEMA_VALIDATION_FAILED) with `partial_data` containing the original response.

### 4.2 Default Value Filling

When upgrading v2.1 payload to v2.2 envelope:

| Field | Default Source |
|-------|----------------|
| `meta.confidence` | Promote from `data.confidence`; if none, `0.5` |
| `meta.risk` | Aggregate from `data.changes[*].risk`; if none, `"medium"` |
| `meta.explain` | Truncate first 200 chars from `data.rationale`; if none, `"No explanation provided"` |

### 4.3 Three-Level Strictness Behavior

| schema_strictness | required fields | enum strategy | overflow.max_items |
|-------------------|-----------------|---------------|-------------------|
| `high` | Strict, all required | strict | 0 (disabled) |
| `medium` | Core required, auxiliary optional | extensible | 5 (default) |
| `low` | Minimum required | extensible | 20 (relaxed) |

> **Note**: `overflow.max_items` always has a value, there is no "unlimited". Modules can override defaults in `module.yaml`.

---

## 5. Error Code Specification (Normative)

For the complete error taxonomy with categories E1xxx-E4xxx, see [ERROR-CODES.md](./error-codes).

### 5.1 Standard Error Codes

Implementations MUST recognize the following standard error codes:

| Code | Description | Trigger Scenario |
|------|-------------|------------------|
| `PARSE_ERROR` / `E1000` | JSON parsing failed | LLM returned invalid JSON |
| `INVALID_INPUT` / `E1001` | Input validation failed | Input doesn't match input schema |
| `SCHEMA_VALIDATION_FAILED` / `E3001` | Schema validation failed (after repair) | Output doesn't match schema |
| `MODULE_NOT_FOUND` / `E4006` | Module doesn't exist | Requested module not installed |
| `INTERNAL_ERROR` / `E4000` | Internal error | Unexpected exception |

Module-specific codes (OPTIONAL):
| Code | Description | Trigger Scenario |
|------|-------------|------------------|
| `UNSUPPORTED_LANGUAGE` | Unsupported language | code-simplifier etc. modules |
| `NO_SIMPLIFICATION_POSSIBLE` | Cannot simplify | Code is already minimal |
| `BEHAVIOR_CHANGE_REQUIRED` | Behavior change required | Simplification would change semantics |

### 5.2 Error Response Requirements (Normative)

A conforming error response MUST satisfy:

1. The `error` object MUST include `code` (string)
2. The `error` object MUST include `message` (string)
3. The `error.code` SHOULD use standard codes or E-format codes
4. The `error.message` MUST be human-readable
5. The `error` object MAY include `recoverable` (boolean)
6. The `error` object MAY include `suggestion` (string)

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "Input validation failed: missing required field 'code'"
  },
  "error": {
    "code": "INVALID_INPUT",
    "message": "Human-readable description",
    "recoverable": true,
    "suggestion": "Provide the 'code' field in input"
  },
  "partial_data": null
}
```

**Confidence for Errors:**
- For `INVALID_INPUT` errors, `confidence` SHOULD be `0.0` (cannot execute)
- The `explain` field MUST clearly indicate whether the error is caller's fault or system failure
- This lets upstream systems distinguish "model failure" from "call error"

---

## 6. Migration Strategy (v2.1 → v2.2)

### 6.1 Compatibility Matrix

| v2.1 Field | v2.2 Location | Migration Method |
|------------|---------------|------------------|
| `data.confidence` | `meta.confidence` + `data.confidence` | Promote to meta, optionally keep in data |
| `data.rationale` | `data.rationale` | Unchanged |
| None | `meta.explain` | New, truncate from rationale or generate |
| None | `meta.risk` | New, aggregate from changes |
| `output` (schema) | `data` (schema) | Alias compatible |

### 6.2 module.yaml Compatibility Config

```yaml
compat:
  # Accept v2.1 format payload (data contains confidence)
  accepts_v21_payload: true
  
  # Runtime auto-wraps v2.1 payload to v2.2 envelope
  runtime_auto_wrap: true
  
  # "output" in schema.json treated as "data" alias
  schema_output_alias: data
```

### 6.3 Runtime Auto-Wrap Logic

```python
def wrap_v21_to_v22(v21_response: dict) -> dict:
    """Auto-wrap v2.1 response to v2.2 envelope"""
    
    if is_v22_envelope(v21_response):
        return v21_response  # Already v2.2 format
    
    # Extract or compute meta fields
    data = v21_response.get("data", v21_response)
    
    confidence = data.get("confidence", 0.5)
    rationale = data.get("rationale", "")
    
    # Aggregate risk
    changes = data.get("changes", [])
    risk_levels = {"none": 0, "low": 1, "medium": 2, "high": 3}
    max_risk = max((risk_levels.get(c.get("risk", "medium"), 2) for c in changes), default=2)
    risk = ["none", "low", "medium", "high"][max_risk]
    
    # Generate explain
    explain = rationale[:200] if rationale else "No explanation provided"
    
    return {
        "ok": True,
        "meta": {
            "confidence": confidence,
            "risk": risk,
            "explain": explain
        },
        "data": data
    }
```

### 6.4 Progressive Migration Steps

**Phase 1: Compatibility Mode (Recommended Immediate)**
1. Update runtime to support auto-wrap
2. Keep existing modules unchanged
3. New modules use v2.2 format

**Phase 2: Gradual Upgrade**
1. Update module.yaml to add `tier`, `overflow`, `enums`
2. Update schema.json to add `meta` schema
3. Update prompt.md to require `explain` output

**Phase 3: Full Migration**
1. Remove `compat` configuration
2. All modules use native v2.2 format

---

## 7. Complete Example: code-simplifier v2.2

### 7.1 module.yaml

```yaml
# Cognitive Module Manifest v2.2
name: code-simplifier
version: 2.2.0
responsibility: Simplify code while preserving behavior

tier: decision
schema_strictness: medium

excludes:
  - changing observable behavior
  - adding new features
  - removing functionality
  - executing code
  - writing files

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

tools:
  policy: deny_by_default
  allowed: []
  denied: [write_file, shell, network, code_interpreter]

overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible

failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

runtime_requirements:
  structured_output: true
  max_input_tokens: 8000
  preferred_capabilities: [json_mode, long_context]

io:
  input: ./schema.json#/input
  data: ./schema.json#/data
  meta: ./schema.json#/meta
  error: ./schema.json#/error

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
  schema_output_alias: data

tests:
  - tests/case1.input.json -> tests/case1.expected.json
  - tests/case2.input.json -> tests/case2.expected.json
```

### 7.2 schema.json

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "risk": { "type": "string", "enum": ["none", "low", "medium", "high"] },
      "explain": { "type": "string", "maxLength": 280 },
      "trace_id": { "type": "string" },
      "model": { "type": "string" },
      "latency_ms": { "type": "number", "minimum": 0 }
    }
  },
  
  "input": {
    "type": "object",
    "required": ["code"],
    "properties": {
      "code": {
        "type": "string",
        "description": "The code to simplify"
      },
      "language": {
        "type": "string",
        "description": "Programming language (auto-detected if not provided)"
      },
      "query": {
        "type": "string",
        "description": "Natural language instructions (optional)"
      },
      "options": {
        "type": "object",
        "properties": {
          "preserve_comments": { "type": "boolean", "default": true },
          "max_line_length": { "type": "integer", "default": 100 },
          "style_guide": { "type": "string" }
        }
      }
    }
  },
  
  "data": {
    "type": "object",
    "required": ["simplified_code", "changes", "behavior_equivalence", "summary", "rationale"],
    "properties": {
      "simplified_code": {
        "type": "string",
        "description": "The simplified version of the code"
      },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["type", "description", "scope", "risk"],
          "properties": {
            "type": {
              "oneOf": [
                {
                  "type": "string",
                  "enum": ["remove_redundancy", "improve_naming", "reduce_nesting", "extract_pattern", "simplify_logic", "other"]
                },
                {
                  "type": "object",
                  "required": ["custom", "reason"],
                  "properties": {
                    "custom": { "type": "string", "minLength": 1, "maxLength": 32 },
                    "reason": { "type": "string" }
                  }
                }
              ]
            },
            "description": { "type": "string" },
            "scope": {
              "type": "string",
              "enum": ["local", "function", "file", "project"]
            },
            "risk": {
              "type": "string",
              "enum": ["none", "low", "medium", "high"]
            },
            "before": { "type": "string" },
            "after": { "type": "string" }
          }
        }
      },
      "behavior_equivalence": {
        "type": "boolean",
        "description": "True ONLY if the simplified code behaves identically to the original"
      },
      "complexity_reduction": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Estimated reduction in complexity (percentage)"
      },
      "diff_unified": {
        "type": "string",
        "description": "Unified diff format for tooling integration"
      },
      "summary": {
        "type": "string",
        "description": "Brief description of what was simplified"
      },
      "rationale": {
        "type": "string",
        "description": "Detailed explanation of simplification decisions (for audit)"
      },
      "extensions": {
        "$ref": "#/$defs/extensions"
      }
    }
  },
  
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": {
        "type": "string",
        "enum": ["PARSE_ERROR", "UNSUPPORTED_LANGUAGE", "NO_SIMPLIFICATION_POSSIBLE", "BEHAVIOR_CHANGE_REQUIRED", "SCHEMA_VALIDATION_FAILED", "INTERNAL_ERROR"]
      },
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
              "suggested_mapping": { "type": "string" },
              "evidence": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### 7.3 Example Output

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Removed redundant variable and simplified conditional logic. Behavior equivalence guaranteed.",
    "trace_id": "req-abc-123",
    "model": "gpt-4o",
    "latency_ms": 1847
  },
  "data": {
    "simplified_code": "def process(x):\n    return x * 2 if x > 0 else 0",
    "changes": [
      {
        "type": "remove_redundancy",
        "description": "Removed unnecessary intermediate variable 'result'",
        "scope": "local",
        "risk": "none",
        "before": "result = x * 2\nreturn result",
        "after": "return x * 2"
      },
      {
        "type": "simplify_logic",
        "description": "Converted if-else block to ternary expression",
        "scope": "function",
        "risk": "low",
        "before": "if x > 0:\n    return x * 2\nelse:\n    return 0",
        "after": "return x * 2 if x > 0 else 0"
      }
    ],
    "behavior_equivalence": true,
    "complexity_reduction": 35,
    "summary": "Simplified function from 5 lines to 2 lines by removing redundancy and using ternary operator.",
    "rationale": "The original function used an unnecessary intermediate variable 'result' that was immediately returned. This was replaced with a direct return. The if-else block was also converted to a ternary expression since both branches are simple single-expression returns. These changes maintain identical behavior while improving readability and reducing cognitive load.",
    "extensions": {
      "insights": [
        {
          "text": "Function could benefit from type hints for better IDE support",
          "suggested_mapping": "changes.type.add_type_hints",
          "evidence": "No type annotations present on function parameters or return value"
        }
      ]
    }
  }
}
```

---

## 8. Paradigm-Level Benefits of v2.2

| # | Benefit | Description |
|---|---------|-------------|
| 1 | **Routing/fallback/review without parsing business payload** | Middleware only looks at `meta` |
| 2 | **Insights not killed by enum** | Recoverable overflow + extensible enum |
| 3 | **Different tiers have different strictness** | No more "one-size-fits-all schema" |
| 4 | **Failure and repair can be standardized** | Repair pass + `SCHEMA_VALIDATION_FAILED` |
| 5 | **Complete audit capability preserved** | `data.rationale` stores complete reasoning |
| 6 | **Ecosystem easier to grow** | Third parties only need to implement envelope + meta |
| 7 | **Smooth migration** | v2.1 modules don't need immediate modification |

---

## 9. Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| v0.1 | 2024 | Initial specification |
| v2.1 | 2024 | Envelope format, Failure Contract, Tools Policy |
| v2.2 | 2026-02 | Control/Data separation, Tier, Overflow, Extensible Enum, Migration strategy, Contract two-layer definition |
| v2.2.1 | 2026-02 | Added: Versioning Policy, Compatibility Matrix, Conformance Levels, Error Code Taxonomy, JSON Schemas, Test Vectors |

---

## 10. Normative References

| Reference | Description |
|-----------|-------------|
| [RFC 2119](https://tools.ietf.org/html/rfc2119) | Key words for use in RFCs |
| [JSON Schema Draft-07](https://json-schema.org/draft-07/json-schema-release-notes.html) | Schema validation |
| [Semantic Versioning 2.0](https://semver.org/) | Version numbering |

---

## License

MIT
