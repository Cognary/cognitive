---
sidebar_position: 4
---

# Context Philosophy

> **Cognitive trades conversational convenience for engineering certainty.**
> 
> It's not about avoiding dynamics, but avoiding uncontrollable dynamics.

## Core Distinction

Cognitive Modules' advantages come from **contract-level determinism**, but this doesn't mean "no dynamic context".

| Type | Description | Cognitive |
|------|-------------|-----------|
| Implicit Context | Auto-accumulated conversation history, Agent scratchpad, model "remembering" | ❌ Forbidden |
| Explicit Context | Structured state snapshots, event windows, upstream module outputs | ✅ Allowed |

**Judgment Criteria**: Is it declared in the input Schema?

- In Schema → Verifiable → Allowed
- Not in Schema → Uncontrollable → Forbidden

## Why Forbid Implicit Context?

Implicit context breaks three things Cognitive values highly:

1. **Reproducibility** - Same input should produce predictable output
2. **Verifiability** - Output can be validated with Schema
3. **Auditability** - Can trace why the model produced specific output

## Explicit Context Patterns

### Pattern 1: State Snapshot

```json
{
  "input": {
    "type": "object",
    "properties": {
      "code": { "type": "string" },
      "previous_review": {
        "type": "object",
        "description": "Previous review result for iteration"
      }
    }
  }
}
```

### Pattern 2: Event Window

```json
{
  "input": {
    "type": "object",
    "properties": {
      "current_event": { "type": "object" },
      "recent_events": {
        "type": "array",
        "maxItems": 10,
        "description": "Last 10 relevant events"
      }
    }
  }
}
```

### Pattern 3: Upstream Results

```json
{
  "input": {
    "type": "object",
    "properties": {
      "user_request": { "type": "string" },
      "code_review_result": {
        "$ref": "#/$defs/CodeReviewResult",
        "description": "Result from code-reviewer module"
      }
    }
  }
}
```

## Benefits

1. **Testable** - Can write golden tests with fixed context
2. **Debuggable** - Know exact input for any call
3. **Composable** - Modules connect via explicit contracts
4. **Cacheable** - Same input = same output (potentially)

## Anti-patterns

❌ **Don't do this:**

```markdown
Remember what we discussed earlier...
Based on our conversation...
As I mentioned before...
```

✅ **Do this instead:**

```markdown
Based on the provided `previous_context`:
- Previous decision: {{previous_context.decision}}
- Reasoning: {{previous_context.rationale}}
```
