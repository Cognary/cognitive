---
sidebar_position: 2
---

# Argument Passing

Cognitive Modules supports the `$ARGUMENTS` placeholder, allowing runtime parameter passing.

## Basic Usage

### In MODULE.md

```markdown
## Input

User requirement: $ARGUMENTS

Generate output based on the above requirement.
```

### Runtime Passing

```bash
cog run my-module --args "your requirement description"
```

## Placeholder Syntax

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `$ARGUMENTS` | Complete input text | "health product homepage" |
| `$ARGUMENTS[0]` | First word (space-separated) | "health" |
| `$ARGUMENTS[1]` | Second word | "product" |
| `$0`, `$1`, ... | Shorthand form | Same as above |

## Example

### MODULE.md

```markdown
---
name: page-designer
version: 1.0.0
---

# Page Designer

Design a $1 page for $0 type product.

Product type: $ARGUMENTS[0]
Page type: $ARGUMENTS[1]
```

### Invocation

```bash
cog run page-designer --args "health-product homepage"
```

### Replacement Result

```
Design a homepage page for health-product type product.

Product type: health-product
Page type: homepage
```

## With JSON Input

When using `--args`:

1. Skip input Schema validation
2. Create `{"$ARGUMENTS": "...", "query": "..."}` input

When using JSON file:

1. Normal input Schema validation
2. `$ARGUMENTS` is obtained from JSON's `$ARGUMENTS` or `query` field

```json
{
  "$ARGUMENTS": "custom argument",
  "other_field": "other value"
}
```

## Best Practices

1. **Simple tasks**: Use `$ARGUMENTS` directly
2. **Complex input**: Define complete input Schema
3. **Mixed use**: Include `$ARGUMENTS` field in Schema

```json
{
  "input": {
    "type": "object",
    "properties": {
      "$ARGUMENTS": { "type": "string" },
      "options": { "type": "object" }
    }
  }
}
```
