# MCP Server

Cognitive Modules 提供 MCP (Model Context Protocol) Server，让 Claude Code、Cursor 等 AI 工具可以原生使用 Cognitive Modules。

## 什么是 MCP？

MCP 是 Anthropic 提出的开放协议，让 AI 工具可以连接外部资源和工具。通过 MCP，Claude 可以直接调用 Cognitive Modules 进行代码审查、任务排序等操作。

## 安装

=== "Node.js (npm) - 推荐"

    ```bash
    # 全局安装
    npm install -g cogn

    # 或使用 npx
    npx cogn --help
    ```

=== "Python (pip)"

    ```bash
    pip install "cognitive-modules[mcp]"
    ```

## 启动 MCP Server

=== "Node.js"

    ```bash
    cog mcp
    ```

=== "Python"

    ```bash
    cog mcp
    ```

## 配置 Claude Desktop

编辑 Claude Desktop 配置文件：

=== "macOS"

    ```bash
    # 配置文件位置
    ~/Library/Application Support/Claude/claude_desktop_config.json
    ```

=== "Windows"

    ```bash
    # 配置文件位置
    %APPDATA%\Claude\claude_desktop_config.json
    ```

添加 Cognitive Modules MCP Server：

=== "Node.js (推荐)"

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

=== "Python"

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

重启 Claude Desktop 后，就可以使用 Cognitive Modules 了。

## 配置 Cursor

在 Cursor 设置中添加 MCP Server：

=== "Node.js (推荐)"

    ```json
    {
      "mcp.servers": {
        "cognitive": {
          "command": "cog",
          "args": ["mcp"]
        }
      }
    }
    ```

=== "Python"

    ```json
    {
      "mcp.servers": {
        "cognitive": {
          "command": "cog",
          "args": ["mcp"]
        }
      }
    }
    ```

## 可用的 Tools

MCP Server 暴露以下工具：

### cognitive_run

运行 Cognitive Module，获取结构化结果。

```
cognitive_run(
  module: "code-reviewer",
  args: "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"
)
```

返回：

```json
{
  "ok": true,
  "data": {
    "issues": [
      {"type": "security", "severity": "critical", "description": "SQL 注入"}
    ],
    "confidence": 0.95,
    "rationale": "检测到字符串拼接 SQL"
  }
}
```

### cognitive_list

列出所有已安装的模块。

```
cognitive_list()
```

返回：

```json
{
  "modules": [
    {"name": "code-reviewer", "location": "builtin", "format": "v1"},
    {"name": "task-prioritizer", "location": "builtin", "format": "v1"}
  ],
  "count": 2
}
```

### cognitive_info

获取模块详细信息。

```
cognitive_info(module: "code-reviewer")
```

返回：

```json
{
  "ok": true,
  "name": "code-reviewer",
  "version": "1.0.0",
  "description": "代码安全和质量审查",
  "responsibility": "分析代码并识别潜在问题"
}
```

## 在 Claude 中使用

配置完成后，在 Claude 中可以直接请求：

> "帮我审查这段代码的安全问题"

Claude 会自动调用 `cognitive_run("code-reviewer", ...)` 并返回结构化结果。

## 测试 MCP Server

使用 MCP Inspector 测试：

```bash
npx -y @modelcontextprotocol/inspector
```

然后连接到 `cog mcp` 启动的服务。

## 环境变量

MCP Server 需要配置 LLM API Key：

```json
{
  "mcpServers": {
    "cognitive": {
      "command": "cog",
      "args": ["mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx",
        "LLM_PROVIDER": "openai"
      }
    }
  }
}
```

支持的 Provider：

- `openai` - OpenAI GPT 系列
- `anthropic` - Claude 系列
- `minimax` - MiniMax
- `deepseek` - DeepSeek
- `ollama` - 本地模型

## 与 HTTP API 的区别

| 特性 | MCP Server | HTTP API |
|------|------------|----------|
| 协议 | stdio/SSE | HTTP REST |
| 客户端 | Claude/Cursor | 任意 HTTP 客户端 |
| 集成方式 | 原生集成 | API 调用 |
| 适用场景 | AI 工具内置 | 工作流平台 |

两者可以同时使用，根据场景选择。
