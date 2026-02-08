---
sidebar_position: 8
---

# Extending Providers

The npm runtime is provider-agnostic, but the project intentionally maintains a **small stable support surface**:

- OpenAI (ChatGPT)
- Anthropic (Claude)
- Gemini
- MiniMax
- DeepSeek
- Qwen (DashScope)

Other providers may exist as experimental/community integrations. They can work, but they are not part of the stable promise and may require provider-specific adaptation.

This page shows how to add (or adapt) a provider in a way that preserves the **publish-grade contract**:

- Always emit a v2.2 envelope (`ok/meta/data|error`).
- Keep runs resilient: if native schemas are unsupported or rejected, downgrade safely and continue (prompt-only JSON + post-validation).
- Make behavior explainable via `meta.policy.*` when `--verbose` is enabled.

## What You Implement

Providers implement the `Provider` interface:

- File: `packages/cli-node/src/types.ts`
- Minimal requirements:
  - `name`
  - `isConfigured()`
  - `invoke({ messages, jsonSchema?, jsonSchemaMode?, temperature?, maxTokens? })`

Optional but recommended:

- `getCapabilities()` returning `ProviderCapabilities`
  - `structuredOutput`: `none | prompt | native`
  - `nativeSchemaDialect` when `native` (for example `json-schema` vs `gemini-responseSchema`)
  - `maxNativeSchemaBytes`
  - `streaming` boolean

## Register the Provider

1. Add your provider implementation under:
   - `packages/cli-node/src/providers/<name>.ts`
2. Register it in the provider registry:
   - `packages/cli-node/src/providers/index.ts`

You must decide its support tier:

- `stable`: shown by default in `cog providers`, included in docs/CI promise
- `experimental/community`: hidden by default, shown only via `cog providers --all`

## Structured Output Compatibility

The runtime uses `--structured` and provider capabilities to decide one of:

- `native`: use provider-native structured output (when compatible)
- `prompt`: inject schema guidance into the prompt
- `off`: do not send schema hints to the provider layer (still parses/validates post-hoc)

If a provider rejects a schema payload, the runtime may retry once with `native -> prompt` (when `--structured auto`).

Guidance:

- If your provider supports strict JSON Schema natively, report:
  - `structuredOutput: 'native'`
  - `nativeSchemaDialect: 'json-schema'`
- If the provider supports a native schema API but the dialect differs, report that dialect so the runtime can avoid sending incompatible JSON Schema and fall back to `prompt`.

## Error and Diagnostics Expectations

Provider failures should throw an `Error` with a clear message (HTTP status + body when possible).

The runtime will:

- Wrap provider failures into the unified envelope `error` shape.
- Preserve a stable error code surface (provider/runtime errors are typically `E4000`).
- Include `provider` and `module` context for debugging.

## Minimal Tests (Required)

Add a unit test that proves request shaping works without real network calls:

- File: `packages/cli-node/src/providers/<name>.test.ts`
- Use a stubbed `globalThis.fetch` to capture and assert request body fields.

Optional but recommended:

- Add conformance vectors when behavior affects the envelope contract.
- Gate experimental provider tests behind an env flag (for example `COG_TEST_EXPERIMENTAL_PROVIDERS=1`) to keep CI reliable.

## Local Dev Loop

```bash
cd packages/cli-node
npm test
npm run build
node ./bin.js providers --pretty --all
```

