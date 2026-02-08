---
sidebar_position: 3
---

# Sub-agents (@call)

Cognitive Modules supports **inter-module calls** via `@call:` directives in prompts.

## @call Syntax

```markdown
# Processing Flow
1. Analyze user requirements
2. Call UI spec generator:
   @call:ui-spec-generator($ARGUMENTS)
3. Integrate results
```

## Call Forms

| Syntax | Description |
|--------|-------------|
| `@call:module-name` | Pass parent module input |
| `@call:module-name($ARGUMENTS)` | Pass parent args string |
| `@call:module-name(custom args)` | Pass custom args |

## context Configuration

In v2.2, use `context` in `module.yaml`:

```yaml
name: parent-module
context: fork   # fork | main (default)
```

- **fork**: child runs with isolated context
- **main**: child shares context with parent

## How to Run

Sub-agent orchestration is available via the **programmatic API**:

```ts
import { runWithSubagents, loadModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await runWithSubagents('product-analyzer', provider, {
  args: 'health product website'
});
```

> The CLI `run` does **not** automatically resolve `@call` directives.

## Execution Flow

```
Parent Prompt
  ↓
Parse @call directives
  ↓
Execute child modules
  ↓
Inject results
  ↓
Execute parent module
```

## Limitations

| Limitation | Value |
|------------|-------|
| Max call depth | 5 levels |
| Circular calls | Auto-detected and blocked |
| Child validation | Skip input validation, keep output validation |
