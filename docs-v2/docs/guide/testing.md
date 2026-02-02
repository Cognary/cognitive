---
sidebar_position: 7
---

# Module Testing

Cognitive Modules supports Golden Tests to verify module behavior.

## Golden Test Concept

Golden Test is a testing method based on known input-output pairs:

1. **Input file**: `tests/case1.input.json` - Module input
2. **Expected file**: `tests/case1.expected.json` - Expected output or validation rules

```
code-simplifier/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
    ├── case1.input.json
    ├── case1.expected.json
    ├── case2.input.json
    └── case2.expected.json
```

## Test File Format

### Input File

```json title="tests/case1.input.json"
{
  "code": "function add(a, b) { return a + b; }",
  "language": "javascript"
}
```

### Expected File

Two modes supported:

#### Mode 1: Exact Match

```json title="tests/case1.expected.json"
{
  "simplified_code": "const add = (a, b) => a + b;",
  "confidence": 0.95
}
```

#### Mode 2: Validation Rules

```json title="tests/case1.expected.json"
{
  "_validate": {
    "required": ["simplified_code", "confidence", "rationale"],
    "confidence_min": 0.7,
    "confidence_max": 1.0,
    "rationale_min_length": 50
  }
}
```

## Running Tests

```bash
# Test single module
cogn test code-simplifier

# Test all modules
cogn test --all

# Verbose output
cogn test code-simplifier -v
```

## Validation Rules

| Rule | Description |
|------|-------------|
| `required` | Required fields array |
| `confidence_min` | Minimum confidence |
| `confidence_max` | Maximum confidence |
| `rationale_min_length` | Minimum rationale length |
| `contains` | Output must contain strings |
| `not_contains` | Output must not contain strings |

## Example

### Complete Test Case

```json title="tests/sql_injection.input.json"
{
  "code": "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"
}
```

```json title="tests/sql_injection.expected.json"
{
  "_validate": {
    "required": ["issues", "confidence", "rationale"],
    "confidence_min": 0.8
  },
  "_contains": {
    "issues[*].type": ["security"],
    "rationale": ["SQL injection", "f-string"]
  }
}
```

## CI Integration

```yaml title=".github/workflows/test.yml"
name: Test Modules

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: pip install cognitive-modules
      - run: cogn test --all
```

## Best Practices

1. **Cover edge cases** - Empty input, max length, special chars
2. **Test error scenarios** - Invalid input should return proper errors
3. **Pin confidence ranges** - Don't expect exact values
4. **Document test intent** - Comment why each test exists
