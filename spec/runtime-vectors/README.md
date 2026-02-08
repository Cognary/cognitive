# Runtime Conformance Vectors

These vectors validate **runtime behavior**, not just static schema validation.

They are intentionally **offline and deterministic**: each vector uses a scripted provider
that returns pre-defined responses, so no network or API keys are required.

## What This Covers

- Publish-grade JSON parsing behavior (prompt-only JSON, retries, diagnostics)
- Progressive Complexity profiles and fail-fast gates (`core/standard/certified`)

## Running

```bash
# Runtime behavior (Level 2+)
npx cogn@<version> test --conformance --suite runtime --level 2
```

