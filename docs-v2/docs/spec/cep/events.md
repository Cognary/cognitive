---
title: cep.events.v2.2
---

This document specifies the streaming event model for `cep.events.v2.2`.

## Core Requirement

A streaming sequence MUST be able to reconstruct a final `cep.envelope.v2.2` result.

## Event Categories (Draft)

- `start`: execution started
- `delta`: incremental output delta (provider streaming chunk)
- `meta`: incremental meta updates (subset of `cep.envelope` meta)
- `error`: error signal (may appear before `end`)
- `end`: terminal event, MUST include `result` which conforms to `cep.envelope.v2.2`

## Minimal Fields

Every event MUST include:

- `type`
- `version` (MUST be `"2.2"`)
- `timestamp_ms`
- `module`

Optional context fields:

- `provider`

## Open Questions

- Transport framing (SSE vs NDJSON) and the canonical mapping per transport
- Ordering guarantees for `delta` vs `meta`
