---
sidebar_position: 1
---

# Cognitive Modules

> **可验证的结构化 AI 任务规范**

Cognitive Modules 是一套用于 **结构化、可验证、可审计** AI 任务的规范与运行时。

---

## v2.2 亮点

| 特性 | 说明 |
|------|------|
| **控制/数据分离** | `meta` 控制面 + `data` 业务面 |
| **模块分层** | `exec` / `decision` / `exploration` |
| **可恢复溢出** | `extensions.insights` 保存额外洞察 |
| **可扩展枚举** | 支持自定义值且不破坏类型安全 |
| **修复通道** | 自动修复常见 envelope 格式问题 |

---

## 快速开始

```bash
# 零安装
npx cogn@2.2.7 run code-reviewer --args "your code" --pretty

# 全局安装
npm install -g cogn@2.2.7
```

运行第一个模块：

```bash
export OPENAI_API_KEY=sk-xxx

cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 启动 HTTP 服务
cog serve --port 8000

# 启动 MCP Server（Claude Code / Cursor）
cog mcp
```

如果你希望“协议化”，但只在需要时才引入复杂度：

- [渐进复杂（升级触发器）](./getting-started/progressive-complexity)
- [Killer Use Case](./getting-started/use-cases)

---

## 核心特性

- **强类型契约** - JSON Schema 校验
- **可解释输出** - `meta.explain` + `data.rationale`
- **模块分层** - `exec | decision | exploration`
- **子代理编排** - `@call:module`
- **组合执行** - 顺序/并行/条件/迭代
- **HTTP API & MCP** - 一线集成能力

---

## v2.2 响应格式

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "用于快速路由的简短摘要（≤280 字）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理过程",
    "extensions": {
      "insights": [
        {
          "text": "额外洞察",
          "suggested_mapping": "建议加入 schema 的字段"
        }
      ]
    }
  }
}
```

---

## 内置模块（仓库内）

| 模块 | 层级 | 功能 | 示例 |
|------|------|------|------|
| `code-reviewer` | decision | 代码审查 | `cog run code-reviewer --args "your code"` |
| `code-simplifier` | decision | 代码简化 | `cog run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | 任务优先级排序 | `cog run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API 设计 | `cog run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI 规范生成 | `cog run ui-spec-generator --args "e-commerce homepage"` |
| `ui-component-generator` | exploration | UI 组件规范 | `cog run ui-component-generator --args "button component"` |

---

## 下一步

- [安装](./getting-started/installation)
- [第一个模块](./getting-started/first-module)
- [模块格式](./guide/module-format)
- [CLI 参考](./cli/overview)
- [一致性中心](./conformance)
- [Registry 与分发](./registry)
- [发布说明](./release-notes)
- [社区](./community/contributing)
- [规范](./spec)
- [集成](./integration/ai-tools)
