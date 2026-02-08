---
sidebar_position: 3
---

# Arguments & Input Mapping

Cognitive Modules supports two ways to pass input:

1. **Structured JSON** via `--input` (recommended)
2. **Free-form text** via `--args`

## Structured Input (`--input`)

```bash
npx cogn@2.2.11 run code-reviewer --input '{"query":"review this code"}'
```

Fields in `input` are available to prompts via `${variable}` placeholders, for example `${query}`.

## Text Input (`--args`)

```bash
npx cogn@2.2.11 run code-reviewer --args "def foo(): pass"
```

`--args` is mapped to:

- `input.code` if it looks like code
- otherwise `input.query`

## Prompt Substitution

The runtime supports legacy placeholders in `prompt.md`:

- `$ARGUMENTS` (full args string)
- `$ARGUMENTS[N]` (index access)
- `$N` (shorthand index)

If the prompt does not include args explicitly, the runtime appends a short input section automatically.
