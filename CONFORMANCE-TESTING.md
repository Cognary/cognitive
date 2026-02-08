# Conformance Testing Guide

This guide is for developers implementing a Cognitive Modules runtime who want to verify conformance with the specification.

## Quick Start

### 1. Clone the Test Vectors

```bash
git clone https://github.com/Cognary/cognitive.git
cd cognitive
```

### 2. Run Official Validators

```bash
# Minimal contract (Level 1, envelope only)
npx cogn@<version> test --conformance --suite envelope --level 1

# Level 2 contract (envelope + runtime behavior)
npx cogn@<version> test --conformance --suite all --level 2

# Full contract (Level 3, envelope + runtime + stream + registry)
npx cogn@<version> test --conformance --suite all --level 3 --verbose
```

You can also run the standalone scripts (they validate the same vectors):

```bash
tsx scripts/validate-test-vectors.ts --level 3 --verbose
tsx scripts/validate-stream-vectors.ts --level 3 --verbose
tsx scripts/validate-registry-vectors.ts --level 3 --verbose
```

**Registry safety (tarball extraction):**
```bash
cd packages/cli-node
npm test
```

The Node CLI test suite includes tarball extraction safety checks:

- `packages/cli-node/src/registry/tar.test.ts`

### 3. Integrate Into Your Test Suite

See examples below for your language.

---

## Test Vector Structure

Each test vector file contains:

```json
{
  "$test": {
    "name": "test-name",
    "description": "What this test validates",
    "expects": "accept" | "reject",
    "conformance_level": 1 | 2 | 3,
    "error_codes": ["E1001"]  // For reject cases
  },
  "envelope": {
    // The response envelope to validate
  }
}
```

## Conformance Levels

| Level | Name | Requirements |
|-------|------|--------------|
| 1 | Basic | Core envelope validation (ok, meta, data/error) |
| 2 | Standard | + Tier support, overflow handling, error codes |
| 3 | Full | + Composition, context protocol, all features |

## Implementer Notes

If you're writing your own runtime in another language, the contract is defined by:

- `spec/response-envelope.schema.json`
- `spec/test-vectors/` (accept/reject)
- `spec/runtime-vectors/` (runtime behavior: profiles + JSON parsing)
- `spec/stream-events.schema.json` + `spec/stream-vectors/`
- `spec/registry.schema.json` + `spec/registry-entry.schema.json` + `spec/registry-vectors/`

## CI Integration

### GitHub Actions Example

```yaml
name: Conformance Tests

on: [push, pull_request]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run conformance vectors
        run: |
          npx cogn@<version> test --conformance --suite all --level 3 --json
```

---

## Claiming Conformance

To claim conformance with the Cognitive Modules specification:

1. **Pass all test vectors** at your claimed level
2. **Document your level** in your README:
   ```markdown
   ## Conformance
   
   This implementation passes Cognitive Modules v2.2 conformance tests at **Level 2 (Standard)**.
   ```
3. **Run tests in CI** to maintain conformance

### Conformance Badge (Coming Soon)

We plan to provide conformance badges for verified implementations. Stay tuned.

---

## Submitting Your Implementation

If you've built a conformant implementation, we'd love to list it!

1. Open an issue with:
   - Implementation name and URL
   - Language/platform
   - Conformance level achieved
   - CI badge or test results link

2. We'll review and add it to the official implementations list.

---

## Questions?

- Open an issue on [GitHub](https://github.com/Cognary/cognitive/issues)
- Read the [CONFORMANCE.md](./CONFORMANCE.md) for detailed requirements
- Check [SPEC-v2.2.md](./SPEC-v2.2.md) for the full specification
