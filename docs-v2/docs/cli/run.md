---
sidebar_position: 2
---

# cog run

Run a Cognitive Module.

## Syntax

```bash
cog run <module> [options]
```

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--args <text>` | `-a` | Pass text input (mapped to `query` or `code`) |
| `--input <json>` | `-i` | JSON input string |
| `--pretty` | | Pretty-print JSON output |
| `--no-validate` | | Skip schema validation |
| `--provider <name>` | `-p` | Provider override (openai/anthropic/gemini/deepseek/minimax/moonshot/qwen/ollama) |
| `--model <name>` | `-M` | Model override |
| `--verbose` | `-V` | Verbose output |
| `--stream` | | Stream `cep.events.v2.2` as NDJSON (one JSON event per line) |

## Examples

### Using --args

```bash
cog run code-reviewer --args "def foo(): pass" --pretty
```

### Using JSON input

```bash
cog run ui-spec-generator --input '{"query":"e-commerce homepage"}' --pretty
```

### Specify Provider/Model

```bash
cog run code-reviewer --args "code" --provider openai --model gpt-4o
```

## Output

`cog run` prints a v2.2 envelope to stdout. The envelope includes `module`/`provider` when available. Errors use the same envelope structure (`ok:false`, `meta`, `error`). In `--pretty` mode it is formatted with indentation.

In `--stream` mode, `cog run` prints streaming events as NDJSON:

- One CEP event object per line
- Terminal event is `{"type":"end", ... "result": { ...envelope... }}`
