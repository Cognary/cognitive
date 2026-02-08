---
sidebar_position: 1
---

# CLI Overview (Node.js)

Cognitive Modules CLI is distributed via npm. The recommended entrypoint is `npx cogn@2.2.13 ...` (avoids PATH/binary conflicts on your machine).

## Installation

```bash
# Zero-install
npx cogn@2.2.13 --help

# Global
npm install -g cogn@2.2.13
# or: npm install -g cognitive-modules-cli@2.2.13
```

## Command List

| Command | Description |
|---------|-------------|
| `core <cmd>` | Minimal workflow: `new`, `run`, `schema`, `promote` |
| `providers` | List providers + capabilities (structured output + streaming) |
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
| `registry <cmd>` | Registry index/tarballs: `list`, `info`, `build`, `verify` |

## Global Options

```bash
npx cogn@2.2.13 --version
npx cogn@2.2.13 --help
```

## Progressive Complexity (Profiles)

The CLI supports **progressive complexity** via `--profile` (plus small overrides):

| Profile | Intended Use | Defaults |
|---------|--------------|----------|
| `core` | 5-minute path, minimal enforcement | `--validate=off`, `--audit=false` |
| `standard` | day-to-day (recommended) | `--validate=auto`, `--audit=false` |
| `certified` | strongest gates / publishable flows | `--validate=on`, `--audit=true`, requires v2.2 modules |

Legacy aliases (still accepted, but not recommended in new docs):

- `default` -> `standard`
- `strict` -> `standard` (deprecated preset)

Overrides:

- `--validate auto|on|off` (legacy: `--no-validate` == `--validate off`)
- `--structured auto|off|prompt|native` (provider-layer structured output)
  - `auto` picks a provider-appropriate strategy and can downgrade `native -> prompt` once on compatibility errors (for stability)
- `--audit` writes an audit record to `~/.cognitive/audit/` (path is printed to stderr)

Examples:

```bash
# Minimal run (skip validation)
npx cogn@2.2.13 run ./demo.md --args "hello" --profile core

# Force prompt-based structured output (useful when a provider rejects native schemas)
npx cogn@2.2.13 run ./demo.md --args "hello" --structured prompt

# Higher assurance
npx cogn@2.2.13 run code-reviewer --args "..." --profile standard

# Certified gate (refuses legacy modules + requires registry provenance/integrity)
npx cogn@2.2.13 run code-reviewer --args "..." --profile certified

# Force validation + write audit record
npx cogn@2.2.13 run code-reviewer --args "..." --profile standard --audit --validate on
```

## Common Workflows

### 0. Minimal One-File Path

See [Core](./core).

### Provider Compatibility (Structured Output)

If a provider rejects native JSON schema payloads, use:

```bash
npx cogn@2.2.13 run <module> --args "..." --structured prompt
```

See [Providers and Capabilities](../integration/providers).

### 1. Run a Module

```bash
npx cogn@2.2.13 run code-reviewer --args "your code" --pretty
```

### 2. Create a Module

```bash
npx cogn@2.2.13 init my-module
npx cogn@2.2.13 validate my-module --v22
```

### 3. Install Modules from GitHub

```bash
npx cogn@2.2.13 add Cognary/cognitive -m code-simplifier
npx cogn@2.2.13 versions Cognary/cognitive
npx cogn@2.2.13 update code-simplifier
```

### 3.1 Build and Verify Registry Tarballs (Publishable Assets)

```bash
# Build tarballs + regenerate cognitive-registry.v2.json
npx cogn@2.2.13 registry build --tag vX.Y.Z

# Verify local tarballs match the v2 registry index
npx cogn@2.2.13 registry verify --index cognitive-registry.v2.json --assets-dir dist/registry-assets

# Verify remote "latest" registry (fetch index + tarballs and validate integrity)
# Default registry index strategy:
#   https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
npx cogn@2.2.13 registry verify --remote --index https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json

# Pin to a specific release tag (recommended for reproducible builds)
npx cogn@2.2.13 registry verify --remote --index https://github.com/Cognary/cognitive/releases/download/vX.Y.Z/cognitive-registry.v2.json

# Tune remote verification limits (defaults: 15s, 2MB index, 25MB tarball)
npx cogn@2.2.13 registry verify --remote \
  --fetch-timeout-ms 20000 \
  --max-index-bytes 2097152 \
  --max-tarball-bytes 26214400

# Control remote verification concurrency (default: 4; max: 8)
npx cogn@2.2.13 registry verify --remote --concurrency 2
```

See [Publishable Artifacts](../registry/publishable-artifacts).

### 3.2 Registry Fetch Hardening (Index Client)

Commands that read the registry index (for example: `search`, `add`, `update`) use a guarded fetch:

- timeout (default: 10s)
- max payload bytes (default: 2MB, hard cap: 20MB)

Override via CLI:

```bash
npx cogn@2.2.13 search "code" --registry-timeout-ms 15000 --registry-max-bytes 2097152
```

Or env:

```bash
export COGNITIVE_REGISTRY_TIMEOUT_MS=15000
export COGNITIVE_REGISTRY_MAX_BYTES=2097152
```

### 4. Compose Workflows

```bash
npx cogn@2.2.13 compose code-review-pipeline --args "code" --timeout 60000 --trace
npx cogn@2.2.13 compose-info code-review-pipeline
```
