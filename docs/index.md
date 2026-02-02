# Cognitive Modules

> **可验证的结构化 AI 任务规范**

Cognitive Modules 是一种 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

---

## ✨ v2.2 新特性

| 特性 | 说明 |
|------|------|
| **Control/Data 分离** | `meta` 控制面 + `data` 数据面，中间件无需解析业务 |
| **模块分级 (Tier)** | `exec` / `decision` / `exploration` 不同严格度 |
| **可回收溢出** | `extensions.insights` 保留 LLM 的额外洞察 |
| **可扩展 Enum** | 允许自定义类型，不牺牲类型安全 |
| **Repair Pass** | 自动修复格式问题，降低验证失败率 |

---

## 🚀 快速开始

### 安装

=== "Node.js (npm) - 推荐"

    ```bash
    # 零安装快速体验
    npx cogn run code-reviewer --args "your code" --pretty

    # 全局安装
    npm install -g cogn
    ```

=== "Python (pip)"

    ```bash
    pip install cognitive-modules
    ```

### 运行第一个模块

```bash
# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 运行代码审查（npm）
npx cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 或使用全局安装的 cog 命令
cog run code-reviewer --args "..."

# 启动 HTTP 服务
cog serve --port 8000

# 启动 MCP 服务（Claude Code / Cursor 集成）
cog mcp
```

---

## ✨ 核心特性

- **强类型契约** - JSON Schema 双向验证输入输出
- **可解释输出** - 强制输出 `confidence` + `rationale`
- **Control/Data 分离** - `meta.explain` 快速路由 + `data.rationale` 详细审计
- **模块分级** - exec / decision / exploration 不同约束等级
- **子代理编排** - `@call:module` 支持模块间调用
- **参数传递** - `$ARGUMENTS` 运行时替换
- **多 LLM 支持** - OpenAI / Anthropic / MiniMax / Ollama
- **公共注册表** - `cogn install registry:module-name`

---

## 🔄 v2.2 响应格式

所有模块现在返回统一的 v2.2 envelope 格式：

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "简短摘要，用于快速路由决策（≤280字符）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理过程，用于审计和人工审核",
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

### Control vs Data Plane

| 层 | 字段 | 用途 |
|---|------|------|
| **Control Plane** | `meta.confidence` | 路由/降级决策 |
| **Control Plane** | `meta.risk` | 人工审核触发 |
| **Control Plane** | `meta.explain` | 日志/卡片 UI |
| **Data Plane** | `data.rationale` | 详细审计 |
| **Data Plane** | `data.extensions` | 可回收洞察 |

---

## 📦 内置模块

| 模块 | Tier | 功能 | 示例 |
|------|------|------|------|
| `code-reviewer` | decision | 代码审查 | `cogn run code-reviewer --args "你的代码"` |
| `code-simplifier` | decision | 代码简化 | `cogn run code-simplifier --args "复杂代码"` |
| `task-prioritizer` | decision | 任务优先级排序 | `cogn run task-prioritizer --args "任务1,任务2"` |
| `api-designer` | decision | REST API 设计 | `cogn run api-designer --args "订单系统"` |
| `ui-spec-generator` | exploration | UI 规范生成 | `cogn run ui-spec-generator --args "电商首页"` |

---

## 🔄 与 Skills 对比

| 特性 | Cognitive Modules | Skills |
|------|-------------------|--------|
| **验证** | JSON Schema 双向验证 | 无强制验证 |
| **置信度** | 强制输出 confidence | 可选 |
| **审计** | rationale + explain 分离 | 单一说明 |
| **分级** | tier 决定严格度 | 无分级 |
| **溢出** | extensions.insights 可回收 | 无溢出机制 |

---

## 📚 下一步

- 📖 [安装指南](getting-started/installation.md) - 安装和配置
- 🎯 [第一个模块](getting-started/first-module.md) - 创建你的第一个模块
- 📋 [模块格式](guide/module-format.md) - 了解 v2.2 格式
- 🔧 [CLI 参考](cli/overview.md) - 命令行工具使用
- 📐 [规范文档](spec.md) - 完整规范说明
- 🔌 [集成指南](integration/ai-tools.md) - 与 AI 工具集成

---

## 💡 为什么选择 Cognitive Modules？

### 对开发者的收益

- ✅ **确定性** - 知道 AI 会返回什么结构
- ✅ **可复用** - 模块可以分享、安装、版本管理
- ✅ **可信任** - 有 confidence 和 risk 指示
- ✅ **可测试** - 模块有 Contract，可以写黄金测试

### 对 AI IDE 的收益

- ✅ **结构化输出** - 用户说"用 code-reviewer 模块审查"，直接按 schema 输出
- ✅ **可测试** - 模块有 Contract，可以写黄金测试
- ✅ **可审计** - 每次输出有 confidence + rationale
- ✅ **可编排** - 模块间可以安全组合（子代理）
- ✅ **零配置** - 用户只需一个模块目录，无需额外 API 调用

---

## 📄 License

MIT
