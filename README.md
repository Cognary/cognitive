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

- **Primary runtime**: Node.js CLI (`cognitive-modules-cli`, via `npx cogn@<version> ...`)

## Version

- **Runtime (npm)**: `2.2.13`
- **Spec**: v2.2

## Installation (Node.js)

```bash
# Zero-install quick start
npx cogn@2.2.13 --help

# Or use the full package name
npx cognitive-modules-cli@2.2.13 --help

# Global installation
npm install -g cogn@2.2.13
# or: npm install -g cognitive-modules-cli@2.2.13
```

> `cogn` is an alias package for `cognitive-modules-cli`. Docs use `npx cogn@<version> ...` as the canonical entrypoint.

## Registry Index ("Latest" Strategy)

By default, the CLI fetches the registry index from the **latest GitHub Release** asset:

- `https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json`

For reproducible builds, pin to a specific tag:

- `https://github.com/Cognary/cognitive/releases/download/vX.Y.Z/cognitive-registry.v2.json`

Override via:

- Env: `COGNITIVE_REGISTRY_URL`
- Env: `COGNITIVE_REGISTRY_TIMEOUT_MS` (ms)
- Env: `COGNITIVE_REGISTRY_MAX_BYTES`
- CLI: `--registry <url>`
- CLI: `--registry-timeout-ms <ms>`
- CLI: `--registry-max-bytes <n>`

## Quick Start

```bash
# Configure a provider (example: OpenAI)
export OPENAI_API_KEY=sk-xxx

# 5-minute path: run a one-file "Core" module from stdin (prints a v2.2 envelope)
cat <<'EOF' | npx cogn@2.2.13 core run --stdin --args "hello" --pretty
Return a valid v2.2 envelope (meta + data). Put your answer in data.result.
EOF
```

Notes:

- The recommended, unambiguous entrypoint is `npx cogn@2.2.13 ...` (avoids any `cog` binary conflicts on your machine).
- When passing `--provider/--model`, put them after the command, e.g. `... core run --stdin --provider minimax --model MiniMax-M2.1 ...`.
- If multiple provider API keys are set, the CLI auto-selects a provider by priority order. Use `--provider ...` (recommended) or `unset GEMINI_API_KEY` (etc.) to avoid surprises.

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
# Recommended (no global install needed):
# npx cogn@2.2.13 <command> ...

# Module management
npx cogn@2.2.13 list
npx cogn@2.2.13 add <url> --module <path>
npx cogn@2.2.13 update <module>
npx cogn@2.2.13 remove <module>
npx cogn@2.2.13 versions <url>

# Run modules
npx cogn@2.2.13 run <module> --args "..."
npx cogn@2.2.13 run <module> --input '{"query":"..."}'

# Composition
npx cogn@2.2.13 compose <module> --args "..."
npx cogn@2.2.13 compose-info <module>

# Validation & migration
npx cogn@2.2.13 validate <module> --v22
npx cogn@2.2.13 validate --all
npx cogn@2.2.13 migrate <module> --dry-run
npx cogn@2.2.13 migrate --all --no-backup

# Other
npx cogn@2.2.13 pipe --module <name>
npx cogn@2.2.13 init [name]
npx cogn@2.2.13 doctor
npx cogn@2.2.13 serve --port 8000
npx cogn@2.2.13 mcp
```

## Built-in Modules (Repository)

| Module | Tier | Function | Example |
|--------|------|----------|---------|
| `code-reviewer` | decision | Code review | `npx cogn@2.2.13 run code-reviewer --args "your code"` |
| `code-simplifier` | decision | Code simplification | `npx cogn@2.2.13 run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | Task priority sorting | `npx cogn@2.2.13 run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API design | `npx cogn@2.2.13 run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI spec generation | `npx cogn@2.2.13 run ui-spec-generator --args "e-commerce homepage"` |
| `ui-component-generator` | exploration | UI component spec | `npx cogn@2.2.13 run ui-component-generator --args "button component"` |
| `product-analyzer` | exploration | Product analysis | `npx cogn@2.2.13 run product-analyzer --args "health product"` |

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

## Provider Differences (Downgrade Is Expected)

Not every provider supports the same "native structured output / JSON Schema" features.

When a provider rejects native schemas (or only supports a subset), the runtime will safely downgrade `native -> prompt` and continue with prompt-only JSON plus post-validation. The decision is recorded in `meta.policy.*` for debugging and audit trails.

See `docs-v2/docs/integration/providers.md`.

Check config:

```bash
npx cogn@2.2.13 doctor
```

## Development (Node.js)

```bash
# Clone
git clone https://github.com/Cognary/cognitive.git
cd cognitive

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
| [cognitive-registry.v2.json](cognitive-registry.v2.json) | Default registry index (v2) tracked in `main` (tarballs use `releases/latest` strategy) |
| [spec/registry.schema.json](spec/registry.schema.json) | Registry index schema (v2) |
| [spec/registry-entry.schema.json](spec/registry-entry.schema.json) | Registry entry schema |

## License

MIT
