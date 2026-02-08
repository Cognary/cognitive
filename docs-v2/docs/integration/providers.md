---
sidebar_position: 5
---

# Providers and Capabilities

Cognitive Modules is **provider-agnostic**. Different LLM providers have different feature support (especially for structured output / JSON Schema).

The runtime is designed to keep the **user-visible contract stable**:

- It always emits the unified v2.2 envelope (`ok/meta/data|error`).
- It validates the envelope shape.
- When provider-native structured output is unavailable or rejected, it **downgrades safely** and continues with prompt-only JSON plus post-validation.

## Selecting a Provider

Provider selection is automatic based on which API key is present. You can override explicitly:

```bash
npx cogn@<version> run <module> --provider minimax --model MiniMax-M2.1 --args "hello"
```

To see what the runtime thinks is available:

```bash
npx cogn@<version> providers --pretty
```

## Structured Output (Schema) Policy

Use `--structured` to control how the runtime applies schemas at the provider layer:

- `--structured auto` (default)
- `--structured native` (prefer native **JSON Schema** enforcement when supported; otherwise downgrades safely)
- `--structured prompt` (always prompt-only JSON; still post-validates)
- `--structured off` (do not use provider-layer schemas; still enforces envelope parsing and post-validation)

### Downgrade Rules (Native -> Prompt)

When `--structured auto` is used, the runtime may attempt provider-native structured output first.

If the provider rejects the schema payload (compatibility / schema-subset errors), the runtime retries once using prompt-only JSON. This is intentional:

- Keeps the contract stable across providers.
- Avoids breaking runs due to provider-specific schema limitations.

The runtime records this decision in the envelope:

- `meta.policy.structured`
- `meta.policy.parse` (parse strategy + retry count)

`meta.policy.structured` is intentionally small but **diagnostic**. Fields:

- `requested`: what the user asked for (`auto|native|prompt|off`)
- `resolved`: what the runtime planned to do (same enum)
- `applied`: what actually happened (after any retry / downgrade)
- `downgraded`: `true` if `applied != resolved`
- `fallback.attempted`: whether a native->prompt retry happened
- `fallback.reason`: compact reason string when a retry happened
- `provider.*`: capability snapshot (for debugging provider differences)

## Profiles and Safety Gates

Profiles control "progressive complexity" and what the runtime enforces by default:

- `core`: minimal gates (fast path, lowest friction)
- `standard`: day-to-day defaults (recommended)
- `certified`: strongest gates (auditable + publishable flows)

Key behavior differences:

- JSON parsing retry:
  - `standard`: retries once if the model returns invalid JSON.
  - `certified`: fail-fast (no parse retry), returns `E1000` with diagnostics.
- Provenance/integrity gates:
  - `certified` requires registry provenance + integrity checks for installed modules.

## Provider Notes (Known Differences)

### Gemini

Gemini's native `responseSchema` support is **not full JSON Schema**. Some schema constructs may be rejected with a 400 error.

Recommended:

```bash
npx cogn@<version> run <module> --structured auto
```

If you hit schema-compatibility errors, force prompt mode:

```bash
npx cogn@<version> run <module> --structured prompt
```

### Moonshot (Kimi)

Some Kimi models may enforce fixed generation parameters (for example, specific `temperature` rules).

If you see an error like "invalid temperature ...", use the recommended defaults and avoid forcing generation params.

### MiniMax / DeepSeek / OpenAI / Anthropic / Qwen

These providers typically work well with prompt-only JSON and the runtime's post-validation.
Native structured output support varies and may be introduced/changed over time.

## Why Prompt-Only + Post-Validation Still Matters

Provider-native structured output is an **optimization**, not the core contract.

The core value of Cognitive Modules remains:

- a stable envelope contract
- explicit schemas
- deterministic validation + error taxonomy
- auditability and publishable provenance

Prompt-only JSON plus post-validation is how the runtime stays robust across providers while preserving the spec contract.
