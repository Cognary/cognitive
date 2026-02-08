---
sidebar_position: 7
---

# Module Testing (Golden Tests)

v2.2 supports **golden tests** as a specification for input/output validation. The Node CLI currently does **not** include a dedicated test runner, but the format is stable and can be used by custom tooling.

## Directory Layout

```
my-module/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
    ├── case1.input.json
    └── case1.expected.json
```

## Input File

```json
{
  "query": "review this code"
}
```

## Expected File

Two supported styles:

### 1) Exact Match

```json
{
  "ok": true,
  "data": {
    "summary": "..."
  }
}
```

### 2) Validation Rules

```json
{
  "_validate": {
    "required": ["ok", "meta", "data"],
    "confidence_min": 0.7
  }
}
```

## Recommendation

- Keep tests in `tests/` for future automated runners
- Use `npx cogn@2.2.12 validate` for structural checks
- For CI, build a simple runner that executes `npx cogn@2.2.12 run` and asserts the expected file
