# Cognitive Roadmap

This roadmap defines how Cognitive evolves from a feature-rich open-source runtime into a smaller, clearer, publish-grade protocol tool.

The core principle is:

- default like a tool
- core like a protocol
- advanced capability only when needed

## Product Direction

Cognitive is not trying to be a general-purpose AI framework.

The intended position is:

**a verifiable, portable, publishable contract runtime for AI tasks**

That means the roadmap prioritizes:

- stable envelope contracts
- provider differences that do not break user workflows
- clear progressive complexity (`core`, `standard`, `certified`)
- publishable artifacts, conformance, and auditability

It explicitly deprioritizes:

- broad provider count for its own sake
- multiple outward-facing runtimes
- expanding surface area before tightening defaults

## Current Strategy

The current strategy is to reduce cognitive load without deleting the protocol value.

What stays central:

- v2.2 envelope
- schema plus post-validation
- provider capabilities and downgrade behavior
- `core`, `standard`, `certified` profiles
- conformance and runtime vectors
- registry artifacts and verify
- audit and provenance

What stays hidden by default:

- experimental or community providers
- registry details
- certification details
- long-tail provider-specific caveats

## v2.2.x - Stabilize and Tighten

Goal: make the current system reliable enough to ship without hesitation.

### Priorities

1. Fix contract-consistency bugs
- Any issue that causes the same input to behave inconsistently is P1/P2.
- Examples: partial substitution, repeated directive mismatch, profile mismatch, provider downgrade drift.

2. Keep the first-run path minimal
- `core run` remains the single canonical first-run entrypoint.
- Quickstart, README, and homepage should point to the same path.

3. Make provider behavior resilient
- Stable support surface remains intentionally small.
- Provider-specific incompatibilities must degrade safely instead of breaking runs.
- Explanations must appear in `meta.policy.*` and verbose output.

4. Keep release gates strict
- `release:check`
- package build
- docs build
- minimum conformance checks
- npm pack verification

### Exit Criteria

- publish flow is repeatable
- docs and CLI tell the same story
- stable providers do not break the default path
- high-priority consistency bugs are closed

## v2.3 - Clarify the Product

Goal: make Cognitive easy to understand, not just technically capable.

### Priorities

1. Make progressive complexity obvious
- `core`: 5-minute path, one-file runnable, lowest friction
- `standard`: recommended day-to-day mode
- `certified`: strongest gates for auditable or publishable flows

2. Focus on killer use cases
- PR review gate
- structured extraction / decision gate

These should be the main outward-facing demos, templates, and docs examples.

3. Rework docs around scenarios
- homepage should lead with use cases, not protocol jargon
- docs should route by task first, not by internal subsystem first

4. Explain positioning clearly
- what Cognitive is
- what it is not
- how it differs from prompts, skills, MCP tools, and generic agent wrappers

### Exit Criteria

- a new user can understand the product from the homepage
- the value is visible before the protocol depth
- at least one killer use case feels obviously better than ad-hoc prompting

## v2.4 - Open the Protocol Surface

Goal: move from a strong project to a compatibility-friendly protocol tool.

### Priorities

1. Publish the minimum contract set
- envelope contract
- runtime behavior contract
- provider capability contract
- publishable artifact contract

2. Make external implementation possible
- provider extension guide
- minimal compatibility tests
- stable error-code expectations
- conformance minimum set

3. Stabilize registry artifact behavior
- explicit `latest` policy
- reproducible metadata
- clear remote verification behavior
- documented failure diagnosis

4. Add ecosystem signals
- compatibility guidance
- badge/checklist ideas
- "what must pass" for compatible runtimes or providers

### Exit Criteria

- a third party can implement a compatible provider or runtime with reasonable effort
- compatibility can be tested instead of inferred
- registry artifacts and contract checks are publish-grade

## What Not To Do Yet

The following are intentionally not roadmap priorities until the product is tighter:

- aggressively adding more providers
- reviving a second outward-facing runtime surface
- expanding the default CLI with more top-level concepts
- increasing protocol complexity before the default path is simpler

## Release Heuristic

Before shipping a release, use this rule:

- `v2.2.x`: stronger, safer, clearer
- `v2.3`: simpler to understand
- `v2.4`: easier for others to adopt and implement

If a change does not help one of those outcomes, it is probably not the next best change.

