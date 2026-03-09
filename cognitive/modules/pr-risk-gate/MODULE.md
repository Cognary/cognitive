---
name: pr-risk-gate
version: 2.2.16
responsibility: Returns a merge-gate decision contract for risky PR diffs
---

# PR Risk Gate

This module is the canonical Cognitive killer use case.

It does one thing:

**turn a PR diff into a stable release-gate contract**.

## Input

- `diff`: unified diff text
- or `code`: code snippet when a diff is unavailable

## Output

A v2.2 envelope whose `data` contains:
- `decision`
- `blocking`
- `findings[]`
- `rationale`

`meta.risk` is the routing field you use in CI.

## Intended Use

- PR review gates
- high-risk change triage
- provider-portable structured review in CI
