---
sidebar_position: 3
---

# code-simplifier

Simplify code while preserving behavior (v2.2 format).

## Basic Info

| Property | Value |
|----------|-------|
| Version | 2.2.0 |
| Tier | decision |
| Category | Code Quality |
| Format | **v2.2** |

## Features

- Remove redundant code
- Simplify complex logic
- Preserve observable behavior
- Provide change explanations

## v2.2 Response Format

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Simplified 3 patterns, behavior preserved"
  },
  "data": {
    "simplified_code": "...",
    "changes": [...],
    "behavior_equivalence": true,
    "rationale": "Detailed reasoning...",
    "extensions": {
      "insights": [...]
    }
  }
}
```

## Usage

```bash
cog run code-simplifier --args "function calculate(x) { 
  if (x > 0) { return x * 2; } 
  else { return x * 2; } 
}" --pretty
```

## Output Example

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "none",
    "explain": "Removed redundant if-else, same result regardless of condition"
  },
  "data": {
    "simplified_code": "const calculate = x => x * 2;",
    "changes": [
      {
        "type": "remove_redundancy",
        "location": "line 2-3",
        "description": "Identical branches in if-else",
        "risk": "none"
      },
      {
        "type": "simplify_logic",
        "location": "function",
        "description": "Convert to arrow function",
        "risk": "none"
      }
    ],
    "behavior_equivalence": true,
    "rationale": "Both branches of the if-else return the same expression (x * 2)...",
    "extensions": {
      "insights": [
        {
          "text": "Consider adding TypeScript types for better maintainability",
          "suggested_mapping": "data.recommendations"
        }
      ]
    }
  }
}
```

## Change Types

| Type | Description | Risk |
|------|-------------|------|
| `remove_redundancy` | Remove duplicate/unnecessary code | none-low |
| `simplify_logic` | Simplify conditional/loop logic | low-medium |
| `inline_variable` | Inline single-use variables | none |
| `extract_common` | Extract common expressions | low |
| `{ custom: "...", reason: "..." }` | Custom type with reason | varies |

## Behavior Guarantee

- `behavior_equivalence: true` - Guaranteed same observable behavior
- `behavior_equivalence: false` - Some edge cases may differ (confidence capped at 0.7)

## Schema

See [Module Format - schema.json](/docs/guide/module-format#schemajson) for complete schema.
