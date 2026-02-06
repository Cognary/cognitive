---
sidebar_position: 2
---

# cog run

运行模块。

## 语法

```bash
cog run <module> [options]
```

## 选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--args <text>` | `-a` | 传入文本输入（自动映射为 `query` 或 `code`） |
| `--input <json>` | `-i` | 传入 JSON 字符串 |
| `--pretty` | | 美化输出 |
| `--no-validate` | | 跳过校验 |
| `--provider <name>` | `-p` | 指定 Provider |
| `--model <name>` | `-M` | 指定模型 |
| `--verbose` | `-V` | 详细日志 |

## 示例

```bash
cog run code-reviewer --args "def foo(): pass" --pretty
cog run ui-spec-generator --input '{"query":"e-commerce homepage"}' --pretty
cog run code-reviewer --provider openai --model gpt-4o --args "code"
```

## 输出

`cog run` 会输出 v2.2 envelope，并在可用时包含 `module`/`provider`。错误同样使用 envelope 结构（`ok:false`, `meta`, `error`）。`--pretty` 会格式化输出。
