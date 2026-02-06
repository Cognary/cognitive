# CEP Spec Lifecycle

This repository defines the `cep.*` (Cognitive Execution Protocol) specifications.

The goal is interoperability across implementations (CLI/HTTP/MCP/SDKs) with a stable core data model, a strict conformance suite, and well-scoped extension points.

## Status Levels

Each spec section and field MUST declare one of the following statuses.

- `experimental`: May change in any release without backwards compatibility guarantees.
- `stable`: Backwards compatible within the declared major/minor line. Breaking changes require a new major (or a new `vX.Y` line) and migration notes.
- `deprecated`: Still supported for at least one stable cycle, but scheduled for removal. Replacement MUST be documented.

## Versioning

We version `cep.*` along multiple lines to avoid coupling unrelated concerns:

- `cep.module.v2.2`
- `cep.envelope.v2.2`
- `cep.events.v2.2`
- `cep.conformance.v2.2`
- `cep.registry` (typically stays `experimental` longer because it involves trust and distribution security)

Rule of thumb:

- Additive changes (new optional fields, new error codes, new events) are allowed in-place within a stable line.
- Breaking changes require a new line (for example `cep.envelope.v2.3` or `cep.envelope.v3.0`) and a migration guide.

## Change Process (CMEP/RFC)

All normative spec changes MUST follow a lightweight RFC process to keep the protocol implementable.

1. Draft proposal
   - Describe motivation, scope, and compatibility impact.
   - Provide examples and edge cases.
2. Reference implementation
   - Update at least one implementation path (CLI/HTTP/MCP) or a validator.
3. Conformance updates
   - Add or update test vectors that prove the behavior.
4. Review and merge
   - Review focuses on determinism, security, and interop.
5. Release notes
   - Document the impact and migration path (if any).

Non-normative edits (typos, clarifications with no behavior change) may skip steps 2-3.

## Conformance Gate

No feature may be marked `stable` unless:

- There are conformance tests for it, and
- At least one implementation passes those tests, and
- The error model is explicitly specified (including failure modes).

