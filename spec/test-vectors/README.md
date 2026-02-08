# Cognitive Modules Test Vectors

Official test vectors for validating Cognitive Modules v2.2 runtime implementations.

## Purpose

These test vectors allow any implementation of a Cognitive Modules runtime to verify conformance with the specification. Implementations MUST pass all test vectors to claim compliance.

## Directory Structure

```
test-vectors/
├── valid/                         # Valid responses that MUST be accepted
│   ├── minimal.json               # Minimal valid envelope
│   ├── full-featured.json         # Complete envelope with all optional fields
│   ├── tier-*.json                # Tier-specific responses (exec, decision, exploration)
│   ├── composition-*.json         # Composition pattern responses
│   ├── context-*.json             # Context protocol responses
│   ├── overflow-extensions.json   # Overflow handling
│   └── failure-*.json             # Valid failure responses
├── invalid/                       # Invalid responses that MUST be rejected
│   ├── missing-*.json             # Missing required fields
│   ├── wrong-*.json               # Type violations
│   ├── extensions-*.json          # Extension constraint violations
│   └── *.json                     # Other constraint violations
└── README.md                      # This file
```

## Streaming Vectors

Streaming conformance is validated separately under:

```
spec/stream-vectors/
```

Those vectors validate `cep.events.v2.2` event shapes and require that terminal `end.result` conforms to the response envelope schema.

## Registry Vectors

Registry conformance is validated separately under:

```
spec/registry-vectors/
```

Those vectors validate the registry index schema and registry entry schema (tarball + checksum required).

## Test Vector Format

Each test vector is a JSON file with the following structure:

```json
{
  "$test": {
    "name": "test-name",
    "description": "What this test validates",
    "expects": "accept" | "reject",
    "conformance_level": 1 | 2 | 3,
    "error_codes": ["E1001"]  // Expected error codes if rejected
  },
  "envelope": {
    // The actual response envelope to validate
  }
}
```

## Conformance Levels

Test vectors are tagged with the minimum conformance level required:

- **Level 1 (Basic)**: Core envelope validation
- **Level 2 (Standard)**: Full tier support + error codes
- **Level 3 (Full)**: Composition + context + all features

## Running Tests

### Recommended (CLI)

Run the official vectors with the reference CLI (no network required):

```bash
# From a repo checkout (auto-detects ./spec)
npx cogn@<version> test --conformance --suite envelope --level 1

# Full contract (envelope + streaming + registry)
npx cogn@<version> test --conformance --suite all --level 3
```

### Alternative (Scripts)

If you prefer running the standalone validators:

```bash
tsx scripts/validate-test-vectors.ts --level 3 --verbose
tsx scripts/validate-stream-vectors.ts --level 3 --verbose
tsx scripts/validate-registry-vectors.ts --level 3 --verbose
```

## Contributing

When adding new test vectors:

1. Use descriptive filenames
2. Include `$test` metadata
3. Add corresponding `_zh.md` description if applicable
4. Ensure test covers a single validation rule

## Version

These test vectors are for Cognitive Modules Specification v2.2.
