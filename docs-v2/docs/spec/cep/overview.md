---
title: CEP Overview
---

`cep.*` (Cognitive Execution Protocol) defines a stable, implementation-agnostic way to describe and execute Cognitive Modules across transports (CLI/HTTP/MCP/SDKs).

## Core vs Extensions

To keep Cognitive portable, `cep.*` is split into a small **Core** (required) and optional **Extensions**.

### Core (MUST)

Any implementation claiming CEP compatibility MUST support:

- `cep.envelope.v2.2`: The response envelope, including the error model.
- `cep.module.v2.2`: Module identity and the minimum `module.yaml` contract.
- `cep.events.v2.2`: Streaming event model where the final event can reconstruct a valid envelope result.

### Extensions (MAY)

Implementations MAY add support for:

- `cep.conformance.v2.2`: Conformance levels and test vectors.
- `cep.registry` (Draft): Discovery and distribution (security/trust sensitive; often evolves slower).
- Higher-level runtime features (composition, certification, provider catalogs, policy engines).

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

## Progressive Complexity

CEP is designed to start simple and only add structure when you need it:

- 5-minute adoption: run modules via CLI/HTTP/MCP and consume the same envelope and error structure.
- Add verification: enable strict schema validation and conformance checks when outputs must be provably correct.
- Add distribution: move from local modules to registry indexes and signed release assets when you need reproducible installs.

See also:

- [Publishable Artifacts](./artifacts)
