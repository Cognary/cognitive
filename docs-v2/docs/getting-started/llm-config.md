---
sidebar_position: 3
---

# Configure LLM

Cognitive Modules supports multiple LLM backends.

## Supported LLMs

| Provider | Environment Variable | Description |
|----------|---------------------|-------------|
| OpenAI | `OPENAI_API_KEY` | GPT-4o, etc. |
| Anthropic | `ANTHROPIC_API_KEY` | Claude series |
| MiniMax | `MINIMAX_API_KEY` | Chinese LLM |
| Ollama | - | Local running |
| Stub | - | For testing, returns examples |

## OpenAI

```bash
pip install cognitive-modules[openai]

export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx
export LLM_MODEL=gpt-4o  # Optional, default gpt-4o
```

## Anthropic Claude

```bash
pip install cognitive-modules[anthropic]

export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx
export LLM_MODEL=claude-sonnet-4-20250514  # Optional
```

## MiniMax

```bash
pip install cognitive-modules[openai]  # Uses OpenAI SDK

export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx
export LLM_MODEL=MiniMax-Text-01  # Optional
```

## Ollama (Local)

```bash
# First install Ollama: https://ollama.ai
ollama pull llama3.1

export LLM_PROVIDER=ollama
export OLLAMA_HOST=http://localhost:11434  # Optional
export LLM_MODEL=llama3.1  # Optional
```

## Stub (Testing)

When no environment variables are configured, Stub is used automatically:

```bash
cog run my-module input.json
# Returns example output (if available)
```

## Check Configuration

```bash
cog doctor
```

## Runtime Switching

```bash
# Use OpenAI
LLM_PROVIDER=openai cog run code-reviewer --args "code"

# Use Anthropic
LLM_PROVIDER=anthropic cog run code-reviewer --args "code"
```

## Model Override

```bash
# Use specific model
cog run code-reviewer --args "code" --model gpt-4-turbo
```
