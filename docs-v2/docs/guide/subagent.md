---
sidebar_position: 3
---

# Sub-agents

Cognitive Modules supports inter-module calls, enabling complex task decomposition and composition.

## @call Syntax

Use `@call:module-name` in MODULE.md to call other modules:

```markdown
## Processing Flow

1. Analyze user requirements
2. Call UI spec generator:
   @call:ui-spec-generator($ARGUMENTS)
3. Integrate results
```

## Call Forms

| Syntax | Description |
|--------|-------------|
| `@call:module-name` | Pass parent module input |
| `@call:module-name($ARGUMENTS)` | Pass parent's $ARGUMENTS |
| `@call:module-name(custom args)` | Pass custom arguments |

## context Configuration

### fork (Isolated Execution)

```yaml
---
name: parent-module
context: fork
---
```

- Child module has independent context
- Child results don't affect other children
- Suitable for parallel execution of independent tasks

### main (Shared Execution)

```yaml
---
name: parent-module
context: main  # Default
---
```

- Child modules share parent context
- Child results accessible to other children

## Running

Sub-agent functionality is automatic. When module prompt contains `@call:` directive, runtime parses and executes:

```bash
# Run directly (@call handled automatically)
cog run parent-module --args "requirements"
```

## Execution Flow

```
Parent Module Prompt
    ↓
Parse @call:child-module
    ↓
Execute child-module
    ↓
Inject result [Result from @call:child-module]: {...}
    ↓
Execute parent module
    ↓
Final output
```

## Example: product-analyzer

```yaml
---
name: product-analyzer
version: 1.0.0
responsibility: Analyze product requirements and call UI spec generator
context: fork
---

# Product Analyzer

## Input

User product description: $ARGUMENTS

## Processing Flow

1. Requirements analysis
2. Call UI spec generator:
   @call:ui-spec-generator($ARGUMENTS)
3. Integrate output

## Output

- analysis: Product analysis
- ui_spec: UI spec from @call
- recommendations: Recommendations
```

Run:

```bash
cog run product-analyzer --args "health product website" --pretty
```

## Limitations

| Limitation | Value |
|------------|-------|
| Max call depth | 5 levels |
| Circular calls | Auto-detected and blocked |
| Child validation | Skip input validation, keep output validation |
