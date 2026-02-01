# 配置 LLM

Cognitive Modules 支持多种 LLM 后端。

## 支持的 LLM

| Provider | 环境变量 | 说明 |
|----------|----------|------|
| OpenAI | `OPENAI_API_KEY` | GPT-4o 等 |
| Anthropic | `ANTHROPIC_API_KEY` | Claude 系列 |
| MiniMax | `MINIMAX_API_KEY` | 国产大模型 |
| Ollama | - | 本地运行 |
| Stub | - | 测试用，返回示例 |

## OpenAI

```bash
pip install cognitive-modules[openai]

export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx
export LLM_MODEL=gpt-4o  # 可选，默认 gpt-4o
```

## Anthropic Claude

```bash
pip install cognitive-modules[anthropic]

export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx
export LLM_MODEL=claude-sonnet-4-20250514  # 可选
```

## MiniMax

```bash
pip install cognitive-modules[openai]  # 使用 OpenAI SDK

export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx
export LLM_MODEL=MiniMax-Text-01  # 可选
```

## Ollama（本地）

```bash
# 先安装 Ollama: https://ollama.ai
ollama pull llama3.1

export LLM_PROVIDER=ollama
export OLLAMA_HOST=http://localhost:11434  # 可选
export LLM_MODEL=llama3.1  # 可选
```

## Stub（测试）

不配置任何环境变量时，自动使用 Stub：

```bash
cog run my-module input.json
# 返回示例输出（如果有的话）
```

## 检查配置

```bash
cog doctor
```

## 运行时切换

```bash
# 使用 OpenAI
LLM_PROVIDER=openai cog run code-reviewer --args "代码"

# 使用 Anthropic
LLM_PROVIDER=anthropic cog run code-reviewer --args "代码"
```

## 模型覆盖

```bash
# 使用特定模型
cog run code-reviewer --args "代码" --model gpt-4-turbo
```
