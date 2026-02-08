---
sidebar_position: 3
---

# Configure LLM

Cognitive Modules (Node CLI) supports multiple LLM providers. The CLI auto-selects a provider based on which API key is present (stable providers only), or you can force one with `--provider`.

Notes:

- If multiple provider API keys are set, the CLI will auto-select the first provider it finds. Prefer passing `--provider ...` explicitly to avoid surprises.
- If you have `GEMINI_API_KEY` set, Gemini becomes the default provider unless overridden. If your Gemini account does not support the default model, set `--model ...` or use a different provider.

## Supported Providers

Stable support surface (guaranteed by docs/CI/release gates):

| Provider (Stable) | Environment Variable |
|----------|----------------------|
| OpenAI (ChatGPT) | `OPENAI_API_KEY` |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Qwen (DashScope) | `DASHSCOPE_API_KEY` or `QWEN_API_KEY` |

Experimental/community providers are still available, but require explicit `--provider` and are not part of the stable promise:

| Provider (Experimental/Community) | Environment Variable |
|----------|----------------------|
| Moonshot (Kimi) | `MOONSHOT_API_KEY` |
| Ollama (local) | `OLLAMA_HOST` |

## Example: OpenAI

```bash
export OPENAI_API_KEY=sk-xxx
npx cogn@2.2.13 run code-reviewer --args "your code" --provider openai --model gpt-4o
```

## Example: Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
npx cogn@2.2.13 run code-reviewer --args "your code" --provider anthropic --model claude-sonnet-4.5
```

## Example: Ollama (Local) (Community)

```bash
# Install and start Ollama separately
export OLLAMA_HOST=http://localhost:11434
npx cogn@2.2.13 run code-reviewer --args "your code" --provider ollama --model llama3.1
```

## Model Override

- CLI: `--model <name>`
- Env: `COG_MODEL` (global override)

## Check Configuration

```bash
npx cogn@2.2.13 doctor
```
