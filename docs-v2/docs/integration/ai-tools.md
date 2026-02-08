---
sidebar_position: 3
---

# Integrating with AI Tools

Recommended path: **MCP Server**.

## Cursor / Claude Code

1. Install and start MCP server:

```bash
npm install -g cogn@2.2.13
npm install @modelcontextprotocol/sdk
npx cogn@2.2.13 mcp
```

2. Configure your tool to call MCP server `cognitive`.

The tool can call:
- `cognitive_run(module, args, provider?, model?)`
- `cognitive_list()`
- `cognitive_info(module)`

## HTTP-based Tools (n8n / Dify / Coze)

Use `npx cogn@2.2.13 serve` and call `POST /run`.

```bash
npx cogn@2.2.13 serve --port 8000
```

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"module":"task-prioritizer","args":"fix bug, write docs"}'
```
