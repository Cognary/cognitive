---
sidebar_position: 1
---

# 模块格式（v2.2）

推荐使用 v2.2 格式，v1 仍可兼容。

## 结构

```
my-module/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
```

## module.yaml 示例

```yaml
name: code-simplifier
version: 2.2.0
responsibility: simplify code while preserving behavior

excludes:
  - changing observable behavior
  - adding new features

tier: decision
schema_strictness: medium

constraints:
  no_network: true
  no_side_effects: true
  no_file_write: true
  no_inventing_data: true

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

tools:
  policy: deny_by_default
  allowed: []
  denied: [write_file, shell, network]

output:
  format: json_strict
  envelope: true
  require_confidence: true
  require_rationale: true

failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

runtime_requirements:
  structured_output: true
  max_input_tokens: 8000

overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true

meta_config:
  risk_rule: max_changes_risk

composition:
  pattern: sequential
  dataflow: []
```

## prompt.md

需明确要求 v2.2 envelope：

```markdown
Return ONLY valid JSON in v2.2 envelope format.
```

## schema.json

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  "input": { "type": "object" },
  "data": { "type": "object" },
  "meta": { "type": "object" },
  "error": { "type": "object" }
}
```

## 旧版 v1

```
my-module/
├── MODULE.md
└── schema.json
```

可使用 `npx cogn@2.2.12 migrate` 迁移到 v2.2。
