---
sidebar_position: 1
---

# Module Format

Cognitive Modules supports three formats, with **v2.2** being recommended.

## Format Comparison

| Format | Files | Features | Status |
|--------|-------|----------|--------|
| **v2.2** | `module.yaml` + `prompt.md` + `schema.json` | Control/Data separation, Tier, Extensible Enum | ✅ **Recommended** |
| **v2.1** | `module.yaml` + `prompt.md` + `schema.json` | Envelope format, no meta separation | ✅ Supported |
| **v1** | `MODULE.md` + `schema.json` | Simple, good for quick prototyping | ✅ Supported |
| **v0** | 6 files | Too complex | ⚠️ Deprecated |

---

## v2.2 Format (Recommended)

```
my-module/
├── module.yaml     # Machine-readable metadata (with tier/overflow/enums)
├── prompt.md       # Human-readable prompt
├── schema.json     # meta + input + data + error contract
└── tests/          # Golden tests
    ├── case1.input.json
    └── case1.expected.json
```

### module.yaml (v2.2)

```yaml
# Cognitive Module Manifest v2.2
name: code-simplifier
version: 2.2.0
responsibility: simplify code while preserving behavior

# Module tier
tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low

# Explicitly excluded behaviors
excludes:
  - changing observable behavior
  - adding new features
  - removing functionality

# Unified policy namespace
policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

# Tool policy
tools:
  policy: deny_by_default
  allowed: []
  denied: [write_file, shell, network]

# Overflow and recovery (v2.2)
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

# Enum extension strategy (v2.2)
enums:
  strategy: extensible   # strict | extensible

# Failure contract
failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

# Runtime requirements
runtime_requirements:
  structured_output: true
  max_input_tokens: 8000
  preferred_capabilities: [json_mode]

# IO references (v2.2 uses data instead of output)
io:
  input: ./schema.json#/input
  data: ./schema.json#/data
  meta: ./schema.json#/meta
  error: ./schema.json#/error

# Compatibility config (v2.2)
compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
  schema_output_alias: data

# Test cases
tests:
  - tests/case1.input.json -> tests/case1.expected.json
```

#### Field Reference

| Field | Required | Description |
|-------|:--------:|-------------|
| `name` | ✅ | Module name (for `cogn run <name>`) |
| `version` | ✅ | Semantic version |
| `responsibility` | ✅ | One-sentence description of module responsibility |
| `tier` | ✅ | Module tier: exec / decision / exploration |
| `schema_strictness` | ❌ | Validation strictness: high / medium / low |
| `excludes` | ✅ | Explicitly list what module **doesn't do** |
| `overflow` | ❌ | Overflow insights config |
| `enums` | ❌ | Enum extension strategy |
| `compat` | ❌ | Migration compatibility config |

---

### Tier Reference

| Tier | Use Case | Schema Strictness | Overflow | Typical Modules |
|------|----------|:-----------------:|:--------:|-----------------|
| `exec` | Auto-execution | high | off | patch generation, approval commands |
| `decision` | Judgment/evaluation | medium | on | code review, API design |
| `exploration` | Creative exploration | low | on | UI specs, product analysis |

---

## Response Format (v2.2 Envelope)

v2.2 uses a Control/Data separated envelope format:

### Success Response

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "low",
    "explain": "Brief summary for quick routing (≤280 chars)"
  },
  "data": {
    "simplified_code": "...",
    "changes": [...],
    "behavior_equivalence": true,
    "rationale": "Detailed reasoning for audit...",
    "extensions": {
      "insights": [...]
    }
  }
}
```

### Error Response

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.6,
    "risk": "medium",
    "explain": "Cannot guarantee behavior equivalence"
  },
  "error": {
    "code": "BEHAVIOR_CHANGE_REQUIRED",
    "message": "Simplification requires changing code semantics"
  },
  "partial_data": { ... }
}
```

### Control vs Data Plane

| Layer | Field | Purpose |
|-------|-------|---------|
| **Control** | `meta.confidence` | Routing/degradation decisions |
| **Control** | `meta.risk` | Human review trigger |
| **Control** | `meta.explain` | Logs/card UI (≤280 chars) |
| **Data** | `data.rationale` | Detailed audit (no limit) |
| **Data** | `data.extensions` | Recoverable insights |

---

### prompt.md (v2.2)

Human-readable prompt that must include v2.2 envelope instructions:

```markdown
# Code Simplifier

You are a code simplification expert...

## Response Format (Envelope v2.2)

You MUST wrap your response in the v2.2 envelope format:

### meta (Control Plane)
- `confidence`: 0-1, for routing decisions
- `risk`: Aggregated from changes: "none" | "low" | "medium" | "high"
- `explain`: Short summary (≤280 chars) for middleware/UI

### data (Data Plane)
- Business fields...
- `rationale`: Detailed explanation for audit (no limit)
- `extensions.insights`: Array of overflow observations (max 5)

## Critical Rules

1. `meta.risk = max(changes[*].risk)` (aggregate highest risk)
2. If `behavior_equivalence` is false, `confidence` must be <= 0.7
```

### schema.json (v2.2)

Contains `meta` + `input` + `data` + `error` contract:

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v2.2.json",
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "risk": { "type": "string", "enum": ["none", "low", "medium", "high"] },
      "explain": { "type": "string", "maxLength": 280 }
    }
  },
  "input": {
    "type": "object",
    "required": ["code"],
    "properties": {
      "code": { "type": "string" },
      "language": { "type": "string" }
    }
  },
  "data": {
    "type": "object",
    "required": ["simplified_code", "changes", "rationale"],
    "properties": {
      "simplified_code": { "type": "string" },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "oneOf": [
                { "type": "string", "enum": ["remove_redundancy", "simplify_logic"] },
                {
                  "type": "object",
                  "required": ["custom", "reason"],
                  "properties": {
                    "custom": { "type": "string", "maxLength": 32 },
                    "reason": { "type": "string" }
                  }
                }
              ]
            },
            "risk": { "type": "string", "enum": ["none", "low", "medium", "high"] }
          }
        }
      },
      "rationale": { "type": "string" },
      "extensions": { "$ref": "#/$defs/extensions" }
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

---

## Extensible Enums

v2.2 supports the extensible enum pattern, allowing predefined values or custom extensions:

```json
{
  "type": {
    "oneOf": [
      { "type": "string", "enum": ["remove_redundancy", "simplify_logic", "other"] },
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

Valid value examples:

- `"remove_redundancy"` - Predefined value
- `{ "custom": "inline_callback", "reason": "Converted callback to arrow function" }` - Custom extension

---

## Migrating to v2.2

```bash
# Migrate single module
cogn migrate code-reviewer

# Preview changes
cogn migrate code-reviewer --dry-run

# Migrate all modules
cogn migrate --all

# Validate v2.2 format
cogn validate code-reviewer --v22
```

---

## v1 Format (Simplified)

```
my-module/
├── MODULE.md       # Metadata + instructions
├── schema.json     # Input/output Schema
└── examples/       # Optional
```

### MODULE.md

```yaml
---
name: my-module
version: 1.0.0
responsibility: One-sentence description of module responsibility

excludes:
  - Thing not to do 1
  - Thing not to do 2

constraints:
  no_network: true
  require_confidence: true
  require_rationale: true
---

# Module Title

Module description...

## Output Requirements

Return JSON with:
- `result`: Result
- `rationale`: Reasoning
- `confidence`: Confidence score
```

:::warning v1 doesn't support Control/Data separation
v1 format returns `{ok, data}` but confidence is inside data. Recommend using v2.2 format for new projects.
:::

---

## Validation

```bash
# Standard validation
cogn validate my-module

# v2.2 strict validation
cogn validate my-module --v22
```

v2.2 validation checks:

1. `module.yaml` has tier/overflow/enums
2. `schema.json` has meta schema (with confidence/risk/explain)
3. `prompt.md` explains v2.2 envelope format
4. `meta.explain` has maxLength ≤280
5. `data` has rationale field
