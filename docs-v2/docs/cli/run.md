---
sidebar_position: 2
---

# run

Run a Cognitive Module.

## Syntax

```bash
npx cogn@2.2.11 run <module> [options]
```

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--profile <name>` | | Progressive complexity: `core` \| `default` \| `strict` \| `certified` |
| `--validate <mode>` | | Validation mode: `auto` \| `on` \| `off` (overrides `--no-validate`) |
| `--audit` | | Write an audit record to `~/.cognitive/audit/` (stderr prints path) |
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
npx cogn@2.2.11 run code-reviewer --args "def foo(): pass" --pretty
```

### Running a One-File Module

```bash
npx cogn@2.2.11 run ./demo-single-file.md --args "hello" --pretty
```

If you want an even smaller path (no file), see [`core`](./core) and `npx cogn@2.2.11 core run --stdin`.

### Using JSON input

```bash
npx cogn@2.2.11 run ui-spec-generator --input '{"query":"e-commerce homepage"}' --pretty
```

### Specify Provider/Model

```bash
npx cogn@2.2.11 run code-reviewer --args "code" --provider openai --model gpt-4o
```

## Output

`run` prints a v2.2 envelope to stdout. The envelope includes `module`/`provider` when available. Errors use the same envelope structure (`ok:false`, `meta`, `error`). In `--pretty` mode it is formatted with indentation.

In `--stream` mode, `run` prints streaming events as NDJSON:

- One CEP event object per line
- Terminal event is `{"type":"end", ... "result": { ...envelope... }}`
