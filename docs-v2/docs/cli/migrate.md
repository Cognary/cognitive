---
sidebar_position: 4
---

# migrate

Migrate legacy modules to v2.2 format.

Recommended (unambiguous) usage:

- `npx cogn@2.2.11 migrate ...`

## Syntax

```bash
npx cogn@2.2.11 migrate <module> [--dry-run] [--no-backup]
npx cogn@2.2.11 migrate --all [--dry-run] [--no-backup]
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
npx cogn@2.2.11 migrate code-reviewer --dry-run

# Execute
npx cogn@2.2.11 migrate code-reviewer

# Migrate all
npx cogn@2.2.11 migrate --all --dry-run
```

## Post-Migration

```bash
npx cogn@2.2.11 validate code-reviewer --v22
npx cogn@2.2.11 run code-reviewer --args "test code" --pretty
```
