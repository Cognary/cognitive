---
sidebar_position: 3
---

# 与 AI 工具集成

Cognitive Modules 可以与各种 AI 工具无缝集成。

## 推荐方式：MCP Server

MCP (Model Context Protocol) 是最佳集成方式，Claude Desktop、Cursor 等工具原生支持。

```bash
pip install "cognitive-modules[mcp]"
cog mcp
```

配置 Claude Desktop：

```json
{
  "mcpServers": {
    "cognitive": {
      "command": "cog",
      "args": ["mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx"
      }
    }
  }
}
```

详见 [MCP Server 文档](./mcp)。

## Cursor / VS Code

### 方式 1：MCP 集成（推荐）

配置 Cursor 的 MCP Server 后，直接在对话中使用：

```
帮我审查这段代码的安全问题
```

Cursor 会自动调用 `cognitive_run("code-reviewer", ...)`.

### 方式 2：直接对话

在 Cursor 中直接输入：

```
读取 ~/.cognitive/modules/code-reviewer/MODULE.md，
审查这段代码：

def login(u, p):
    return db.query(f"SELECT * FROM users WHERE name={u}")
```

### 方式 3：AGENTS.md 约定

在项目根目录创建 `AGENTS.md`：

```markdown
# 项目 AI 规范

## 代码审查

当需要审查代码时：
1. 读取 `~/.cognitive/modules/code-reviewer/MODULE.md`
2. 按 `schema.json` 格式输出
3. 必须包含 issues、summary、rationale、confidence
```

## Claude Desktop

### 方式 1：MCP Server（推荐）

配置 MCP Server 后，Claude 可以直接调用 Cognitive Modules。

### 方式 2：System Prompt

```
你可以使用以下 Cognitive Module：

1. code-reviewer - 代码审查
   读取 ~/.cognitive/modules/code-reviewer/MODULE.md

2. task-prioritizer - 任务排序
   读取 ~/.cognitive/modules/task-prioritizer/MODULE.md

使用时遵循模块中的指令和 schema。
```

## GitHub Copilot

在 `.github/copilot-instructions.md` 中：

```markdown
## 代码审查

使用 Cognitive Module 格式进行代码审查：
- 输出 JSON 格式
- 包含 issues 数组
- 每个 issue 有 severity、category、description、suggestion
- 包含 confidence 0-1
```

## 通用集成模式

```
用户请求
    ↓
AI 工具通过 MCP 调用 Cognitive Module
    ↓
按 schema.json 生成输出
    ↓
返回结构化结果
```

关键点：

1. **MCP 是首选方式**：原生支持，无需额外代码
2. MODULE.md 作为"可执行的规范"
3. schema.json 确保输出格式一致
