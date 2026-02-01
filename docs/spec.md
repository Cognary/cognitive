# 规范文档

完整的 Cognitive Modules 规范请参阅项目文件：

- [SPEC-v2.2.md](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC-v2.2.md) - **v2.2 规范（最新）**
- [SPEC.md](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC.md) - v0.1 规范（历史）

---

## v2.2 快速概览

### 核心设计目标

1. **Contract-first** - 输入/输出/失败语义必须可验证
2. **Control/Data 分离** - 中间件无需解析业务 payload 即可路由
3. **Strict where needed** - 按模块分级决定 schema 严格程度
4. **Overflow but recoverable** - 允许"妙不可言的洞察"，但必须可回收
5. **Enum extensible safely** - 类型安全不牺牲表达力

### 核心概念

| 概念 | 说明 |
|------|------|
| `module.yaml` | 机器可读模块清单（v2.2） |
| `prompt.md` | 人类可读提示词 |
| `schema.json` | meta + input + data + error Schema |
| `tier` | 模块分级：exec / decision / exploration |
| `meta.explain` | 控制面简短解释（≤280字符） |
| `data.rationale` | 数据面详细推理（无限制） |
| `extensions.insights` | 可回收的溢出洞察 |

---

## 模块分级 (Tier)

| Tier | 用途 | Schema 严格度 | Overflow |
|------|------|:-------------:|:--------:|
| `exec` | 自动执行（patch、指令生成） | high | 关闭 |
| `decision` | 判断/评估/分类 | medium | 开启 |
| `exploration` | 探索/调研/灵感 | low | 开启 |

---

## v2.2 Envelope 格式

### 成功响应

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "简短摘要，用于快速路由（≤280字符）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理过程，用于审计（无限制）",
    "extensions": {
      "insights": [
        {
          "text": "额外洞察",
          "suggested_mapping": "建议添加到 schema 的字段"
        }
      ]
    }
  }
}
```

### 失败响应

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

---

## Control Plane vs Data Plane

| 层 | 字段 | 用途 | 限制 |
|---|------|------|------|
| **Control** | `meta.confidence` | 路由/降级决策 | 0-1 |
| **Control** | `meta.risk` | 人工审核触发 | none/low/medium/high |
| **Control** | `meta.explain` | 日志/卡片 UI | ≤280 chars |
| **Data** | `data.rationale` | 详细审计 | 无限制 |
| **Data** | `data.extensions` | 可回收洞察 | max 5 items |

**原则**：`meta` 不放业务细节；业务细节全部在 `data`。

---

## 可扩展 Enum

v2.2 支持 extensible enum pattern：

```json
{
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
  }
}
```

好处：

- **类型安全** - 结构仍可验证
- **表达力** - 允许新洞察
- **可进化** - custom 可被统计→纳入 enum

---

## 风险聚合

`meta.risk` 是聚合值，取所有子项的最大风险：

```
meta.risk = max(changes[*].risk, issues[*].risk, ...)
```

---

## 迁移到 v2.2

```bash
# 迁移单个模块
cogn migrate code-reviewer

# 迁移所有模块
cogn migrate --all

# 验证 v2.2 格式
cogn validate code-reviewer --v22
```

---

## 上下文哲学

> Cognitive trades conversational convenience for engineering certainty.

- ❌ 隐式上下文（对话历史自动叠加）
- ✅ 显式上下文（结构化、可验证）

详细信息请参阅 [上下文哲学](guide/context-philosophy.md)。
