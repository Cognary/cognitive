# cog run

运行 Cognitive Module。

!!! note "命令名称"
    本文档使用 `cog`（npm 版本）。如果使用 pip 版本，请将 `cog` 替换为 `cogn`。

## 语法

```bash
cog run <module> [input_file] [options]
```

## 参数

| 参数 | 说明 |
|------|------|
| `module` | 模块名称或路径 |
| `input_file` | 输入 JSON 文件（可选，使用 --args 时可省略） |

## 选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--output FILE` | `-o` | 输出文件路径 |
| `--args TEXT` | `-a` | 直接传入文本参数 |
| `--pretty` | | 格式化 JSON 输出 |
| `--no-validate` | | 跳过 Schema 验证 |
| `--subagent` | `-s` | 启用子代理模式 |
| `--model MODEL` | `-m` | 覆盖 LLM 模型 |

## 示例

### 使用 JSON 文件

```bash
cog run ui-spec-generator input.json -o output.json --pretty
```

### 使用 --args

```bash
cog run code-reviewer --args "def foo(): pass" --pretty
```

### 启用子代理

```bash
cog run product-analyzer --args "健康产品" --subagent --pretty
```

### 指定模型

```bash
cog run code-reviewer --args "代码" --model gpt-4-turbo
```

### 保存输出

```bash
cog run api-designer --args "用户 API" -o api-spec.json --pretty
```

## 输出

运行成功时：

```
→ Running module: code-reviewer
{
  "issues": [...],
  "confidence": 0.95
}
Confidence: 0.95
```

运行失败时：

```
→ Running module: code-reviewer
✗ Error: Output validation failed: [...]
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `LLM_PROVIDER` | LLM 后端（openai/anthropic/minimax/ollama/stub） |
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `MINIMAX_API_KEY` | MiniMax API 密钥 |
| `LLM_MODEL` | 默认模型 |
