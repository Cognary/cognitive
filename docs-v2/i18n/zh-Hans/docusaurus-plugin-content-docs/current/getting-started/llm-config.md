---
sidebar_position: 3
---

# 配置 LLM

Node CLI 支持多种 Provider。默认会根据已配置的 API Key 自动选择（仅限稳定支持面），也可用 `--provider` 指定。

说明：

- 如果同时配置了多个 provider 的 API key，CLI 会自动选择第一个命中的 provider。建议显式传 `--provider ...`，避免误判。
- 如果你设置了 `GEMINI_API_KEY`，Gemini 会成为默认 provider。若你的账号不支持默认模型，请显式传 `--model ...` 或切换到其他 provider。

## 支持的 Provider

稳定支持面（文档/CI/发布门禁保证）：

| Provider（Stable） | 环境变量 |
|----------|---------|
| OpenAI (ChatGPT) | `OPENAI_API_KEY` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Qwen (DashScope) | `DASHSCOPE_API_KEY` / `QWEN_API_KEY` |

实验/社区 provider（可用但不承诺稳定；需要显式指定 `--provider`）：

| Provider（Experimental/Community） | 环境变量 |
|----------|---------|
| Moonshot (Kimi) | `MOONSHOT_API_KEY` |
| Ollama (本地) | `OLLAMA_HOST` |

## 示例：OpenAI

```bash
export OPENAI_API_KEY=sk-xxx
npx cogn@2.2.13 run code-reviewer --args "your code" --provider openai --model gpt-4o
```

## 示例：Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
npx cogn@2.2.13 run code-reviewer --args "your code" --provider anthropic --model claude-sonnet-4.5
```

## 示例：Ollama（社区）

```bash
export OLLAMA_HOST=http://localhost:11434
npx cogn@2.2.13 run code-reviewer --args "your code" --provider ollama --model llama3.1
```

## 模型覆盖

- CLI: `--model <name>`
- 环境变量：`COG_MODEL`

## 检查配置

```bash
npx cogn@2.2.13 doctor
```
