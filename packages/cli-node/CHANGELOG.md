# Changelog

All notable changes to this package are documented in this file.

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
