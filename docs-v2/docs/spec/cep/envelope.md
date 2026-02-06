---
title: cep.envelope.v2.2
---

This document specifies the execution result envelope for `cep.envelope.v2.2`.

## Goals

- One canonical success/failure shape across CLI/HTTP/MCP.
- Stable error structure with explicit codes.
- Machine-parseable `meta` (including `risk`) with strict validation.

## Required Fields (High Level)

- `ok`: boolean
- `version`: string (MUST be `"2.2"` for `cep.envelope.v2.2`)
- `data`: any (present on success; may be present on failure as partial output)
- `error`: object (present on failure; must include `code` and `message`)
- `meta`: object (risk/explain/trace-related fields; must be an object when present)

## Optional Context Fields

- `module`: string (transport context)
- `provider`: string (transport context)

## Notes

- Trace/debug wrappers (for example `compose --trace`) are not the pure envelope and must be documented as such.
