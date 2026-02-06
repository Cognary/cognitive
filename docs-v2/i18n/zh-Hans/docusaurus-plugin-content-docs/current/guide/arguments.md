---
sidebar_position: 3
---

# 参数与输入映射

输入方式有两种：

1. **结构化 JSON**（`--input`，推荐）
2. **文本输入**（`--args`）

## 结构化输入（--input）

```bash
cog run code-reviewer --input '{"query":"review this code"}'
```

可在 `prompt.md` 中用 `${query}` 直接引用。

## 文本输入（--args）

```bash
cog run code-reviewer --args "def foo(): pass"
```

`--args` 会根据内容自动映射到：

- `input.code`（看起来像代码）
- 否则 `input.query`

## Prompt 替换

支持以下占位符：

- `$ARGUMENTS`
- `$ARGUMENTS[N]`
- `$N`

若 prompt 中未显式包含 args，运行时会自动追加输入摘要。
