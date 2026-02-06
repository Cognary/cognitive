---
title: Spec Lifecycle
---

This page defines the lifecycle rules for the `cep.*` specifications.

For the canonical version (source of truth), see `SPEC-LIFECYCLE.md` in the repository root.

## Status Levels

- `experimental`: May change without backwards compatibility guarantees.
- `stable`: Backwards compatible within the declared version line. Breaking changes require a new line and migration notes.
- `deprecated`: Still supported for at least one stable cycle, but scheduled for removal.

## Versioning

`cep.*` is versioned along multiple lines to avoid coupling unrelated concerns:

- `cep.module.v2.2`
- `cep.envelope.v2.2`
- `cep.events.v2.2`
- `cep.conformance.v2.2`
- `cep.registry` (often `experimental` longer due to distribution/trust requirements)

## Conformance Gate

No feature may be marked `stable` unless there are conformance tests for it and at least one implementation passes them.

