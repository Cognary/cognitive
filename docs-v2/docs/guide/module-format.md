---
sidebar_position: 1
---

# Module Format (v2.2)

Cognitive Modules supports legacy v1, but **v2.2 is recommended**.

## v2.2 Structure

```
my-module/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
```

## module.yaml (v2.2)

```yaml
name: code-simplifier
version: 2.2.0
responsibility: simplify code while preserving behavior

# Required exclusions
excludes:
  - changing observable behavior
  - adding new features

# Tier and strictness
tier: decision                 # exec | decision | exploration
schema_strictness: medium      # high | medium | low

# Constraints (optional)
constraints:
  no_network: true
  no_side_effects: true
  no_file_write: true
  no_inventing_data: true

# Unified policies (optional)
policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

# Tool policy (optional)
tools:
  policy: deny_by_default
  allowed: []
  denied: [write_file, shell, network]

# Output contract (optional)
output:
  format: json_strict
  envelope: true
  require_confidence: true
  require_rationale: true

# Failure contract (optional)
failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

# Runtime requirements (optional)
runtime_requirements:
  structured_output: true
  max_input_tokens: 8000

# v2.2 extensions (optional)
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible          # strict | extensible

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true

meta_config:
  risk_rule: max_changes_risk   # max_changes_risk | max_issues_risk | explicit

# Composition (optional)
composition:
  pattern: sequential
  dataflow: []
```

## prompt.md

Human-readable instructions for the model. It should explicitly require the v2.2 envelope format:

```markdown
Return ONLY valid JSON in v2.2 envelope format.
```

## schema.json

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  "input": { "type": "object", "properties": { "query": { "type": "string" } } },
  "data": { "type": "object", "properties": { "rationale": { "type": "string" } } },
  "meta": { "type": "object", "properties": { "confidence": { "type": "number" } } },
  "error": { "type": "object", "properties": { "code": { "type": "string" } } }
}
```

## Legacy v1 Format

```
my-module/
├── MODULE.md
└── schema.json
```

Use `npx cogn@2.2.13 migrate` to upgrade to v2.2.
