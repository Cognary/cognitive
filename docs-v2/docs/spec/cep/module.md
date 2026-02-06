---
title: cep.module.v2.2
---

This document specifies the module format and composition semantics for `cep.module.v2.2`.

## In Scope

- `module.yaml` schema and required fields
- Module identity and versioning expectations
- `requires` dependency declarations
- Composition semantics: `sequential`, `parallel`, `conditional`, `iterative`
- Timeout, fallback, max depth, and determinism rules

## Out of Scope

- Provider-specific model invocation details
- Registry trust/signing and distribution

## Open Questions (to be resolved before Stable)

- Exact version range grammar for `requires.version` (including `<` and `<=`)
- Deterministic aggregation rules for multi-source inputs in parallel execution
- Cancellation semantics for timeouts (whether execution MUST be aborted)

