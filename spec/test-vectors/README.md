# Cognitive Modules Test Vectors

Official test vectors for validating Cognitive Modules v2.2 runtime implementations.

## Purpose

These test vectors allow any implementation of a Cognitive Modules runtime to verify conformance with the specification. Implementations MUST pass all test vectors to claim compliance.

## Directory Structure

```
test-vectors/
├── valid/                    # Valid responses that MUST be accepted
│   ├── minimal.json          # Minimal valid envelope
│   ├── full-featured.json    # Complete envelope with all optional fields
│   ├── success-*.json        # Various success scenarios
│   └── failure-*.json        # Valid failure responses
├── invalid/                  # Invalid responses that MUST be rejected
│   ├── missing-*.json        # Missing required fields
│   ├── wrong-type-*.json     # Type violations
│   └── constraint-*.json     # Constraint violations
└── README.md                 # This file
```

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

### For Runtime Implementers

```python
import json
from your_runtime import validate_envelope

def run_test_vectors(directory):
    for file in directory.glob("**/*.json"):
        with open(file) as f:
            test = json.load(f)
        
        test_meta = test["$test"]
        envelope = test["envelope"]
        
        try:
            result = validate_envelope(envelope)
            if test_meta["expects"] == "reject":
                print(f"FAIL: {file} should have been rejected")
            else:
                print(f"PASS: {file}")
        except ValidationError as e:
            if test_meta["expects"] == "accept":
                print(f"FAIL: {file} should have been accepted")
            else:
                print(f"PASS: {file}")
```

## Contributing

When adding new test vectors:

1. Use descriptive filenames
2. Include `$test` metadata
3. Add corresponding `_zh.md` description if applicable
4. Ensure test covers a single validation rule

## Version

These test vectors are for Cognitive Modules Specification v2.2.
