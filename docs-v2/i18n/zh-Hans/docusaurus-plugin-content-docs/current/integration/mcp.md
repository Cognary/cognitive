---
sidebar_position: 2
---

# MCP Server

面向 Claude Code / Cursor 等工具的 MCP 集成。

## 安装

```bash
npm install -g cogn@2.2.11
npm install @modelcontextprotocol/sdk
```

## 启动

```bash
npx cogn@2.2.11 mcp
```

## Claude Desktop 配置

```json
{
  "mcpServers": {
    "cognitive": {
      "command": "npx",
      "args": ["cogn@2.2.11", "mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx"
      }
    }
  }
}
```

## 工具列表

- `cognitive_run(module, args, provider?, model?)`
- `cognitive_list()`
- `cognitive_info(module)`

`cognitive_run` 返回 v2.2 envelope。错误同样使用 envelope 结构（`ok:false`, `meta`, `error`），并包含 `module`/`provider`（若无法解析则为 `"unknown"`）。
