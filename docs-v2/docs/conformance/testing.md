---
sidebar_position: 3
---

# Conformance Testing

Use official test vectors to validate runtime behavior against Cognitive 2.2.7.

## Recommended (CLI)

Run the vectors with the reference CLI (offline, deterministic):

```bash
# Minimal contract (Level 1, envelope only)
npx cogn@<version> test --conformance --suite envelope --level 1

# Full contract (Level 3, envelope + stream + registry)
npx cogn@<version> test --conformance --suite all --level 3 --verbose
```

If you're not running from a repo checkout, pass `--spec-dir`:

```bash
npx cogn@<version> test --conformance --spec-dir /path/to/cognitive --suite all --level 3
```

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
