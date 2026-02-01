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
    <a href="https://github.com/leizii/cognitive-modules" class="md-button">
      GitHub
    </a>
  </p>
</div>

---

## ✨ 为什么选择 Cognitive Modules？

<div class="grid cards" markdown>

-   :material-check-all:{ .lg .middle } **强类型契约**

    ---

    JSON Schema 双向验证输入输出，确保数据结构正确，告别格式错误

    [:octicons-arrow-right-24: 了解模块格式](guide/module-format.md)

-   :material-brain:{ .lg .middle } **可解释输出**

    ---

    强制输出 `confidence` 和 `rationale`，知道 AI 为什么这样决策

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
    cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
    ```

**输出示例：**

```json
{
  "issues": [
    {
      "severity": "critical",
      "category": "security",
      "description": "SQL 注入漏洞：直接使用 f-string 拼接用户输入",
      "suggestion": "使用参数化查询"
    }
  ],
  "confidence": 0.95,
  "rationale": "检测到 f-string 直接拼接用户输入到 SQL 查询..."
}
```

---

## 📦 内置模块

| 模块 | 功能 | 命令 |
|------|------|------|
| :material-code-braces: **code-reviewer** | 代码审查 | `cog run code-reviewer --args "代码"` |
| :material-format-list-numbered: **task-prioritizer** | 任务排序 | `cog run task-prioritizer --args "任务列表"` |
| :material-api: **api-designer** | API 设计 | `cog run api-designer --args "资源名"` |
| :material-palette: **ui-spec-generator** | UI 规范 | `cog run ui-spec-generator --args "页面需求"` |

[:octicons-arrow-right-24: 查看所有模块](modules/index.md)

---

## 🔄 与 Skills 对比

| 特性 | Skills | Cognitive Modules |
|------|:------:|:-----------------:|
| 输入验证 | :material-close: | :material-check: JSON Schema |
| 输出验证 | :material-close: | :material-check: JSON Schema |
| 置信度 | :material-close: | :material-check: 必须 0-1 |
| 推理过程 | :material-close: | :material-check: 必须 rationale |
| 可测试 | :material-close: 困难 | :material-check: 示例验证 |
| 子代理 | :material-check: | :material-check: @call 语法 |
| 参数传递 | :material-check: | :material-check: $ARGUMENTS |

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

-   :material-file-document:{ .lg .middle } **规范文档**

    ---

    深入了解 Cognitive Modules 设计

    [:octicons-arrow-right-24: 阅读规范](spec.md)

</div>

