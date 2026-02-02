---
sidebar_position: 2
---

# cog run

Run a Cognitive Module.

:::note Command Name
This documentation uses `cog` (npm version). If using the pip version, replace `cog` with `cogn`.
:::

## Syntax

```bash
cog run <module> [input_file] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `module` | Module name or path |
| `input_file` | Input JSON file (optional, can be omitted when using --args) |

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output FILE` | `-o` | Output file path |
| `--args TEXT` | `-a` | Pass text argument directly |
| `--pretty` | | Format JSON output |
| `--no-validate` | | Skip Schema validation |
| `--subagent` | `-s` | Enable sub-agent mode |
| `--model MODEL` | `-m` | Override LLM model |

## Examples

### Using JSON File

```bash
cog run ui-spec-generator input.json -o output.json --pretty
```

### Using --args

```bash
cog run code-reviewer --args "def foo(): pass" --pretty
```

### Enable Sub-agent

```bash
cog run product-analyzer --args "health product" --subagent --pretty
```

### Specify Model

```bash
cog run code-reviewer --args "code" --model gpt-4-turbo
```

### Save Output

```bash
cog run api-designer --args "user API" -o api-spec.json --pretty
```

## Output

On successful run:

```
→ Running module: code-reviewer
{
  "issues": [...],
  "confidence": 0.95
}
Confidence: 0.95
```

On failure:

```
→ Running module: code-reviewer
✗ Error: Output validation failed: [...]
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | LLM backend (openai/anthropic/minimax/ollama/stub) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `MINIMAX_API_KEY` | MiniMax API key |
| `LLM_MODEL` | Default model |
