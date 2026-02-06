---
sidebar_position: 4
---

# cog migrate

Migrate legacy modules to v2.2 format.

## Syntax

```bash
cog migrate <module> [--dry-run] [--no-backup]
cog migrate --all [--dry-run] [--no-backup]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--no-backup` | Skip backup before migration |
| `--all` | Migrate all modules in search paths |

## What It Does

- v1 (`MODULE.md`) → v2.2: creates `module.yaml` + `prompt.md`, keeps legacy file
- v2.1 → v2.2: adds tier/overflow/enums/compat and meta schema

## Examples

```bash
# Preview
cog migrate code-reviewer --dry-run

# Execute
cog migrate code-reviewer

# Migrate all
cog migrate --all --dry-run
```

## Post-Migration

```bash
cog validate code-reviewer --v22
cog run code-reviewer --args "test code" --pretty
```
