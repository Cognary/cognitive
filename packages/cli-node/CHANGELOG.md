# Changelog

All notable changes to this package are documented in this file.

## 2.2.16 - 2026-03-09

- Fix: preserve module-local `$defs` / `definitions` when loading `schema.json`, so runtime validation can resolve internal references inside `data`, `meta`, and `error` sub-schemas.
- Hardening: restore the official `pr-risk-gate` smoke path; schema validation now succeeds for contracts that include local schema references such as `extensions`.

## 2.2.15 - 2026-03-09

- Runtime: add schema-guided output canonicalization so enum labels and unordered arrays can be normalized before validation/repair.
- Benchmarks: tighten gate/extraction contracts around canonical labels and publish `Benchmark Evidence` showing Gemini + MiniMax contract stability.
- Use case: add the official `pr-risk-gate` module plus a copy-paste GitHub Actions template for blocking risky PRs in CI.

## 2.2.14 - 2026-03-08

- Release: add docs build to `release:check`, so docs regressions fail before npm publish.
- Hardening: `packages/cogn` now runs the primary runtime release gate before alias-package publish checks.
- Providers: preserve Anthropic streaming input/output token accounting correctly.
- Test coverage: add request-shaping tests for the full stable provider set (`openai`, `anthropic`, `gemini`, `minimax`, `deepseek`, `qwen`).

## 2.2.13 - 2026-02-08

- Fix: do not repair/convert successful envelopes into error envelopes when output validation is disabled (`--profile core`/`validate=off`).

## 2.2.12 - 2026-02-08

- Conformance: add `runtime` suite (offline, deterministic vectors) to validate publish-grade JSON parsing and profile gates.
- UX: conformance help/usage now documents `--suite runtime` explicitly.

## 2.2.11 - 2026-02-07

- Fix: Gemini `responseSchema` compatibility by dropping non-string `enum`/`const` constraints (Gemini rejects boolean enums).

## 2.2.10 - 2026-02-07

- Fix: Gemini `responseSchema` compatibility by converting JSON-Schema `const` to `enum`.

## 2.2.9 - 2026-02-07

- Fix: `cog core run` now prints the error envelope (instead of `Error: undefined`) when execution fails.
- Packaging: add stable `bin.js` entrypoint so publish/install doesn't depend on prebuilt `dist/` existing at publish-time.
- Core: align core template placeholders with runtime substitution (`${query}` / `${code}`); missing fields are treated as empty for single-file modules.

## 2.2.8 - 2026-02-07

- Fix: `npx cogn` alias compatibility on newer Node (exports + ESM). (Alias fix ships in `cogn@2.2.8`.)
- Hardening: configurable registry index fetch limits (`--registry-timeout-ms`, `--registry-max-bytes`).
- Hardening: remote registry verification supports bounded concurrency (`--concurrency`).

## 2.2.7 - 2026-02-06

- Standardized v2.2 runtime behavior and cross-surface error envelope consistency (CLI/HTTP/MCP).
- Clarified `compose` output contract: default/pretty output returns full v2.2 envelope, while `compose --trace` returns a debug wrapper object (`result/moduleResults/trace/totalTimeMs`) for diagnostics.
- Hardened module add/update/remove and registry path handling against traversal risks.
- Improved composition/subagent/streaming reliability and fallback handling.
- Added stricter package publish checks and metadata alignment for npm release.
