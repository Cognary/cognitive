---
sidebar_position: 3
---

# Configure LLM

Cognitive Modules (Node CLI) supports multiple LLM providers. The CLI auto-selects a provider based on which API key is present, or you can force one with `--provider`.

## Supported Providers

| Provider | Environment Variable |
|----------|----------------------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| Moonshot (Kimi) | `MOONSHOT_API_KEY` |
| Qwen (DashScope) | `DASHSCOPE_API_KEY` or `QWEN_API_KEY` |
| Ollama (local) | `OLLAMA_HOST` |

## Example: OpenAI

```bash
export OPENAI_API_KEY=sk-xxx
cog run code-reviewer --args "your code" --provider openai --model gpt-4o
```

## Example: Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
cog run code-reviewer --args "your code" --provider anthropic --model claude-sonnet-4.5
```

## Example: Ollama (Local)

```bash
# Install and start Ollama separately
export OLLAMA_HOST=http://localhost:11434
cog run code-reviewer --args "your code" --provider ollama --model llama3.1
```

## Model Override

- CLI: `--model <name>`
- Env: `COG_MODEL` (global override)

## Check Configuration

```bash
cog doctor
```
