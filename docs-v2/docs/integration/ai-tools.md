---
sidebar_position: 3
---

# AI Tools Integration

Integrate Cognitive Modules with various AI development tools.

## Supported Tools

| Tool | Integration Method | Status |
|------|-------------------|--------|
| Claude Desktop | MCP Server | ✅ |
| Cursor | MCP Server | ✅ |
| VS Code | Extension (planned) | 🚧 |
| JetBrains | Plugin (planned) | 🚧 |

## Claude Desktop

### Setup

1. Start MCP server:
```bash
cog mcp
```

2. Configure Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "cognitive": {
      "command": "cog",
      "args": ["mcp"]
    }
  }
}
```

3. Restart Claude Desktop

### Usage

In Claude Desktop:
```
Use the code-reviewer module to review this code:
[paste code]
```

## Cursor

### Setup

1. Start MCP server:
```bash
cog mcp --port 3000
```

2. Add to Cursor settings

### Usage

In Cursor chat:
```
@cognitive run code-reviewer on the selected code
```

## Generic Integration

### HTTP API

Start HTTP server:
```bash
cog serve --port 8000 --cors
```

Call from any tool:
```bash
curl -X POST http://localhost:8000/api/run/code-reviewer \
  -H "Content-Type: application/json" \
  -d '{"code": "def foo(): pass"}'
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.send(JSON.stringify({
  type: 'run',
  module: 'code-reviewer',
  input: { code: '...' }
}));

ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log(result);
};
```

## Benefits

- **Structured Output** - Get predictable JSON responses
- **Validation** - Input/output automatically validated
- **Confidence** - Know how reliable the result is
- **Audit Trail** - Every call has rationale
