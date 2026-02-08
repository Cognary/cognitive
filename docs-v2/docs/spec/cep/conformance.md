---
title: cep.conformance.v2.2
---

This document specifies the conformance model for `cep.conformance.v2.2`.

## What Conformance Covers

- Schema validity for `module.yaml` and envelopes
- Error model consistency (codes, shapes, strict typing)
- Cross-transport consistency (CLI/HTTP/MCP)
- Deterministic composition behaviors (timeouts, fallback, aggregation)

## Test Vectors

Conformance MUST be backed by test vectors with a clear level system.

Implementations SHOULD provide a command like `npx cogn@2.2.13 test` to run vectors and report:

- Pass/fail per vector
- Failure reason with canonical error codes
- Optional trace output (non-normative)
