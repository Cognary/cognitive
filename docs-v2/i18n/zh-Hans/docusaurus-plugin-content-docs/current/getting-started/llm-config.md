---
sidebar_position: 3
---

# 配置 LLM

Node CLI 支持多种 Provider。默认会根据已配置的 API Key 自动选择，也可用 `--provider` 指定。

## 支持的 Provider

| Provider | 环境变量 |
|----------|---------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| Moonshot (Kimi) | `MOONSHOT_API_KEY` |
| Qwen (DashScope) | `DASHSCOPE_API_KEY` / `QWEN_API_KEY` |
| Ollama (本地) | `OLLAMA_HOST` |

## 示例：OpenAI

```bash
export OPENAI_API_KEY=sk-xxx
npx cogn@2.2.11 run code-reviewer --args "your code" --provider openai --model gpt-4o
```

## 示例：Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
npx cogn@2.2.11 run code-reviewer --args "your code" --provider anthropic --model claude-sonnet-4.5
```

## 示例：Ollama

```bash
export OLLAMA_HOST=http://localhost:11434
npx cogn@2.2.11 run code-reviewer --args "your code" --provider ollama --model llama3.1
```

## 模型覆盖

- CLI: `--model <name>`
- 环境变量：`COG_MODEL`

## 检查配置

```bash
npx cogn@2.2.11 doctor
```
