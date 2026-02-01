# 模块格式

Cognitive Modules 支持三种格式，推荐使用 v2 格式。

## 格式对比

| 格式 | 文件 | 特点 | 状态 |
|------|------|------|------|
| **v2** | `module.yaml` + `prompt.md` + `schema.json` | 机器可读与人类可读分离 | ✅ 推荐 |
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
    └── case1.expected.json
```

### module.yaml

机器可读的模块清单：

```yaml
name: code-simplifier
version: 1.0.0
responsibility: simplify code while preserving behavior

excludes:
  - changing observable behavior
  - adding new features
  - removing functionality

constraints:
  no_network: true
  no_side_effects: true
  no_file_write: true

output:
  json_strict: true
  require_confidence: true
  require_rationale: true
  require_behavior_equivalence: true

tools:
  allowed: []

failure:
  must_return_error_schema: true
  partial_allowed: true
```

#### 字段说明

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `name` | ✅ | 模块名（用于 `cog run <name>`）|
| `version` | ✅ | 语义化版本 |
| `responsibility` | ✅ | 一句话描述模块职责 |
| `excludes` | ✅ | 明确列出模块**不做**的事情 |
| `constraints` | ❌ | 运行时约束 |
| `output` | ❌ | 输出契约要求 |
| `tools` | ❌ | 工具调用策略 |
| `failure` | ❌ | 失败处理契约 |

### prompt.md

人类可读的提示词：

```markdown
# Code Simplifier

You are a code simplification expert. Your task is to simplify code 
while **strictly preserving its observable behavior**.

## Critical Rule

If you cannot guarantee behavior equivalence, you MUST set 
`behavior_equivalence: false` and explain why in the rationale.

## Input

- `code`: The source code to simplify
- `language`: Programming language (optional)
- `query`: Specific simplification request (optional)

## Output Requirements

Return JSON with:
- `simplified`: The simplified code
- `changes`: Array of changes made (each with scope and risk)
- `behavior_equivalence`: true/false
- `rationale`: Your reasoning
- `confidence`: 0-1
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
      "query": { "type": "string" },
      "options": { "type": "object" }
    }
  },
  "output": {
    "type": "object",
    "required": ["simplified", "changes", "behavior_equivalence", "rationale", "confidence"],
    "properties": {
      "simplified": { "type": "string" },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "scope": { "enum": ["local", "function", "file", "project"] },
            "risk": { "enum": ["none", "low", "medium", "high"] }
          }
        }
      },
      "behavior_equivalence": { "type": "boolean" },
      "diff_unified": { "type": "string" },
      "rationale": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  },
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "enum": ["PARSE_ERROR", "UNSUPPORTED_LANGUAGE", "TOO_COMPLEX", "BEHAVIOR_UNCERTAIN"] },
      "message": { "type": "string" },
      "partial": { "type": "object" }
    }
  }
}
```

#### v2 schema 新增字段

| 字段 | 说明 |
|------|------|
| `behavior_equivalence` | 行为是否等价（布尔值）|
| `changes[].scope` | 变更影响范围：local/function/file/project |
| `changes[].risk` | 风险等级：none/low/medium/high |
| `diff_unified` | 可选的 unified diff 格式 |
| `error` | 错误时的标准输出格式 |

### tests/ 目录

Golden 测试用于验证模块契约：

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
  "_validate": {
    "required": ["simplified", "behavior_equivalence", "confidence"],
    "behavior_equivalence": true,
    "confidence_min": 0.8
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

### schema.json (v1)

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
  "input": {
    "type": "object",
    "properties": {
      "$ARGUMENTS": { "type": "string" }
    }
  },
  "output": {
    "type": "object",
    "required": ["result", "rationale", "confidence"],
    "properties": {
      "result": { ... },
      "rationale": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  }
}
```

!!! warning "v1 的 $ARGUMENTS"
    v1 格式中 `$ARGUMENTS` 是 CLI 概念，会污染模块 schema。
    v2 格式移除了这个字段，CLI 参数映射到 `input.code` 或 `input.query`。

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
3. 示例输入符合输入 Schema
4. 示例输出符合输出 Schema
5. (v2) Golden 测试通过
