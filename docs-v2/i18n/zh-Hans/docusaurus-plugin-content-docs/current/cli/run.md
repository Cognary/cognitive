---
sidebar_position: 2
---

# run

运行模块。

## 语法

```bash
npx cogn@2.2.13 run <module> [options]
```

## 选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--profile <name>` | | 渐进复杂度：`core` \| `default` \| `strict` \| `certified` |
| `--validate <mode>` | | 校验策略：`auto` \| `on` \| `off`（会覆盖 `--no-validate`） |
| `--audit` | | 写入审计记录到 `~/.cognitive/audit/`（路径输出到 stderr） |
| `--args <text>` | `-a` | 传入文本输入（自动映射为 `query` 或 `code`） |
| `--input <json>` | `-i` | 传入 JSON 字符串 |
| `--pretty` | | 美化输出 |
| `--no-validate` | | 跳过校验 |
| `--provider <name>` | `-p` | 指定 Provider |
| `--model <name>` | `-M` | 指定模型 |
| `--verbose` | `-V` | 详细日志 |
| `--stream` | | 以 NDJSON 流式输出 `cep.events.v2.2`（每行一个 JSON event） |

## 示例

```bash
npx cogn@2.2.13 run code-reviewer --args "def foo(): pass" --pretty
npx cogn@2.2.13 run ui-spec-generator --input '{"query":"e-commerce homepage"}' --pretty
npx cogn@2.2.13 run code-reviewer --provider openai --model gpt-4o --args "code"
```

## 输出

`run` 会输出 v2.2 envelope，并在可用时包含 `module`/`provider`。错误同样使用 envelope 结构（`ok:false`, `meta`, `error`）。`--pretty` 会格式化输出。
