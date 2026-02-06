---
sidebar_position: 3
---

# cog validate

校验模块结构。

## 语法

```bash
cog validate <module> [--v22] [--format text|json]
cog validate --all [--v22] [--format text|json]
```

## 选项

| 选项 | 说明 |
|------|------|
| `--v22` | 启用 v2.2 严格校验 |
| `--all` | 校验所有模块 |
| `--format` | 输出格式：`text` / `json` |

## 示例

```bash
cog validate code-reviewer
cog validate code-reviewer --v22
cog validate --all --v22 --format json
```

## 迁移建议

```bash
cog migrate code-reviewer --dry-run
cog migrate code-reviewer
cog validate code-reviewer --v22
```
