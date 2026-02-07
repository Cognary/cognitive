---
sidebar_position: 1
---

# Providers and Capabilities

Cognitive separates:

- Provider: OpenAI, Anthropic, Gemini, MiniMax, etc
- Model: a specific model name under that provider
- Policy: runtime gates (validation, audit, structured output strategy)

This page documents the parts that typically differ per provider and how Cognitive keeps behavior consistent.

## Quick Check

Use `cog providers` to see what the runtime thinks your environment supports:

```bash
cog providers
```

Typical output fields:

- `structured`: whether the provider supports native JSON-schema style structured output
- `streaming`: whether the provider supports token streaming
- `default_model`: what model will be used if you do not set `--model`

## Structured Output Strategy

Many providers expose a "structured output" mode, but their supported JSON Schema subset differs.
To keep the protocol-level envelope stable, Cognitive exposes a single switch:

```bash
cog run <module> --args "..." --structured auto|off|prompt|native
```

Meaning:

- `auto`: prefer native structured output when supported, otherwise use prompt-based JSON.
  - The runtime may downgrade `native -> prompt` once if the provider rejects the schema payload.
- `native`: require provider-native structured output; fail fast if unsupported or rejected.
- `prompt`: do not send native schemas; instruct the model to return JSON via prompting.
- `off`: do not enforce structured output at provider layer (useful for debugging).

Recommended default:

- Use `auto` unless you are debugging provider schema behavior.

## Provider Notes

### Gemini

Gemini may reject common JSON Schema keywords used by other providers.
If you see errors about schema fields (for example `const`, boolean enums, or empty object schemas), use:

```bash
cog run <module> --args "..." --structured prompt
```

This keeps the envelope contract stable while avoiding provider-native schema restrictions.

### MiniMax

MiniMax tends to work well with prompt-based JSON. `--structured auto` should be fine.

## Streaming Transport

Cognitive standardizes the event model, but transport differs by interface:

- HTTP: SSE is browser and proxy friendly
- CLI: NDJSON is easy to pipe, log, and replay

The protocol requirement is that streaming events allow reconstructing the final v2.2 envelope deterministically.

