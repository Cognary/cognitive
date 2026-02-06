---
sidebar_position: 3
---

# Conformance Testing

Use official test vectors to validate runtime behavior against Cognitive 2.2.7.

## What to Validate

- Valid success envelopes
- Valid failure envelopes
- Invalid payload rejection
- Tier and policy enforcement
- Composition/context behavior (when supported)

## Recommended Workflow

1. Run all level-1 vectors.
2. Run level-2 vectors if tier/policy features are implemented.
3. Run level-3 vectors if composition/context are implemented.
4. Record pass/fail artifacts in CI.

## Source of Truth

- `CONFORMANCE-TESTING.md`
- `spec/test-vectors/README.md`
