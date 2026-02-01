# Cognitive Modules

> 可验证的结构化 AI 任务规范

Cognitive Modules 是一种 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

## 为什么选择 Cognitive Modules？

| 特性 | 传统 Prompt | Cognitive Modules |
|------|-------------|-------------------|
| 输入验证 | ❌ 无 | ✅ JSON Schema |
| 输出验证 | ❌ 无 | ✅ JSON Schema |
| 置信度 | ❌ 无 | ✅ 必须 0-1 |
| 推理过程 | ❌ 无 | ✅ 必须 rationale |
| 可测试 | ❌ 困难 | ✅ 示例验证 |
| 可复用 | ❌ 困难 | ✅ 模块化 |

## 核心特性

<div class="grid cards" markdown>

-   :material-check-all:{ .lg .middle } __强类型契约__

    ---

    JSON Schema 双向验证输入输出，确保数据结构正确

-   :material-brain:{ .lg .middle } __可解释输出__

    ---

    强制输出 `confidence` 和 `rationale`，知道 AI 为什么这样决策

-   :material-vector-link:{ .lg .middle } __子代理编排__

    ---

    `@call:module` 支持模块间调用，构建复杂工作流

-   :material-cloud-sync:{ .lg .middle } __多 LLM 支持__

    ---

    OpenAI / Anthropic / MiniMax / Ollama，随时切换

</div>

## 快速体验

```bash
# 安装
pip install cognitive-modules

# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 运行代码审查
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
```

输出示例：

```json
{
  "issues": [
    {
      "severity": "critical",
      "category": "security",
      "description": "SQL 注入漏洞",
      "suggestion": "使用参数化查询"
    }
  ],
  "confidence": 0.95,
  "rationale": "检测到 f-string 直接拼接用户输入到 SQL..."
}
```

## 下一步

- [安装指南](getting-started/installation.md) - 安装 Cognitive Modules
- [第一个模块](getting-started/first-module.md) - 创建你的第一个模块
- [模块库](modules/index.md) - 查看内置模块

