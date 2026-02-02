---
sidebar_position: 2
---

# First Module

This tutorial will guide you through creating a Cognitive Module.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Choose a Format

<Tabs>
<TabItem value="v2" label="v2.2 Format (Recommended)" default>

v2.2 format separates machine-readable metadata from human-readable prompts:

```
hello-world/
├── module.yaml     # Machine-readable manifest
├── prompt.md       # Human-readable prompt
├── schema.json     # IO contract
└── tests/          # Golden tests
```

</TabItem>
<TabItem value="v1" label="v1 Format (Simplified)">

v1 format combines metadata and prompts in a single file:

```
hello-world/
├── MODULE.md       # Metadata + prompt
├── schema.json     # IO contract
└── examples/
```

</TabItem>
</Tabs>

---

## Create a v2.2 Module (Recommended)

### 1. Create Directory Structure

```bash
mkdir -p cognitive/modules/hello-world/tests
cd cognitive/modules/hello-world
```

### 2. Create module.yaml

```yaml
name: hello-world
version: 1.0.0
responsibility: generate personalized greetings

excludes:
  - generating content over 100 characters
  - using impolite language

constraints:
  no_network: true
  no_side_effects: true
  no_inventing_data: true

output:
  json_strict: true
  require_confidence: true
  require_rationale: true

tools:
  allowed: []

failure:
  must_return_error_schema: true
```

### 3. Create prompt.md

```markdown
# Greeting Generator

Generate a friendly, personalized greeting based on user information.

## Input

- `name`: User's name (required)
- `time_of_day`: morning/afternoon/evening (optional)
- `language`: Language preference (optional, default: en)

## Processing

1. Parse user information
2. Select appropriate greeting based on time
3. Add personalized elements
4. Generate natural, fluent greeting

## Output

Return JSON with:
- `greeting`: The greeting text
- `tone`: Description of the tone
- `rationale`: Why this greeting was chosen
- `confidence`: 0-1
```

### 4. Create schema.json

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v2.json",
  "input": {
    "type": "object",
    "required": ["name"],
    "properties": {
      "name": { "type": "string", "description": "User's name" },
      "time_of_day": { 
        "type": "string",
        "enum": ["morning", "afternoon", "evening"]
      },
      "language": { "type": "string", "default": "en" }
    }
  },
  "output": {
    "type": "object",
    "required": ["greeting", "rationale", "confidence"],
    "properties": {
      "greeting": { "type": "string" },
      "tone": { "type": "string" },
      "rationale": { "type": "string" },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      }
    }
  },
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "enum": ["INVALID_INPUT", "UNSUPPORTED_LANGUAGE"] },
      "message": { "type": "string" }
    }
  }
}
```

### 5. Create Test Cases

```json title="tests/case1.input.json"
{
  "name": "John",
  "time_of_day": "morning"
}
```

```json title="tests/case1.expected.json"
{
  "_validate": {
    "required": ["greeting", "rationale", "confidence"],
    "confidence_min": 0.7
  }
}
```

### 6. Run the Module

```bash
# Using JSON input
echo '{"name": "John", "time_of_day": "morning"}' | cog run hello-world --pretty

# Using --args (maps to name)
cog run hello-world --args "John" --pretty
```

Output:

```json
{
  "greeting": "Good morning, John! Wishing you an energetic day!",
  "tone": "warm and friendly",
  "rationale": "Selected 'Good morning' based on morning time, added positive wishes",
  "confidence": 0.92
}
```

---

## Create a v1 Module (Simplified)

### 1. Use cog init

```bash
cog init hello-world -d "Generate friendly greetings"
```

### 2. Edit MODULE.md

```yaml
---
name: hello-world
version: 1.0.0
responsibility: Generate personalized greetings based on user information

excludes:
  - Generating content over 100 characters
  - Using impolite language

constraints:
  no_network: true
  require_confidence: true
  require_rationale: true
---

# Greeting Generator

Generate a friendly, personalized greeting based on user-provided information.

## Input

User information: $ARGUMENTS

Or JSON format:
- `name`: User's name
- `time_of_day`: Time period

## Output Requirements

Return JSON:
- `greeting`: The greeting
- `rationale`: Reasoning
- `confidence`: Confidence score
```

### 3. Edit schema.json

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
  "input": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "time_of_day": { "type": "string" },
      "$ARGUMENTS": { "type": "string" }
    }
  },
  "output": {
    "type": "object",
    "required": ["greeting", "rationale", "confidence"],
    "properties": {
      "greeting": { "type": "string" },
      "rationale": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  }
}
```

---

## v1 vs v2.2 Comparison

| Feature | v1 | v2.2 |
|---------|:--:|:----:|
| File count | 2 | 3+ |
| Machine/Human separation | ❌ | ✅ |
| `$ARGUMENTS` | ✅ | ❌ Removed |
| Control/Data separation | ❌ | ✅ |
| Module Tiers | ❌ | ✅ |
| Error contract | ❌ | ✅ |
| Golden tests | ❌ | ✅ |
| Tool policy | ❌ | ✅ |

:::tip Recommendation
Use v2.2 format for new projects. It's better suited for toolchain integration and automated testing.
:::

---

## Next Steps

- [Module Format](../guide/module-format) - Deep dive into v2.2 format
- [Arguments](../guide/arguments) - Learn about input handling
- [Module Library](../modules/) - See code-simplifier example
