---
sidebar_position: 3
---

# validate

校验模块结构。

推荐（明确入口）：

- `npx cogn@2.2.11 validate ...`

如果你看到 `No such option: --all`，说明你机器上可能有命令冲突（PATH/二进制冲突）。请使用上面的 `npx` 形式。

## 语法

```bash
npx cogn@2.2.11 validate <module> [--v22] [--format text|json]
npx cogn@2.2.11 validate --all [--v22] [--format text|json]
```

## 选项

| 选项 | 说明 |
|------|------|
| `--v22` | 启用 v2.2 严格校验 |
| `--all` | 校验所有模块 |
| `--format` | 输出格式：`text` / `json` |

## 示例

```bash
npx cogn@2.2.11 validate code-reviewer
npx cogn@2.2.11 validate code-reviewer --v22
npx cogn@2.2.11 validate --all --v22 --format json
```

## 迁移建议

```bash
npx cogn@2.2.11 migrate code-reviewer --dry-run
npx cogn@2.2.11 migrate code-reviewer
npx cogn@2.2.11 validate code-reviewer --v22
```
