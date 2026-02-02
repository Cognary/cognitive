---
sidebar_position: 4
---

# cogn migrate

Migrate v1/v2.1 modules to v2.2 format.

## Syntax

```bash
cogn migrate <module> [options]
cogn migrate --all [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `module` | Module name or path |
| `--all`, `-a` | Migrate all installed modules |
| `--dry-run`, `-n` | Preview changes without modifying |
| `--no-backup` | Don't create backup |

## Migration Contents

### v1 → v2.2

| Original File | Generated Files |
|---------------|-----------------|
| `MODULE.md` | `module.yaml` + `prompt.md` (keeps MODULE.md) |
| `schema.json` | Add `meta` schema, rename `output` to `data` |

### v2.1 → v2.2

| Change | Description |
|--------|-------------|
| Add `tier` | Default `decision` |
| Add `overflow` | Enable recoverable insights |
| Add `enums` | Default `extensible` |
| Add `compat` | Backward compatibility config |
| Add `meta` schema | confidence, risk, explain |
| Add `data.rationale` | Required detailed reasoning |
| Update `prompt.md` | Add v2.2 envelope instructions |

## Examples

### Preview Migration

```bash
cogn migrate code-reviewer --dry-run
```

Output:

```
→ Migrating module: code-reviewer (dry run)

Changes:
  - [DRY RUN] Would update module.yaml: Added tier: decision, Added overflow config
  - [DRY RUN] Would update schema.json: Added meta schema, Renamed output to data
  - [DRY RUN] Would update prompt.md: Added v2.2 envelope instructions

✓ Migration preview complete
  Run without --dry-run to apply changes
```

### Execute Migration

```bash
cogn migrate code-reviewer
```

Output:

```
→ Migrating module: code-reviewer

Changes:
  - Created backup: code-reviewer_backup_20260202_143052
  - Updated module.yaml: Added tier: decision, Added overflow config, Added compat config
  - Updated schema.json: Added meta schema, Renamed output to data
  - Updated prompt.md: Added v2.2 envelope instructions

✓ Module 'code-reviewer' migrated to v2.2

Validate with:
  cogn validate code-reviewer --v22
```

### Migrate All Modules

```bash
cogn migrate --all
```

Output:

```
→ Migrating all modules to v2.2...

✓ code-reviewer
    Created backup: code-reviewer_backup_20260202_143100
    Updated module.yaml, schema.json, prompt.md
✓ code-simplifier
    Module appears to already be v2.2 format
✓ task-prioritizer
    Updated module.yaml, schema.json, prompt.md
✗ legacy-module
    v0 format migration requires manual review

Migrated: 3/4
```

### Without Backup

```bash
cogn migrate code-reviewer --no-backup
```

:::warning Use with Caution
Always create backups unless using version control.
:::

## Post-Migration Steps

1. **Validate Format**
   ```bash
   cogn validate code-reviewer --v22
   ```

2. **Test Run**
   ```bash
   cogn run code-reviewer --args "test code" --pretty
   ```

3. **Check Response Format**
   Confirm response contains separated `meta` and `data` structure

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: Migrate code-reviewer to v2.2"
   ```

## Manual Migration

If automatic migration doesn't meet your needs, do it manually:

### 1. Create module.yaml

```yaml
name: my-module
version: 2.2.0
tier: decision
schema_strictness: medium

overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
```

### 2. Update schema.json

Add `meta` schema:

```json
{
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "risk": { "type": "string", "enum": ["none", "low", "medium", "high"] },
      "explain": { "type": "string", "maxLength": 280 }
    }
  }
}
```

### 3. Update prompt.md

Add v2.2 envelope instructions:

```markdown
## Response Format (Envelope v2.2)

Wrap your response in:
- Success: `{ "ok": true, "meta": {...}, "data": {...} }`
- Error: `{ "ok": false, "meta": {...}, "error": {...} }`
```

## FAQ

### Q: Can old format still work after migration?

Yes. Setting `compat.accepts_v21_payload: true` allows accepting v2.1 payload.

### Q: Where are backups stored?

Backups are created in the same directory as the module, named: `{module}_backup_{timestamp}`

### Q: Can v0 format be auto-migrated?

v0 format needs more manual adjustments, auto-migration will prompt "requires manual review".
