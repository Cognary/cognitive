---
sidebar_position: 4
---

# migrate

迁移旧模块到 v2.2。

推荐（明确入口）：

- `npx cogn@2.2.12 migrate ...`

## 语法

```bash
npx cogn@2.2.12 migrate <module> [--dry-run] [--no-backup]
npx cogn@2.2.12 migrate --all [--dry-run] [--no-backup]
```

## 选项

| 选项 | 说明 |
|------|------|
| `--dry-run` | 仅预览，不写入 |
| `--no-backup` | 不创建备份 |
| `--all` | 迁移所有模块 |

## 示例

```bash
npx cogn@2.2.12 migrate code-reviewer --dry-run
npx cogn@2.2.12 migrate code-reviewer
npx cogn@2.2.12 migrate --all --dry-run
```

## 迁移后检查

```bash
npx cogn@2.2.12 validate code-reviewer --v22
npx cogn@2.2.12 run code-reviewer --args "test code" --pretty
```
