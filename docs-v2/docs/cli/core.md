---
sidebar_position: 2
---

# cog core

`cog core` is the minimal "one-file" workflow for Cognitive Modules.

It is designed for:

- A 5-minute path (no registry, no conformance required).
- A path to migrate into a standard v2 module directory when you are ready.

## Availability Note

If you installed via npm `cogn@2.2.7`, you may not have `cog core` yet.
This page documents the current `main` branch behavior.

## Commands

### 1) Create a One-File Module

```bash
cog core new            # creates ./demo.md
cog core new my.md
```

### 2) Run It (File)

```bash
cog core run demo.md --args "hello" --pretty
```

### 3) Run It (STDIN, Zero Files)

```bash
cat <<'EOF' | cog core run --stdin --args "hello" --pretty
Return a valid v2.2 envelope. Put the output in data.result.
EOF
```

### 4) Promote To v2 Module Directory

```bash
# Default output: ./cognitive/modules/<module-name>/
cog core promote demo.md

# Custom output directory
cog core promote demo.md ./cognitive/modules/demo
```

Promote also creates minimal golden tests:

- `tests/smoke.input.json`
- `tests/smoke.expected.json` (schema validation format: `$validate`)

### 5) Overwrite an Existing Target

```bash
cog core promote demo.md ./cognitive/modules/demo --force
```

## Why This Matters

`core` gives you a low-friction start, while keeping a clean upgrade path:

- Start with a single `.md` file.
- When you need portability, promote into `module.yaml/prompt.md/schema.json/tests/`.

