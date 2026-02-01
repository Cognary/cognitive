# 模块格式

Cognitive Modules 支持三种格式，推荐使用 v2 格式。

## 格式对比

| 格式 | 文件 | 特点 | 状态 |
|------|------|------|------|
| **v2** | `module.yaml` + `prompt.md` + `schema.json` | 机器可读与人类可读分离，envelope 响应格式 | ✅ 推荐 |
| **v1** | `MODULE.md` + `schema.json` | 简单，适合快速原型 | ✅ 支持 |
| **v0** | 6 个文件 | 过于繁琐 | ⚠️ 废弃 |

---

## v2 格式（推荐）

```
my-module/
├── module.yaml     # 机器可读元数据
├── prompt.md       # 人类可读提示词
├── schema.json     # 输入/输出/错误契约
└── tests/          # Golden 测试
    ├── case1.input.json
    ├── case1.expected.json
    ├── case_error.input.json
    └── case_error.expected.json
```

### module.yaml

机器可读的模块清单（v2.1）：

```yaml
name: code-simplifier
version: 2.1.0
responsibility: simplify code while preserving behavior

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
  denied:
    - write_file
    - shell
    - network

# 输出契约
output:
  format: json_strict
  envelope: true  # 启用 {ok, data/error} 包装
  require:
    - confidence
    - rationale
    - behavior_equivalence

# 约束条件
constraints:
  behavior_equivalence_false_max_confidence: 0.7

# 失败契约
failure:
  contract: error_union  # 使用 {ok:false, error:{...}} 格式
  partial_allowed: true
  must_return_error_schema: true

# 运行时要求
runtime_requirements:
  structured_output: true
  max_input_tokens: 8000
  preferred_capabilities:
    - json_mode
    - long_context

# IO 引用
io:
  input: ./schema.json#/input
  output: ./schema.json#/output
  error: ./schema.json#/error

# 测试用例
tests:
  - tests/case1.input.json -> tests/case1.expected.json
  - tests/case_error.input.json -> tests/case_error.expected.json
```

#### 字段说明

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `name` | ✅ | 模块名（用于 `cog run <name>`）|
| `version` | ✅ | 语义化版本 |
| `responsibility` | ✅ | 一句话描述模块职责 |
| `excludes` | ✅ | 明确列出模块**不做**的事情 |
| `policies` | ❌ | 统一的策略命名空间 |
| `tools` | ❌ | 工具调用策略 |
| `output` | ❌ | 输出契约要求 |
| `constraints` | ❌ | 约束条件 |
| `failure` | ❌ | 失败处理契约 |
| `runtime_requirements` | ❌ | 运行时能力要求 |

---

## 响应格式（Envelope）

v2 格式使用统一的信封（Envelope）响应格式：

### 成功响应

```json
{
  "ok": true,
  "data": {
    "simplified_code": "...",
    "changes": [...],
    "behavior_equivalence": true,
    "summary": "...",
    "rationale": "...",
    "confidence": 0.95
  }
}
```

### 错误响应

```json
{
  "ok": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Unable to parse code"
  },
  "partial_data": null
}
```

### 带部分结果的错误

```json
{
  "ok": false,
  "error": {
    "code": "BEHAVIOR_CHANGE_REQUIRED",
    "message": "Simplification requires behavior change"
  },
  "partial_data": {
    "simplified_code": "...",
    "behavior_equivalence": false,
    "confidence": 0.6
  }
}
```

这种格式的好处：

- **一眼判断成功/失败**：检查 `ok` 字段
- **类型安全**：成功时有 `data`，失败时有 `error`
- **支持部分结果**：`partial_data` 用于 `failure.partial_allowed: true`

---

### prompt.md

人类可读的提示词：

```markdown
# Code Simplifier

You are a code simplification expert. Your task is to simplify code 
while **strictly preserving its observable behavior**.

## Critical Rules

1. If you cannot guarantee behavior equivalence, set `behavior_equivalence: false`
2. If `behavior_equivalence` is false, `confidence` must be <= 0.7

## Response Format (Envelope)

Wrap your response in the envelope format:
- Success: { "ok": true, "data": { ... } }
- Error: { "ok": false, "error": { "code": "...", "message": "..." } }

## Error Codes

- PARSE_ERROR: Code cannot be parsed
- UNSUPPORTED_LANGUAGE: Language not supported
- NO_SIMPLIFICATION_POSSIBLE: Code is already optimal
- BEHAVIOR_CHANGE_REQUIRED: Simplification requires behavior change
```

### schema.json

输入/输出的 JSON Schema 契约：

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v2.json",
  "input": {
    "type": "object",
    "required": ["code"],
    "properties": {
      "code": { "type": "string", "description": "Source code to simplify" },
      "language": { "type": "string" },
      "query": { "type": "string" }
    }
  },
  "output": {
    "type": "object",
    "required": ["simplified_code", "changes", "behavior_equivalence", "rationale", "confidence"],
    "properties": {
      "simplified_code": { "type": "string" },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["type", "description", "scope", "risk"],
          "properties": {
            "type": { "type": "string", "enum": ["remove_redundancy", "improve_naming", "reduce_nesting", "simplify_logic", "other"] },
            "description": { "type": "string" },
            "scope": { "type": "string", "enum": ["local", "function", "file", "project"] },
            "risk": { "type": "string", "enum": ["none", "low", "medium", "high"] }
          }
        }
      },
      "behavior_equivalence": { "type": "boolean" },
      "rationale": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  },
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "type": "string", "enum": ["PARSE_ERROR", "UNSUPPORTED_LANGUAGE", "NO_SIMPLIFICATION_POSSIBLE", "BEHAVIOR_CHANGE_REQUIRED"] },
      "message": { "type": "string" }
    }
  }
}
```

#### Schema 要点

| 要点 | 说明 |
|------|------|
| `changes.items.required` | 每个 change 必须有 type, description, scope, risk |
| `scope/risk` 有 `type: "string"` | 确保 JSON Schema 兼容性 |
| `error` 有 `required` | 错误必须有 code 和 message |

### tests/ 目录

Golden 测试用于验证模块契约：

#### 成功用例

```json
// tests/case1.input.json
{
  "code": "x = 1 + 2 + 3",
  "language": "python"
}
```

```json
// tests/case1.expected.json
{
  "$validate": {
    "ok": { "const": true },
    "data": {
      "required": ["simplified_code", "behavior_equivalence", "confidence"],
      "behavior_equivalence": true,
      "confidence_min": 0.8
    }
  }
}
```

#### 失败用例

```json
// tests/case_parse_error.input.json
{
  "code": "def broken(\n    # incomplete",
  "language": "python"
}
```

```json
// tests/case_parse_error.expected.json
{
  "$validate": {
    "ok": { "const": false },
    "error": {
      "required": ["code", "message"],
      "code": "PARSE_ERROR"
    }
  }
}
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
  no_side_effects: true
  require_confidence: true
  require_rationale: true
---

# 模块标题

模块说明...

## 输入

用户需求：$ARGUMENTS

## 输出要求

返回 JSON 包含：
- `result`: 结果
- `rationale`: 推理过程
- `confidence`: 置信度
```

!!! warning "v1 不支持 Envelope"
    v1 格式返回原始 JSON，不包装在 `{ok, data}` 中。
    建议新项目使用 v2 格式。

---

## v0 格式（废弃）

```
my-module/
├── module.md           # 元数据
├── input.schema.json   # 输入 Schema
├── output.schema.json  # 输出 Schema
├── constraints.yaml    # 约束
├── prompt.txt          # 指令
└── examples/
```

!!! danger "不推荐"
    v0 格式过于繁琐，仅为向后兼容保留。请迁移到 v2 格式。

---

## 格式检测

运行时自动检测格式：

```python
# 检测优先级
if exists("module.yaml"):
    format = "v2"
elif exists("MODULE.md"):
    format = "v1"
elif exists("module.md"):
    format = "v0"
```

---

## 验证

```bash
cog validate my-module
```

验证内容：

1. 模块文件存在且格式正确
2. schema.json 是有效的 JSON Schema
3. output.required 字段完整
4. changes.items 有 required 定义
5. (v2) Golden 测试通过
6. (v2) 失败用例覆盖所有 error.code
