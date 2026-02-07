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

## Progressive Complexity (Profiles)

The CLI supports **progressive complexity** via `--profile` (plus small overrides):

| Profile | Intended Use | Defaults |
|---------|--------------|----------|
| `core` | 5-minute path, minimal enforcement | `--validate=off`, `--audit=false` |
| `default` | day-to-day | `--validate=on`, `--audit=false` |
| `strict` | higher assurance | `--validate=on`, `--audit=false` |
| `certified` | strongest gates / publishable flows | `--validate=on`, `--audit=true`, requires v2.2 modules |

Overrides:

- `--validate auto|on|off` (legacy: `--no-validate` == `--validate off`)
- `--audit` writes an audit record to `~/.cognitive/audit/` (path is printed to stderr)

Examples:

```bash
# Minimal run (skip validation)
cog run ./demo.md --args "hello" --profile core

# Higher assurance
cog run code-reviewer --args "..." --profile strict

# Certified gate (refuses legacy modules + requires registry provenance/integrity)
cog run code-reviewer --args "..." --profile certified

# Force validation + write audit record
cog run code-reviewer --args "..." --profile default --audit --validate on
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

### 3.1 Build and Verify Registry Tarballs (Publishable Assets)

```bash
# Build tarballs + regenerate cognitive-registry.v2.json
cog registry build --tag v2.2.7

# Verify local tarballs match the v2 registry index
cog registry verify --index cognitive-registry.v2.json --assets-dir dist/registry-assets

# Verify remote "latest" registry (fetch index + tarballs and validate integrity)
# Default registry index strategy:
#   https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
cog registry verify --remote --index https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json

# Pin to a specific release tag (recommended for reproducible builds)
cog registry verify --remote --index https://github.com/Cognary/cognitive/releases/download/v2.2.7/cognitive-registry.v2.json

# Tune remote verification limits (defaults: 15s, 2MB index, 25MB tarball)
cog registry verify --remote \
  --fetch-timeout-ms 20000 \
  --max-index-bytes 2097152 \
  --max-tarball-bytes 26214400
```

### 4. Compose Workflows

```bash
cog compose code-review-pipeline --args "code" --timeout 60000 --trace
cog compose-info code-review-pipeline
```
