---
sidebar_position: 3
---

# Progressive Complexity

Cognitive 2.2 is meant to be usable quickly, while still supporting protocol-grade rigor when you need it.
The strategy is simple: only introduce complexity when a real requirement forces it.

## Core (5 Minutes)

If you only want to run a module, you can ignore registry, conformance, and certification:

```bash
npx cogn@2.2.13 run code-reviewer --args "def login(u,p): pass" --pretty
```

## Upgrade Triggers (When To Add What)

| When you need | Add / Enable | Commands | What you get |
|---|---|---|---|
| **Repeatable outputs** (not just text) | `schema.json` (input/data/meta) | `npx cogn@2.2.13 validate --all` | Machine-checkable contracts; fewer prompt regressions |
| **Policy guardrails** (risk, enums, overflow) | `tier`, `schema_strictness`, `overflow`, `enums` | `npx cogn@2.2.13 run ...` (default validates) | Prevents silent drift; consistent behavior across CLI/HTTP/MCP |
| **Auditability** (post-incident analysis) | Require `meta.explain` + store envelopes/events | `npx cogn@2.2.13 run --stream` | NDJSON event stream; you can reconstruct end state + debug failures |
| **Team portability** (move between repos) | Project-local modules | Put modules under `./cognitive/modules/` | "Works on my machine" becomes "works in this repo" |
| **Distribution** (discover + install) | Registry index + Release tarballs | `npx cogn@2.2.13 search`, `npx cogn@2.2.13 add <registry>` | Deterministic installs and version pinning; safer sourcing model |
| **Interoperability claims** | Conformance tests + vectors | `npx cogn@2.2.13 test` | Evidence the runtime matches CEP behavior (not marketing) |
| **Ecosystem trust** (signals, badges) | Certification policy + verification | CI + signed results | Shared trust layer for enterprises and tool vendors |

## Recommended Milestones

1. Prototype: use existing modules from a registry or GitHub repo.
2. Team usage: commit modules + add `schema.json` + run `npx cogn@2.2.13 validate --all` in CI.
3. Production: require `meta.explain`, log envelopes/events, and use strict(er) policies for risky tiers.
4. Distribution: publish a registry index and GitHub Release tarballs; install from the index.
5. Ecosystem: publish conformance results and certification signals.

## Transport Note (SSE vs NDJSON)

It is reasonable to standardize on:

- HTTP: **SSE** for streaming (browser-friendly, proxies well)
- CLI: **NDJSON** for streaming (one JSON per line, easy to pipe and log)

The key protocol requirement is that both transports carry the same *event model* and allow rebuilding the final
envelope deterministically.
