---
sidebar_position: 2
---

# MCP Server

MCP (Model Context Protocol) integration for Claude Code, Cursor, etc.

## Install

```bash
npm install -g cogn@2.2.11
npm install @modelcontextprotocol/sdk
```

## Start

```bash
npx cogn@2.2.11 mcp
```

## Claude Desktop Config

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

## Tools

- `cognitive_run(module, args, provider?, model?)`
- `cognitive_list()`
- `cognitive_info(module)`

`cognitive_run` returns a v2.2 envelope. Errors use the same envelope structure (`ok:false`, `meta`, `error`) and include `module`/`provider` (set to `"unknown"` if not resolved).
