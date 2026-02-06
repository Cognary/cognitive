# Cognitive Modules

[![CI](https://github.com/Cognary/cognitive/actions/workflows/ci.yml/badge.svg)](https://github.com/Cognary/cognitive/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![npm downloads](https://img.shields.io/npm/dm/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Verifiable Structured AI Task Specification

English | [中文](README_zh.md)

Cognitive Modules is a specification and runtime for **verifiable, structured AI tasks** with strong contracts, auditability, and deterministic validation.

## Status

- **Primary runtime**: Node.js CLI (`cognitive-modules-cli`, command `cog`)
- **Python runtime**: legacy / not actively maintained

## Version

- **Runtime (npm)**: `2.2.5`
- **Python package (PyPI, legacy)**: `2.2.3` (intentional mismatch; independent cadence)
- **Spec**: v2.2

## Installation (Node.js)

```bash
# Zero-install quick start
npx cogn@2.2.5 --help

# Or use the full package name
npx cognitive-modules-cli@2.2.5 --help

# Global installation
npm install -g cogn@2.2.5
# or: npm install -g cognitive-modules-cli@2.2.5
```

> `cogn` is an alias package for `cognitive-modules-cli`. Both provide the same `cog` command.

## Quick Start

```bash
# Configure provider (example: OpenAI)
export OPENAI_API_KEY=sk-xxx

# Run code review
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# Run task prioritization
cog run task-prioritizer --args "fix bug(urgent), write docs, optimize performance" --pretty

# Run API design
cog run api-designer --args "order system CRUD API" --pretty

# Start HTTP service (API integration)
cog serve --port 8000

# Start MCP server (Claude Code / Cursor integration)
cog mcp
```

## v2.2 Response Format

All modules return the unified v2.2 envelope format:

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Brief summary for quick routing decisions (≤280 chars)"
  },
  "data": {
    "...business fields...",
    "rationale": "Detailed reasoning for audit and human review",
    "extensions": {
      "insights": [
        {
          "text": "Additional insight",
          "suggested_mapping": "Suggested field to add to schema"
        }
      ]
    }
  }
}
```

## Core Features

- **Strong type contracts** - JSON Schema validation for input/output
- **Control/Data separation** - `meta` for routing, `data` for business payloads
- **Module tiers** - `exec | decision | exploration` with strictness/overflow rules
- **Subagent orchestration** - `@call:module` for inter-module calls
- **Composition** - sequential/parallel/conditional/iterative workflows
- **HTTP API & MCP** - first-class integrations for workflows and AI tools
- **Repair pass** - auto-fix common envelope format issues

## CLI Commands

```bash
# Module management
cog list
cog add <url> --module <path>
cog update <module>
cog remove <module>
cog versions <url>

# Run modules
cog run <module> --args "..."
cog run <module> --input '{"query":"..."}'

# Composition
cog compose <module> --args "..."
cog compose-info <module>

# Validation & migration
cog validate <module> --v22
cog validate --all
cog migrate <module> --dry-run
cog migrate --all --no-backup

# Other
cog pipe --module <name>
cog init [name]
cog doctor
cog serve --port 8000
cog mcp
```

## Built-in Modules (Repository)

| Module | Tier | Function | Example |
|--------|------|----------|---------|
| `code-reviewer` | decision | Code review | `cog run code-reviewer --args "your code"` |
| `code-simplifier` | decision | Code simplification | `cog run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | Task priority sorting | `cog run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API design | `cog run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI spec generation | `cog run ui-spec-generator --args "e-commerce homepage"` |
| `ui-component-generator` | exploration | UI component spec | `cog run ui-component-generator --args "button component"` |
| `product-analyzer` | exploration | Product analysis | `cog run product-analyzer --args "health product"` |

## Module Format (v2.2)

```
my-module/
├── module.yaml     # Machine-readable manifest
├── prompt.md       # Human-readable prompt
├── schema.json     # meta + input + data + error schemas
└── tests/          # Golden test cases
```

Minimal `module.yaml`:

```yaml
name: my-module
version: 2.2.0
responsibility: One-line description

tier: decision                # exec | decision | exploration
schema_strictness: medium     # high | medium | low

excludes:
  - things not to do

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny

overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible        # strict | extensible

failure:
  contract: error_union
  partial_allowed: true

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
```

## LLM Configuration

Cognitive Modules auto-selects a provider based on which API key is present. You can override with `--provider` and `--model`.

Environment variables:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `MINIMAX_API_KEY`
- `MOONSHOT_API_KEY`
- `DASHSCOPE_API_KEY` or `QWEN_API_KEY`
- `OLLAMA_HOST` (for Ollama local)
- `COG_MODEL` (override default model)

Check config:

```bash
cog doctor
```

## Development (Node.js)

```bash
# Clone
git clone https://github.com/Cognary/cognitive.git
cd cognitive-modules

# Install
cd packages/cli-node
npm install

# Build
npm run build

# Test
npm test
```

## Documentation

### Specifications

| Document | Description |
|----------|-------------|
| [SPEC-v2.2.md](SPEC-v2.2.md) | v2.2 full specification |
| [SPEC-v2.2_zh.md](SPEC-v2.2_zh.md) | v2.2 规范中文版 |

### Implementers

| Document | Description |
|----------|-------------|
| [IMPLEMENTERS-GUIDE.md](IMPLEMENTERS-GUIDE.md) | How to build a runtime |
| [CONFORMANCE.md](CONFORMANCE.md) | Conformance levels |
| [ERROR-CODES.md](ERROR-CODES.md) | Standard error codes |
| [templates/runtime-starter/](templates/runtime-starter/) | Runtime starter template |

### Advanced

| Document | Description |
|----------|-------------|
| [COMPOSITION.md](COMPOSITION.md) | Composition and dataflow |
| [CONTEXT-PROTOCOL.md](CONTEXT-PROTOCOL.md) | Context protocol |
| [COGNITIVE-PROTOCOL.md](COGNITIVE-PROTOCOL.md) | Protocol details |
| [INTEGRATION.md](INTEGRATION.md) | Integration guide |

### Schemas & Test Vectors

| Resource | Description |
|----------|-------------|
| [spec/response-envelope.schema.json](spec/response-envelope.schema.json) | v2.2 envelope schema |
| [spec/module.yaml.schema.json](spec/module.yaml.schema.json) | module.yaml schema |
| [spec/test-vectors/](spec/test-vectors/) | Compliance test vectors |

### Registry (Spec Only)

| Resource | Description |
|----------|-------------|
| [REGISTRY-PROTOCOL.md](REGISTRY-PROTOCOL.md) | Registry protocol specification |
| [spec/registry-entry.schema.json](spec/registry-entry.schema.json) | Registry entry schema |

## License

MIT
