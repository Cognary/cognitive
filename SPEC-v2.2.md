# Cognitive Modules Specification v2.2

> **可验证的结构化 AI 任务规范 — 第二代增强版**

---

## 0. 核心设计目标

| # | 原则 | 说明 |
|---|------|------|
| 1 | **Contract-first** | 输入/输出/失败语义必须可验证 |
| 2 | **Control/Data Plane 分离** | 中间件无需解析业务 payload 即可路由 |
| 3 | **Strict where needed** | 按模块分级决定 schema 严格程度 |
| 4 | **Overflow but recoverable** | 允许"妙不可言的洞察"，但必须可回收 |
| 5 | **Enum extensible safely** | 类型安全不牺牲表达力 |

---

## 1. Module Manifest（module.yaml）

### 1.1 模块分级（Tier）

```yaml
tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low
```

**Tier 语义**：

| Tier | 用途 | Schema 严格度 | Overflow |
|------|------|---------------|----------|
| `exec` | 自动执行/落地（patch、审批、指令生成） | high | 关闭或受限 |
| `decision` | 判断/评估/分类（风险、边界、对比、审核） | medium | 开启，可回收 |
| `exploration` | 探索/调研/灵感生成 | low | 宽松 |

> **原则**：Tier 决定"允许表达的自由度"，而不是决定"模型聪明不聪明"。

### 1.2 溢出与回收（Overflow Policy）

```yaml
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | boolean | 是否允许 extensions.insights |
| `recoverable` | boolean | 洞察是否必须带 suggested_mapping |
| `max_items` | number | 最多允许几条洞察 |
| `require_suggested_mapping` | boolean | 是否强制要求映射建议 |

### 1.3 Enum 扩展策略

```yaml
enums:
  strategy: extensible   # strict | extensible
  unknown_tag: custom    # 未知 enum 的表示方式
```

| 策略 | 默认用于 | 说明 |
|------|----------|------|
| `strict` | exec 模块 | 只允许预定义的 enum 值 |
| `extensible` | decision/exploration | 允许 custom 扩展 |

### 1.4 完整 module.yaml 示例

```yaml
# Cognitive Module Manifest v2.2
name: code-simplifier
version: 2.2.0
responsibility: Simplify code while preserving behavior

# 模块分级
tier: decision
schema_strictness: medium

# 明确排除项
excludes:
  - changing observable behavior
  - adding new features
  - removing functionality
  - executing code
  - writing files

# 运行时策略
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
    - code_interpreter

# 溢出策略
overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

# Enum 策略
enums:
  strategy: extensible

# 失败契约
failure:
  contract: error_union
  partial_allowed: true
  must_return_error_schema: true

# 运行时要求
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

# 兼容性配置
compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
  schema_output_alias: data  # 允许 schema 用 "output" 或 "data"

# 测试用例
tests:
  - tests/case1.input.json -> tests/case1.expected.json
  - tests/case2.input.json -> tests/case2.expected.json
```

---

## 2. Envelope v2.2：统一返回信封

### 2.1 设计原则

**Control Plane（meta）**：跨模块统一，驱动路由/策略的最小信息
**Data Plane（data）**：业务 payload，模块特定

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
│  │  - 业务字段                        │  │
│  │  - rationale (详细推理)            │  │
│  │  - extensions (溢出洞察)           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 成功响应

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

### 2.3 失败响应（Error Union）

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

### 2.4 meta 字段规范

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `confidence` | number [0,1] | ✅ | 置信度，跨模块统一 |
| `risk` | enum | ✅ | 风险等级：`"none"` \| `"low"` \| `"medium"` \| `"high"` |
| `explain` | string | ✅ | 简短解释，≤280 chars，给中间件/日志/卡片 UI |
| `trace_id` | string | ❌ | 链路追踪 ID |
| `model` | string | ❌ | provider/model 标识 |
| `latency_ms` | number | ❌ | 执行耗时（毫秒） |

**risk 聚合规则**：`meta.risk = max(data.changes[*].risk)`

### 2.5 explain vs rationale

| 字段 | 位置 | 长度限制 | 用途 | 消费者 |
|------|------|----------|------|--------|
| `meta.explain` | 控制面 | ≤280 chars | 简短摘要 | 中间件、路由、卡片 UI、日志 |
| `data.rationale` | 数据面 | 无限制 | 完整推理过程 | 人工审核、审计、调试、存档 |

**两者必须共存**：
- `explain` 让控制面快速决策
- `rationale` 保留完整审计能力

---

## 3. Schema v2.2

### 3.1 schema.json 文件结构

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  "meta": { /* meta schema */ },
  "input": { /* input schema */ },
  "data": { /* payload schema (业务数据) */ },
  "error": { /* error schema */ }
}
```

> **兼容性**：如果存在 `output` 字段但无 `data` 字段，runtime 应将 `output` 视为 `data` 的别名。

### 3.2 meta Schema（通用，可复用）

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

### 3.3 data Schema（模块特定）

data schema 由各模块自行定义，但必须包含：

```json
{
  "type": "object",
  "required": ["rationale"],
  "properties": {
    "rationale": {
      "type": "string",
      "description": "Detailed reasoning for audit and human review"
    },
    "extensions": {
      "$ref": "#/$defs/extensions"
    }
  }
}
```

### 3.4 extensions Schema（可回收溢出）

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

**核心机制**：`suggested_mapping` 让洞察可以被回收到结构里，驱动 schema 演化。

### 3.5 Extensible Enum Pattern

对于需要扩展性的 enum 字段（如 `change.type`），使用以下模式：

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

**优势**：
- ✅ 类型安全（结构仍可验证）
- ✅ 表达力（允许新洞察）
- ✅ 可进化（custom 可被统计 → 纳入 enum）

---

## 4. Runtime 行为规范

### 4.1 Schema 验证与修复

```
LLM 输出
    ↓
[Parse JSON]
    ↓ 失败 → PARSE_ERROR
[Validate Schema]
    ↓ 失败
[Repair Pass] ← 只修格式，不改语义
    ↓ 仍失败 → SCHEMA_VALIDATION_FAILED + partial_data
    ↓ 成功
[Return ok=true]
```

**Repair Pass 规则**：
1. 补全缺失的 `meta` 字段（使用保守默认值）
2. 截断超长的 `explain`（保留前 280 字符）
3. 规范化 enum 值（大小写、空格）
4. **不修改业务语义**

### 4.2 默认值填充

当 v2.1 payload 升级到 v2.2 envelope 时：

| 字段 | 默认值来源 |
|------|------------|
| `meta.confidence` | 从 `data.confidence` 提升；若无则 `0.5` |
| `meta.risk` | 从 `data.changes[*].risk` 聚合；若无则 `"medium"` |
| `meta.explain` | 从 `data.rationale` 截取前 200 字符；若无则 `"No explanation provided"` |

### 4.3 三档严格度行为

| schema_strictness | required 字段 | enum 策略 | overflow |
|-------------------|---------------|-----------|----------|
| `high` | 严格，全部必填 | strict | 关闭 |
| `medium` | 核心必填，辅助可选 | extensible | 开启，max 5 |
| `low` | 最小必填 | extensible | 开启，无上限 |

---

## 5. 错误代码规范

### 5.1 标准错误代码

| Code | 说明 | 触发场景 |
|------|------|----------|
| `PARSE_ERROR` | JSON 解析失败 | LLM 返回非法 JSON |
| `SCHEMA_VALIDATION_FAILED` | Schema 验证失败（repair 后仍失败） | 输出不符合 schema |
| `INVALID_INPUT` | 输入验证失败 | 输入不符合 input schema |
| `MODULE_NOT_FOUND` | 模块不存在 | 请求的模块未安装 |
| `UNSUPPORTED_LANGUAGE` | 不支持的语言 | code-simplifier 等模块 |
| `NO_SIMPLIFICATION_POSSIBLE` | 无法简化 | 代码已是最简形式 |
| `BEHAVIOR_CHANGE_REQUIRED` | 需要行为变更 | 简化会改变语义 |
| `INTERNAL_ERROR` | 内部错误 | 未预期的异常 |

### 5.2 错误响应必须包含

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "..."
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  },
  "partial_data": null
}
```

---

## 6. 迁移策略（v2.1 → v2.2）

### 6.1 兼容性矩阵

| v2.1 字段 | v2.2 位置 | 迁移方式 |
|-----------|-----------|----------|
| `data.confidence` | `meta.confidence` + `data.confidence` | 提升到 meta，data 中可选保留 |
| `data.rationale` | `data.rationale` | 保持不变 |
| 无 | `meta.explain` | 新增，从 rationale 截取或生成 |
| 无 | `meta.risk` | 新增，从 changes 聚合 |
| `output` (schema) | `data` (schema) | 别名兼容 |

### 6.2 module.yaml 兼容配置

```yaml
compat:
  # 接受 v2.1 格式的 payload（data 内含 confidence）
  accepts_v21_payload: true
  
  # runtime 自动将 v2.1 payload 包装为 v2.2 envelope
  runtime_auto_wrap: true
  
  # schema.json 中 "output" 视为 "data" 的别名
  schema_output_alias: data
```

### 6.3 Runtime 自动包装逻辑

```python
def wrap_v21_to_v22(v21_response: dict) -> dict:
    """将 v2.1 响应自动包装为 v2.2 envelope"""
    
    if is_v22_envelope(v21_response):
        return v21_response  # 已经是 v2.2 格式
    
    # 提取或计算 meta 字段
    data = v21_response.get("data", v21_response)
    
    confidence = data.get("confidence", 0.5)
    rationale = data.get("rationale", "")
    
    # 聚合 risk
    changes = data.get("changes", [])
    risk_levels = {"none": 0, "low": 1, "medium": 2, "high": 3}
    max_risk = max((risk_levels.get(c.get("risk", "medium"), 2) for c in changes), default=2)
    risk = ["none", "low", "medium", "high"][max_risk]
    
    # 生成 explain
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

### 6.4 渐进式迁移步骤

**阶段 1：兼容模式（推荐立即实施）**
1. 更新 runtime 支持自动包装
2. 保持现有模块不变
3. 新模块使用 v2.2 格式

**阶段 2：逐步升级**
1. 更新 module.yaml 添加 `tier`, `overflow`, `enums`
2. 更新 schema.json 添加 `meta` schema
3. 更新 prompt.md 要求输出 `explain`

**阶段 3：完全迁移**
1. 移除 `compat` 配置
2. 所有模块使用原生 v2.2 格式

---

## 7. 完整示例：code-simplifier v2.2

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

### 7.3 示例输出

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

## 8. v2.2 带来的范式级收益

| # | 收益 | 说明 |
|---|------|------|
| 1 | **路由/降级/审核无需解析业务 payload** | 中间件只看 `meta` |
| 2 | **洞察不会被 enum 杀死** | 可回收 overflow + extensible enum |
| 3 | **不同 tier 模块有不同严谨度** | 不再"一刀切 schema" |
| 4 | **失败与修复可标准化** | repair pass + `SCHEMA_VALIDATION_FAILED` |
| 5 | **审计能力完整保留** | `data.rationale` 存储完整推理 |
| 6 | **生态更容易长大** | 第三方只需实现 envelope + meta |
| 7 | **平滑迁移** | v2.1 模块无需立即修改 |

---

## 9. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| v0.1 | 2024 | 初始规范 |
| v2.1 | 2024 | Envelope 格式、Failure Contract、Tools Policy |
| v2.2 | 2025 | Control/Data 分离、Tier、Overflow、Extensible Enum、迁移策略 |

---

## License

MIT
