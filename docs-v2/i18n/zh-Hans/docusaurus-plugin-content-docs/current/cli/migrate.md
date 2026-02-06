---
sidebar_position: 4
---

# cog migrate

迁移旧模块到 v2.2。

## 语法

```bash
cog migrate <module> [--dry-run] [--no-backup]
cog migrate --all [--dry-run] [--no-backup]
```

## 选项

| 选项 | 说明 |
|------|------|
| `--dry-run` | 仅预览，不写入 |
| `--no-backup` | 不创建备份 |
| `--all` | 迁移所有模块 |

## 示例

```bash
cog migrate code-reviewer --dry-run
cog migrate code-reviewer
cog migrate --all --dry-run
```

## 迁移后检查

```bash
cog validate code-reviewer --v22
cog run code-reviewer --args "test code" --pretty
```
