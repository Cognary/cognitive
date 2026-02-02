---
sidebar_position: 2
---

# MCP Integration

Model Context Protocol (MCP) integration for Claude Desktop, Cursor, and other MCP-compatible tools.

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol for AI assistants to interact with external tools and resources.

## Starting MCP Server

```bash
# Default port (stdio mode for Claude Desktop)
cog mcp

# With specific port (HTTP mode)
cog mcp --port 3000

# With debug logging
cog mcp --debug
```

## Claude Desktop Setup

### 1. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "cognitive-modules": {
      "command": "cog",
      "args": ["mcp"]
    }
  }
}
```

Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### 2. Restart Claude Desktop

### 3. Use Modules

In Claude Desktop chat:
```
Please use the code-reviewer module to review this Python code:

def login(username, password):
    query = f"SELECT * FROM users WHERE name='{username}'"
    return db.execute(query)
```

## Cursor Setup

### 1. Add MCP Server

In Cursor settings, add custom MCP server:
- Command: `cog mcp --port 3000`
- Or configure in `.cursor/mcp.json`

### 2. Use in Chat

```
@cognitive Please run code-simplifier on the selected code
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `cognitive_run` | Run a module |
| `cognitive_list` | List available modules |
| `cognitive_info` | Get module details |
| `cognitive_validate` | Validate input |

## Example Interactions

### Code Review
```
User: Use code-reviewer to check this code for security issues
Claude: [Calls cognitive_run with code-reviewer module]
Result: Found SQL injection vulnerability...
```

### Task Prioritization
```
User: Help me prioritize these tasks using task-prioritizer:
- Fix login bug
- Write tests
- Update docs

Claude: [Calls cognitive_run with task-prioritizer]
Result: Prioritized list...
```

## Troubleshooting

### Server Not Found

```bash
# Check if cog is in PATH
which cog

# Or use full path in config
{
  "command": "/usr/local/bin/cog",
  "args": ["mcp"]
}
```

### Connection Issues

```bash
# Test MCP server manually
cog mcp --debug

# Check logs
tail -f ~/.cognitive/logs/mcp.log
```

### Module Not Found

```bash
# List installed modules
cog list

# Install missing module
cog add ziel-io/cognitive-modules -m code-reviewer
```
