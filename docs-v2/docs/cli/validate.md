---
sidebar_position: 3
---

# cogn validate

Validate the structure and examples of a Cognitive Module.

## Syntax

```bash
cogn validate <module> [--v22]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `module` | Module name or path |
| `--v22` | Enable v2.2 strict validation |

## Validation Contents

### Standard Validation

1. **Module files exist**
   - `module.yaml` or `MODULE.md` exists
   - `schema.json` exists

2. **Valid YAML**
   - `name`, `version`, `responsibility` fields exist
   - `excludes` list is non-empty

3. **Valid JSON Schema**
   - `schema.json` is valid JSON
   - `input` and `output/data` definitions exist

4. **Example validation**
   - Example files conform to corresponding Schema

### v2.2 Strict Validation (`--v22`)

Adds to standard validation:

| Check | Description |
|-------|-------------|
| `tier` exists | exec / decision / exploration |
| `meta` schema | Contains confidence, risk, explain |
| `meta.explain.maxLength` | ≤280 |
| `data.rationale` | data must require rationale |
| `overflow` config | When enabled, needs `$defs.extensions` |
| `prompt.md` | Contains v2.2 envelope instructions |

## Examples

### Standard Validation

```bash
cogn validate code-reviewer
```

Output:

```
→ Validating module: code-reviewer

⚠ Warnings (1):
  - Consider adding 'tier' for v2.2 (use 'cogn validate --v22' for full check)

✓ Module 'code-reviewer' is valid
```

### v2.2 Strict Validation

```bash
cogn validate code-reviewer --v22
```

Success output:

```
→ Validating module: code-reviewer (v2.2 strict)

✓ Module 'code-reviewer' is valid v2.2 format
```

Failure output:

```
→ Validating module: code-reviewer (v2.2 strict)

⚠ Warnings (1):
  - overflow.require_suggested_mapping not set

✗ Validation failed (2 errors):
  - module.yaml missing 'tier'
  - schema.json missing 'meta' schema (required for v2.2)
```

## Common Errors

| Error | Solution |
|-------|----------|
| `Missing module.yaml, MODULE.md, or module.md` | Create module definition file |
| `Invalid tier: xxx` | Change to exec / decision / exploration |
| `schema.json missing 'meta' schema` | Add meta schema definition |
| `meta schema must require 'confidence'` | Add confidence to meta.required |
| `meta.explain should have maxLength <= 280` | Set explain.maxLength: 280 |
| `Module is v1 format` | Use `cogn migrate` to upgrade |

## Migration Recommendations

If validation fails with upgrade prompt:

```bash
# Preview migration changes
cogn migrate code-reviewer --dry-run

# Execute migration
cogn migrate code-reviewer

# Re-validate
cogn validate code-reviewer --v22
```

## Best Practices

1. Use v2.2 format for new modules
2. Use `--v22` for strict validation
3. Automatically validate all modules in CI
4. Use `--dry-run` to preview when migrating old modules
