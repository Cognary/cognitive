---
hide:
  - navigation
  - toc
---

# Cognitive Modules

<div style="text-align: center; margin: 2rem 0;">
  <p style="font-size: 1.4rem; color: var(--md-default-fg-color--light);">
    🧠 可验证的结构化 AI 任务规范
  </p>
  <p>
    <a href="getting-started/installation/" class="md-button md-button--primary">
      快速开始
    </a>
    <a href="https://github.com/ziel-io/cognitive-modules" class="md-button">
      GitHub
    </a>
  </p>
</div>

---

## ✨ v2.2 新特性

<div class="grid cards" markdown>

-   :material-layers:{ .lg .middle } **Control/Data 分离**

    ---

    `meta` 控制面 + `data` 数据面，中间件无需解析业务即可路由

-   :material-stairs:{ .lg .middle } **模块分级 (Tier)**

    ---

    `exec` / `decision` / `exploration` 三级约束，按需选择

-   :material-lightbulb-on:{ .lg .middle } **可回收溢出**

    ---

    `extensions.insights` 保留 LLM 的额外洞察，不丢失灵感

-   :material-shield-check:{ .lg .middle } **可扩展 Enum**

    ---

    允许自定义类型值，不牺牲类型安全

</div>

---

## ✨ 核心特性

<div class="grid cards" markdown>

-   :material-check-all:{ .lg .middle } **强类型契约**

    ---

    JSON Schema 双向验证输入输出，确保数据结构正确

    [:octicons-arrow-right-24: 了解模块格式](guide/module-format.md)

-   :material-brain:{ .lg .middle } **可解释输出**

    ---

    `meta.explain` 快速决策 + `data.rationale` 详细审计

    [:octicons-arrow-right-24: 上下文哲学](guide/context-philosophy.md)

-   :material-vector-link:{ .lg .middle } **子代理编排**

    ---

    `@call:module` 支持模块间调用，构建复杂工作流

    [:octicons-arrow-right-24: 子代理指南](guide/subagent.md)

-   :material-cloud-sync:{ .lg .middle } **多 LLM 支持**

    ---

    OpenAI / Anthropic / MiniMax / Ollama，随时切换

    [:octicons-arrow-right-24: 配置 LLM](getting-started/llm-config.md)

</div>

---

## 🚀 快速体验

=== "安装"

    ```bash
    pip install cognitive-modules
    ```

=== "配置 LLM"

    ```bash
    export LLM_PROVIDER=openai
    export OPENAI_API_KEY=sk-xxx
    ```

=== "运行模块"

    ```bash
    cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
    ```

**v2.2 输出示例：**

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "high",
    "explain": "检测到 1 个严重安全问题：SQL 注入风险"
  },
  "data": {
    "issues": [
      {
        "severity": "critical",
        "category": "security",
        "description": "SQL 注入漏洞",
        "risk": "high"
      }
    ],
    "rationale": "代码使用 f-string 直接拼接用户输入到 SQL 查询，攻击者可构造恶意输入绕过认证..."
  }
}
```

---

## 📦 内置模块

| 模块 | Tier | 功能 | 命令 |
|------|:----:|------|------|
| :material-code-braces: **code-reviewer** | decision | 代码审查 | `cogn run code-reviewer --args "代码"` |
| :material-auto-fix: **code-simplifier** | decision | 代码简化 | `cogn run code-simplifier --args "代码"` |
| :material-format-list-numbered: **task-prioritizer** | decision | 任务排序 | `cogn run task-prioritizer --args "任务列表"` |
| :material-api: **api-designer** | decision | API 设计 | `cogn run api-designer --args "资源名"` |
| :material-palette: **ui-spec-generator** | exploration | UI 规范 | `cogn run ui-spec-generator --args "页面需求"` |
| :material-chart-bar: **product-analyzer** | exploration | 产品分析 | `cogn run product-analyzer --args "产品" -s` |

[:octicons-arrow-right-24: 查看所有模块](modules/index.md)

---

## 🔄 v2.2 响应格式

| 层 | 字段 | 用途 |
|---|------|------|
| **Control Plane** | `meta.confidence` | 路由/降级决策 |
| **Control Plane** | `meta.risk` | 人工审核触发 |
| **Control Plane** | `meta.explain` | 日志/卡片 UI（≤280字符） |
| **Data Plane** | `data.rationale` | 详细审计（无限制） |
| **Data Plane** | `data.extensions` | 可回收洞察 |

---

## 🔄 与 Skills 对比

| 特性 | Skills | Cognitive Modules |
|------|:------:|:-----------------:|
| 输入验证 | :material-close: | :material-check: JSON Schema |
| 输出验证 | :material-close: | :material-check: JSON Schema |
| 置信度 | :material-close: | :material-check: meta.confidence |
| 推理过程 | :material-close: | :material-check: data.rationale |
| Control/Data 分离 | :material-close: | :material-check: meta + data |
| 可测试 | :material-close: 困难 | :material-check: Golden 测试 |
| 子代理 | :material-check: | :material-check: @call 语法 |

---

## 📚 下一步

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **安装指南**

    ---

    5 分钟完成安装和配置

    [:octicons-arrow-right-24: 开始安装](getting-started/installation.md)

-   :material-book-open-variant:{ .lg .middle } **第一个模块**

    ---

    创建你的第一个 Cognitive Module

    [:octicons-arrow-right-24: 创建模块](getting-started/first-module.md)

-   :material-puzzle:{ .lg .middle } **集成指南**

    ---

    与 Cursor、Codex、Claude 集成

    [:octicons-arrow-right-24: 了解集成](integration/ai-tools.md)

-   :material-file-document:{ .lg .middle } **v2.2 规范**

    ---

    深入了解 Control/Data 分离设计

    [:octicons-arrow-right-24: 阅读规范](spec.md)

</div>
