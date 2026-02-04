# Cognitive Modules

[![CI](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml/badge.svg)](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml)
[![PyPI version](https://badge.fury.io/py/cognitive-modules.svg)](https://pypi.org/project/cognitive-modules/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Verifiable Structured AI Task Specification

English | [中文](README_zh.md)

Cognitive Modules is an AI task definition specification designed for generation tasks that require **strong constraints, verifiability, and auditability**.

## What's New in v2.2

| Feature | Description |
|---------|-------------|
| **Control/Data Separation** | `meta` control plane + `data` data plane, middleware can route without parsing business logic |
| **Module Tiers** | `exec` / `decision` / `exploration` with different strictness levels |
| **Recoverable Overflow** | `extensions.insights` preserves LLM's additional insights |
| **Extensible Enums** | Allow custom types without sacrificing type safety |
| **Repair Pass** | Auto-fix formatting issues, reduce validation failures |

## Features

- **Strong Type Contracts** - JSON Schema bidirectional validation for input/output
- **Explainable Output** - Mandatory `confidence` + `rationale` output
- **Control/Data Separation** - `meta.explain` for quick routing + `data.rationale` for detailed audit
- **Module Tiers** - exec / decision / exploration with different constraint levels
- **Subagent Orchestration** - `@call:module` supports inter-module calls
- **Parameter Passing** - `$ARGUMENTS` runtime substitution
- **Multi-LLM Support** - OpenAI / Anthropic / MiniMax / Ollama
- **Public Registry** - `cogn install registry:module-name`

## Installation

### Node.js (npm) - Recommended

```bash
# Zero-install quick start (recommended)
npx cogn run code-reviewer --args "your code"

# Global installation
npm install -g cogn

# Or install with full package name
npm install -g cognitive-modules-cli
```

### Python (pip)

```bash
pip install cognitive-modules

# With LLM support
pip install cognitive-modules[openai]      # OpenAI
pip install cognitive-modules[anthropic]   # Claude
pip install cognitive-modules[all]         # All providers
```

| Platform | Package | Command | Features |
|----------|---------|---------|----------|
| **npm** | `cogn` | `cog` | ✅ Recommended, zero-install, full features |
| pip | `cognitive-modules` | `cogn` | ✅ Full features |

## Quick Start

```bash
# Configure LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Run code review (npm)
npx cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# Or use globally installed cog command
cog run code-reviewer --args "..." --pretty

# Run task prioritization
cog run task-prioritizer --args "fix bug(urgent), write docs, optimize performance" --pretty

# Run API design
cog run api-designer --args "user system CRUD API" --pretty

# Start HTTP service (API integration)
cog serve --port 8000

# Start MCP server (Claude Code / Cursor integration)
cog mcp
```

## v2.2 Response Format

All modules now return the unified v2.2 envelope format:

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

### Control vs Data Plane

| Layer | Field | Purpose |
|-------|-------|---------|
| **Control Plane** | `meta.confidence` | Routing/fallback decisions |
| **Control Plane** | `meta.risk` | Human review trigger |
| **Control Plane** | `meta.explain` | Logs/card UI |
| **Data Plane** | `data.rationale` | Detailed audit |
| **Data Plane** | `data.extensions` | Recoverable insights |

## Core Features

| Feature | Description |
|---------|-------------|
| **JSON Schema Validation** | Bidirectional input/output validation |
| **Confidence** | Every output must include 0-1 confidence |
| **Reasoning** | `meta.explain` (brief) + `data.rationale` (detailed) |
| **Module Tiers** | `tier: exec \| decision \| exploration` |
| **Risk Aggregation** | `meta.risk = max(changes[*].risk)` |
| **Parameter Passing** | `$ARGUMENTS` runtime substitution |
| **Subagents** | `@call:module` for inter-module calls |
| **Validation Tools** | `cogn validate` / `cogn validate --v22` |

## Integration Methods

| Method | Command | Use Case |
|--------|---------|----------|
| CLI | `cogn run` | Command line |
| HTTP API | `cogn serve` | n8n, Coze, Dify |
| MCP Server | `cogn mcp` | Claude, Cursor |

## CLI Commands

```bash
# Module management
cogn list                    # List installed modules
cogn info <module>           # View module details
cogn validate <module>       # Validate module structure
cogn validate <module> --v22 # Validate v2.2 format

# Run modules
cogn run <module> input.json -o output.json --pretty
cogn run <module> --args "requirements" --pretty
cogn run <module> --args "requirements" --subagent  # Enable subagent

# Create modules
cogn init <name> -d "description"
cogn init <name> --format v22  # Create v2.2 format module

# Migrate modules
cogn migrate <module>        # Migrate v1/v2.1 module to v2.2

# Install from GitHub (recommended)
cogn add ziel-io/cognitive-modules -m code-simplifier
cogn add org/repo -m module-name --tag v1.0.0   # Install specific version
cogn remove <module>                             # Remove module

# Version management
cogn update <module>                 # Update to latest version
cogn update <module> --tag v2.0.0    # Update to specific version
cogn versions <url>                  # View available versions

# Other installation methods
cogn install github:user/repo/path
cogn install registry:module-name
cogn uninstall <module>

# Registry
cogn registry                # View public modules
cogn search <query>          # Search modules

# Environment check
cogn doctor
```

## Built-in Modules

| Module | Tier | Function | Example |
|--------|------|----------|---------|
| `code-reviewer` | decision | Code review | `cogn run code-reviewer --args "your code"` |
| `code-simplifier` | decision | Code simplification | `cogn run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | Task priority sorting | `cogn run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API design | `cogn run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI spec generation | `cogn run ui-spec-generator --args "e-commerce homepage"` |
| `product-analyzer` | exploration | Product analysis (subagent) | `cogn run product-analyzer --args "health product" -s` |

## Module Format

### v2.2 Format (Recommended)

```
my-module/
├── module.yaml     # Machine-readable manifest (with tier/overflow/enums)
├── prompt.md       # Human-readable prompt
├── schema.json     # meta + input + data + error schemas
└── tests/          # Golden test cases
    ├── case1.input.json
    └── case1.expected.json
```

### module.yaml (v2.2)

```yaml
name: my-module
version: 2.2.0
responsibility: One-line description

tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low

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
  strategy: extensible   # strict | extensible

failure:
  contract: error_union
  partial_allowed: true

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
```

### v1 Format (Still Supported)

```
my-module/
├── MODULE.md       # Metadata + instructions
├── schema.json     # Input/output schema
└── examples/
    ├── input.json
    └── output.json
```

## Tier Explanation

| Tier | Purpose | Schema Strictness | Overflow |
|------|---------|-------------------|----------|
| `exec` | Auto-execution (patch, instruction generation) | high | Disabled |
| `decision` | Judgment/evaluation/classification | medium | Enabled |
| `exploration` | Exploration/research/inspiration | low | Enabled |

## Using with AI Tools

### Cursor / Codex CLI

Create `AGENTS.md` in your project root:

```markdown
## Code Review

When code review is needed:
1. Read `~/.cognitive/modules/code-reviewer/MODULE.md`
2. Output in schema.json format
3. Include meta.explain + data.rationale
```

### Direct Conversation

```
Read ~/.cognitive/modules/code-reviewer/MODULE.md,
review this code: def login(u,p): ...
```

## LLM Configuration

```bash
# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Anthropic Claude
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx

# MiniMax
export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx

# Ollama (local)
export LLM_PROVIDER=ollama

# Check configuration
cogn doctor
```

## Migrating to v2.2

Migrate from v1 or v2.1 modules to v2.2:

```bash
# Auto-migrate single module
cogn migrate code-reviewer

# Migrate all modules
cogn migrate --all

# Verify migration result
cogn validate code-reviewer --v22
```

Manual migration steps:
1. Create `module.yaml` (add tier/overflow/enums)
2. Update `schema.json` (add meta schema)
3. Create/update `prompt.md` (describe v2.2 envelope format)
4. Keep `MODULE.md` (backward compatibility)

## Development

```bash
# Clone
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v

# Create new module (v2.2 format)
cogn init my-module -d "module description" --format v22
cogn validate my-module --v22
```

## Project Structure

```
cognitive-modules/
├── src/cognitive/          # Python CLI source
│   ├── cli.py              # Command entry
│   ├── loader.py           # Module loader (supports v0/v1/v2.2)
│   ├── runner.py           # Module executor (v2.2 envelope)
│   ├── validator.py        # Module validator (includes v2.2 validation)
│   ├── migrate.py          # v2.2 migration tool
│   ├── subagent.py         # Subagent orchestration
│   ├── registry.py         # Module installation
│   ├── templates.py        # Module templates
│   └── providers/          # LLM backends
├── packages/
│   └── cli-node/           # Node.js CLI (npm: cognitive-modules-cli)
│       ├── src/            # TypeScript source
│       └── package.json
├── cognitive/modules/      # Built-in modules (all v2.2)
├── coze-plugin/            # Coze integration plugin
├── tests/                  # Unit tests
├── SPEC.md                 # v0.1 specification (historical)
├── SPEC-v2.2.md            # v2.2 specification (latest)
├── INTEGRATION.md          # Integration guide
└── cognitive-registry.json # Public registry
```

## Multi-Platform Support

| Platform | Package | Command | Installation |
|----------|---------|---------|--------------|
| Python | `cognitive-modules` | `cogn` | `pip install cognitive-modules` |
| Node.js | `cogn` or `cognitive-modules-cli` | `cog` | `npm install -g cogn` or `npx cogn` |

Both versions share the same module format and v2.2 specification.

## Documentation

### Specification

| Document | Description |
|----------|-------------|
| [SPEC-v2.2.md](SPEC-v2.2.md) | v2.2 full specification (Control/Data separation, Tier, Overflow) |
| [SPEC-v2.2_zh.md](SPEC-v2.2_zh.md) | v2.2 规范中文版 |
| [SPEC.md](SPEC.md) | v0.1 specification (context philosophy) |

### For Implementers

| Document | Description |
|----------|-------------|
| [IMPLEMENTERS-GUIDE.md](IMPLEMENTERS-GUIDE.md) | Step-by-step guide for building a runtime |
| [CONFORMANCE.md](CONFORMANCE.md) | Conformance levels (Level 1/2/3) |
| [ERROR-CODES.md](ERROR-CODES.md) | Standard error code taxonomy (E1xxx-E4xxx) |
| [templates/runtime-starter/](templates/runtime-starter/) | Starter template for new implementations |

### Advanced Features

| Document | Description |
|----------|-------------|
| [COMPOSITION.md](COMPOSITION.md) | Module composition and dataflow specification |
| [CONTEXT-PROTOCOL.md](CONTEXT-PROTOCOL.md) | Context protocol for stateful workflows |

### Schemas & Test Vectors

| Resource | Description |
|----------|-------------|
| [spec/response-envelope.schema.json](spec/response-envelope.schema.json) | JSON Schema for v2.2 envelope validation |
| [spec/module.yaml.schema.json](spec/module.yaml.schema.json) | JSON Schema for module.yaml |
| [spec/test-vectors/](spec/test-vectors/) | Official test vectors for compliance |

### Registry & Distribution

| Resource | Description |
|----------|-------------|
| [REGISTRY-PROTOCOL.md](REGISTRY-PROTOCOL.md) | Registry protocol specification |
| [spec/registry-entry.schema.json](spec/registry-entry.schema.json) | Registry entry JSON Schema |
| [cognitive-registry.json](cognitive-registry.json) | Current public registry |
| [CERTIFICATION.md](CERTIFICATION.md) | Certification program (badges, verification) |

### Governance

| Document | Description |
|----------|-------------|
| [GOVERNANCE.md](GOVERNANCE.md) | Project governance structure |
| [CMEP-PROCESS.md](CMEP-PROCESS.md) | Enhancement proposal process |

### Integration

| Document | Description |
|----------|-------------|
| [INTEGRATION.md](INTEGRATION.md) | Agent tool integration guide |
| [COGNITIVE-PROTOCOL.md](COGNITIVE-PROTOCOL.md) | Protocol details |

## License

MIT
