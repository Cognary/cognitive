---
sidebar_position: 4
---

# cogn migrate

将 v1/v2.1 模块迁移到 v2.2 格式。

## 语法

```bash
cogn migrate <module> [options]
cogn migrate --all [options]
```

## 参数

| 参数 | 说明 |
|------|------|
| `module` | 模块名称或路径 |
| `--all`, `-a` | 迁移所有已安装模块 |
| `--dry-run`, `-n` | 预览变更，不实际修改 |
| `--no-backup` | 不创建备份 |

## 迁移内容

### v1 → v2.2

| 原文件 | 生成文件 |
|--------|----------|
| `MODULE.md` | `module.yaml` + `prompt.md`（保留 MODULE.md） |
| `schema.json` | 添加 `meta` schema，重命名 `output` 为 `data` |

### v2.1 → v2.2

| 变更 | 说明 |
|------|------|
| 添加 `tier` | 默认 `decision` |
| 添加 `overflow` | 启用可回收洞察 |
| 添加 `enums` | 默认 `extensible` |
| 添加 `compat` | 向后兼容配置 |
| 添加 `meta` schema | confidence, risk, explain |
| 添加 `data.rationale` | 必填详细推理 |
| 更新 `prompt.md` | 添加 v2.2 envelope 说明 |

## 示例

### 预览迁移

```bash
cogn migrate code-reviewer --dry-run
```

输出：

```
→ Migrating module: code-reviewer (dry run)

Changes:
  - [DRY RUN] Would update module.yaml: Added tier: decision, Added overflow config
  - [DRY RUN] Would update schema.json: Added meta schema, Renamed output to data
  - [DRY RUN] Would update prompt.md: Added v2.2 envelope instructions

✓ Migration preview complete
  Run without --dry-run to apply changes
```

### 执行迁移

```bash
cogn migrate code-reviewer
```

输出：

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

### 迁移所有模块

```bash
cogn migrate --all
```

输出：

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

### 不创建备份

```bash
cogn migrate code-reviewer --no-backup
```

:::warning 谨慎使用
建议始终创建备份，除非使用版本控制。
:::

## 迁移后步骤

1. **验证格式**
   ```bash
   cogn validate code-reviewer --v22
   ```

2. **测试运行**
   ```bash
   cogn run code-reviewer --args "test code" --pretty
   ```

3. **检查响应格式**
   确认返回包含 `meta` 和 `data` 分离的结构

4. **提交变更**
   ```bash
   git add .
   git commit -m "feat: Migrate code-reviewer to v2.2"
   ```

## 手动迁移

如果自动迁移不满足需求，可手动进行：

### 1. 创建 module.yaml

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

### 2. 更新 schema.json

添加 `meta` schema：

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

### 3. 更新 prompt.md

添加 v2.2 envelope 说明：

```markdown
## Response Format (Envelope v2.2)

Wrap your response in:
- Success: `{ "ok": true, "meta": {...}, "data": {...} }`
- Error: `{ "ok": false, "meta": {...}, "error": {...} }`
```

## 常见问题

### Q: 迁移后旧格式还能用吗？

是的。设置 `compat.accepts_v21_payload: true` 可继续接受 v2.1 payload。

### Q: 备份存放在哪里？

备份创建在模块同级目录，命名格式：`{module}_backup_{timestamp}`

### Q: v0 格式能自动迁移吗？

v0 格式需要更多手动调整，自动迁移会提示 "requires manual review"。
