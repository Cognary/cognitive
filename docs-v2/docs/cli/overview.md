---
sidebar_position: 1
---

# CLI Overview (Node.js)

Cognitive Modules CLI is distributed via npm and provides the `cog` command.

## Installation

```bash
# Zero-install
npx cogn@2.2.7 --help

# Global
npm install -g cogn@2.2.7
# or: npm install -g cognitive-modules-cli@2.2.7
```

## Command List

| Command | Description |
|---------|-------------|
| `core <cmd>` | Minimal workflow: `new`, `run`, `schema`, `promote` |
| `list` | List installed modules |
| `run <module>` | Run a module |
| `pipe --module <name>` | Pipe mode (stdin/stdout) |
| `init [name]` | Initialize project or create module |
| `add <url>` | Install module from GitHub |
| `update <module>` | Update module to latest version |
| `versions <url>` | View available tags/versions |
| `remove <module>` | Remove module |
| `compose <module>` | Execute composed workflow |
| `compose-info <module>` | Show composition config |
| `validate <module>` | Validate a module |
| `migrate <module>` | Migrate module to v2.2 |
| `serve` | Start HTTP API server |
| `mcp` | Start MCP server |
| `doctor` | Environment check |

## Global Options

```bash
cog --version
cog --help
```

## Common Workflows

### 0. Minimal One-File Path

See [`cog core`](./core).

### 1. Run a Module

```bash
cog run code-reviewer --args "your code" --pretty
```

### 2. Create a Module

```bash
cog init my-module
cog validate my-module --v22
```

### 3. Install Modules from GitHub

```bash
cog add Cognary/cognitive -m code-simplifier
cog versions Cognary/cognitive
cog update code-simplifier
```

### 4. Compose Workflows

```bash
cog compose code-review-pipeline --args "code" --timeout 60000 --trace
cog compose-info code-review-pipeline
```
