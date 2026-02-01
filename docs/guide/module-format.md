# 模块格式

Cognitive Modules 支持三种格式，推荐使用 **v2.2** 格式。

## 格式对比

| 格式 | 文件 | 特点 | 状态 |
|------|------|------|------|
| **v2.2** | `module.yaml` + `prompt.md` + `schema.json` | Control/Data 分离、Tier、可扩展 Enum | ✅ **推荐** |
| **v2.1** | `module.yaml` + `prompt.md` + `schema.json` | envelope 格式，无 meta 分离 | ✅ 支持 |
| **v1** | `MODULE.md` + `schema.json` | 简单，适合快速原型 | ✅ 支持 |
| **v0** | 6 个文件 | 过于繁琐 | ⚠️ 废弃 |

---

## v2.2 格式（推荐）

```
my-module/
├── module.yaml     # 机器可读元数据（含 tier/overflow/enums）
├── prompt.md       # 人类可读提示词
├── schema.json     # meta + input + data + error 契约
└── tests/          # Golden 测试
    ├── case1.input.json
    └── case1.expected.json
```

### module.yaml (v2.2)

```yaml
# Cognitive Module Manifest v2.2
name: code-simplifier
version: 2.2.0
responsibility: simplify code while preserving behavior

# 模块分级
tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low

# 明确排除的行为
excludes:
  - changing observable behavior
  - adding new features
  - removing functionality

# 统一的策略命名空间
policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
  code_execution: deny

# 工具策略
tools:
  policy: deny_by_default
  allowed: []
  denied: [write_file, shell, network]

# 溢出与回收（v2.2）
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

# Enum 扩展策略（v2.2）
enums:
  strategy: extensible   # strict | extensible

# 失败契约
failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

# 运行时要求
runtime_requirements:
  structured_output: true
  max_input_tokens: 8000
  preferred_capabilities: [json_mode]

# IO 引用（v2.2 使用 data 而非 output）
io:
  input: ./schema.json#/input
  data: ./schema.json#/data
  meta: ./schema.json#/meta
  error: ./schema.json#/error

# 兼容性配置（v2.2）
compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
  schema_output_alias: data

# 测试用例
tests:
  - tests/case1.input.json -> tests/case1.expected.json
```

#### 字段说明

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `name` | ✅ | 模块名（用于 `cogn run <name>`）|
| `version` | ✅ | 语义化版本 |
| `responsibility` | ✅ | 一句话描述模块职责 |
| `tier` | ✅ | 模块分级：exec / decision / exploration |
| `schema_strictness` | ❌ | 验证严格度：high / medium / low |
| `excludes` | ✅ | 明确列出模块**不做**的事情 |
| `overflow` | ❌ | 溢出洞察配置 |
| `enums` | ❌ | Enum 扩展策略 |
| `compat` | ❌ | 迁移兼容配置 |

---

### Tier 说明

| Tier | 用途 | Schema 严格度 | Overflow | 典型模块 |
|------|------|:-------------:|:--------:|----------|
| `exec` | 自动执行 | high | 关闭 | patch 生成、审批指令 |
| `decision` | 判断评估 | medium | 开启 | 代码审查、API 设计 |
| `exploration` | 探索创意 | low | 开启 | UI 规范、产品分析 |

---

## 响应格式（v2.2 Envelope）

v2.2 使用 Control/Data 分离的信封格式：

### 成功响应

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "low",
    "explain": "简短摘要，用于快速路由（≤280字符）"
  },
  "data": {
    "simplified_code": "...",
    "changes": [...],
    "behavior_equivalence": true,
    "rationale": "详细推理过程，用于审计...",
    "extensions": {
      "insights": [...]
    }
  }
}
```

### 错误响应

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.6,
    "risk": "medium",
    "explain": "无法保证行为等价性"
  },
  "error": {
    "code": "BEHAVIOR_CHANGE_REQUIRED",
    "message": "简化需要改变代码语义"
  },
  "partial_data": { ... }
}
```

### Control vs Data Plane

| 层 | 字段 | 用途 |
|---|------|------|
| **Control** | `meta.confidence` | 路由/降级决策 |
| **Control** | `meta.risk` | 人工审核触发 |
| **Control** | `meta.explain` | 日志/卡片 UI（≤280字符） |
| **Data** | `data.rationale` | 详细审计（无限制） |
| **Data** | `data.extensions` | 可回收洞察 |

---

### prompt.md (v2.2)

人类可读的提示词，需包含 v2.2 envelope 说明：

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

1. `meta.risk = max(changes[*].risk)` (聚合最高风险)
2. If `behavior_equivalence` is false, `confidence` must be <= 0.7
```

### schema.json (v2.2)

包含 `meta` + `input` + `data` + `error` 的契约：

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

## 可扩展 Enum

v2.2 支持 extensible enum pattern，允许预定义值或自定义扩展：

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

有效值示例：

- `"remove_redundancy"` - 预定义值
- `{ "custom": "inline_callback", "reason": "Converted callback to arrow function" }` - 自定义扩展

---

## 迁移到 v2.2

```bash
# 迁移单个模块
cogn migrate code-reviewer

# 预览变更
cogn migrate code-reviewer --dry-run

# 迁移所有模块
cogn migrate --all

# 验证 v2.2 格式
cogn validate code-reviewer --v22
```

---

## v1 格式（简化版）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
└── examples/       # 可选
```

### MODULE.md

```yaml
---
name: my-module
version: 1.0.0
responsibility: 一句话描述模块职责

excludes:
  - 不做的事情1
  - 不做的事情2

constraints:
  no_network: true
  require_confidence: true
  require_rationale: true
---

# 模块标题

模块说明...

## 输出要求

返回 JSON 包含：
- `result`: 结果
- `rationale`: 推理过程
- `confidence`: 置信度
```

!!! warning "v1 不支持 Control/Data 分离"
    v1 格式返回 `{ok, data}` 但 confidence 在 data 内部。
    建议新项目使用 v2.2 格式。

---

## 验证

```bash
# 标准验证
cogn validate my-module

# v2.2 严格验证
cogn validate my-module --v22
```

v2.2 验证检查：

1. `module.yaml` 有 tier/overflow/enums
2. `schema.json` 有 meta schema（含 confidence/risk/explain）
3. `prompt.md` 说明 v2.2 envelope 格式
4. `meta.explain` 有 maxLength ≤280
5. `data` 有 rationale 字段
