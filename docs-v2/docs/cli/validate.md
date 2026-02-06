---
sidebar_position: 3
---

# cog validate

Validate the structure of a Cognitive Module.

## Syntax

```bash
cog validate <module> [--v22] [--format text|json]
cog validate --all [--v22] [--format text|json]
```

## Options

| Option | Description |
|--------|-------------|
| `--v22` | Enable strict v2.2 checks |
| `--all` | Validate all modules in search paths |
| `--format` | Output format: `text` (default) or `json` |

## What It Checks

- Required files: `module.yaml` (v2) or `MODULE.md`/`module.md` (legacy)
- Valid YAML/JSON
- Required manifest fields (`name`, `version`, `responsibility`)
- Schema presence and structure
- v2.2 strict checks (tier/meta/explain length)

## Examples

```bash
# Standard validation
cog validate code-reviewer

# Strict v2.2 validation
cog validate code-reviewer --v22

# Validate all modules
cog validate --all --v22 --format json
```

## Migration Recommendation

If you see v1/v2.1 warnings, use:

```bash
cog migrate code-reviewer --dry-run
cog migrate code-reviewer
cog validate code-reviewer --v22
```
