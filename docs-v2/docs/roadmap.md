---
sidebar_position: 2
title: Roadmap
---

# Roadmap

Cognitive is being tightened in three steps:

- keep the default path small
- keep the contract surface strong
- expose advanced capability only when it is needed

The canonical repository roadmap lives in the root `ROADMAP.md`. This docs page is the navigation entry for that plan.

## Product Direction

Cognitive is not aiming to be a general-purpose AI framework.

The intended position is:

**a verifiable, portable, publishable contract runtime for AI tasks**

That means the roadmap prioritizes:

- stable envelope contracts
- provider differences that do not break user workflows
- progressive complexity through `core`, `standard`, and `certified`
- publishable artifacts, conformance, and auditability

## v2.2.x - Stabilize and Tighten

Goal: make the current system reliable enough to ship without hesitation.

Priorities:

- close contract-consistency bugs
- keep `core run` as the single first-run path
- make provider downgrade behavior safe and explainable
- keep release gates strict: build, docs, conformance, pack checks

Exit criteria:

- publish flow is repeatable
- docs and CLI tell the same story
- stable providers do not break the default path

## v2.3 - Clarify the Product

Goal: make Cognitive easier to understand, not just technically capable.

Priorities:

- make `core`, `standard`, and `certified` obvious
- lead with killer use cases such as PR review and structured decision gates
- organize docs around tasks instead of internal subsystems
- explain how Cognitive differs from prompts, skills, MCP tools, and generic wrappers

Exit criteria:

- a new user can understand the product from the homepage
- the default path feels lighter than the protocol surface

## v2.4 - Open the Protocol Surface

Goal: make compatible external implementations realistic.

Priorities:

- publish the minimum contract set
- provide a provider extension guide and minimal compatibility tests
- stabilize registry artifact behavior and remote verification diagnosis
- make compatibility measurable instead of implied

Exit criteria:

- a third party can implement a compatible provider or runtime with reasonable effort
- compatibility can be tested directly

## Read the Full Plan

- Repository roadmap: `ROADMAP.md`
- Next practical entry points:
  - [Progressive Complexity](./getting-started/progressive-complexity)
  - [Killer Use Cases](./getting-started/use-cases)
  - [Conformance Center](./conformance)
