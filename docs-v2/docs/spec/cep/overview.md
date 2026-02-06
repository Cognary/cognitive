---
title: CEP Overview
---

`cep.*` (Cognitive Execution Protocol) defines a stable, implementation-agnostic way to describe and execute Cognitive Modules across transports (CLI/HTTP/MCP/SDKs).

## Spec Lines

- `cep.module.v2.2`: Module identity, `module.yaml`, composition semantics.
- `cep.envelope.v2.2`: Execution envelope and error model.
- `cep.events.v2.2`: Streaming event model (must be able to reconstruct a final envelope).
- `cep.conformance.v2.2`: Conformance levels, test vectors, and required assertions.
- `cep.registry`: Discovery and distribution (typically `experimental` longer due to security/trust).

## Design Goals

- Deterministic behavior: composition and policy decisions should be spec-defined.
- Cross-transport consistency: CLI/HTTP/MCP should converge on the same envelope and error shape.
- Security-first for distribution: registry and installation flows must be safe by default.

