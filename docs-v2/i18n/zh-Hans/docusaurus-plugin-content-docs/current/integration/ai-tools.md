---
sidebar_position: 3
---

# 与 AI 工具集成

推荐使用 **MCP Server**。

## Cursor / Claude Code

```bash
npm install -g cogn@2.2.7
npm install @modelcontextprotocol/sdk
cog mcp
```

工具可调用：
- `cognitive_run(module, args, provider?, model?)`
- `cognitive_list()`
- `cognitive_info(module)`

## 工作流平台（n8n / Dify / Coze）

```bash
cog serve --port 8000
```

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"module":"task-prioritizer","args":"fix bug, write docs"}'
```
