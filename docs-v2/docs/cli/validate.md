---
sidebar_position: 3
---

# validate

Validate the structure of a Cognitive Module.

Recommended (unambiguous) usage:

- `npx cogn@2.2.13 validate ...`

If you see `No such option: --all`, you are likely running a different binary on your machine. Use the `npx` form above.

## Syntax

```bash
npx cogn@2.2.13 validate <module> [--v22] [--format text|json]
npx cogn@2.2.13 validate --all [--v22] [--format text|json]
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
npx cogn@2.2.13 validate code-reviewer

# Strict v2.2 validation
npx cogn@2.2.13 validate code-reviewer --v22

# Validate all modules
npx cogn@2.2.13 validate --all --v22 --format json
```

## Migration Recommendation

If you see v1/v2.1 warnings, use:

```bash
npx cogn@2.2.13 migrate code-reviewer --dry-run
npx cogn@2.2.13 migrate code-reviewer
npx cogn@2.2.13 validate code-reviewer --v22
```
