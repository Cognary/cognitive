---
sidebar_position: 2
---

# First Module

This tutorial creates a simple v2.2 module and runs it with `npx cogn@2.2.11 ...`.

## Fast Path (Core)

If you want to start from a single file and then migrate to v2:

```bash
npx cogn@2.2.11 core new demo.md
npx cogn@2.2.11 core run demo.md --args "hello" --pretty
npx cogn@2.2.11 core promote demo.md
```

Then you can edit the generated `./cognitive/modules/<name>/` directory as a standard v2 module.

## Module Structure (v2.2)

```
hello-world/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
```

## 1. Create Directory

```bash
mkdir -p cognitive/modules/hello-world/tests
cd cognitive/modules/hello-world
```

## 2. Create module.yaml

```yaml
name: hello-world
version: 1.0.0
responsibility: Generate a friendly greeting

tier: decision
schema_strictness: medium

excludes:
  - offensive language

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
```

## 3. Create prompt.md

```markdown
# Greeting Generator

Generate a friendly greeting.

## Input
- `name`: required
- `time_of_day`: optional (morning/afternoon/evening)

## Output
Return v2.2 envelope JSON with:
- `data.greeting`
- `data.rationale`
```

## 4. Create schema.json

```json
{
  "$schema": "https://cognitive-modules.dev/schema/v2.2.json",
  "input": {
    "type": "object",
    "required": ["name"],
    "properties": {
      "name": { "type": "string" },
      "time_of_day": {
        "type": "string",
        "enum": ["morning", "afternoon", "evening"]
      }
    }
  },
  "data": {
    "type": "object",
    "required": ["greeting", "rationale"],
    "properties": {
      "greeting": { "type": "string" },
      "rationale": { "type": "string" }
    }
  },
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "risk": { "enum": ["none", "low", "medium", "high"] },
      "explain": { "type": "string", "maxLength": 280 }
    }
  },
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "type": "string" },
      "message": { "type": "string" }
    }
  }
}
```

## 5. Run the Module

```bash
npx cogn@2.2.11 run hello-world --input '{"name":"John","time_of_day":"morning"}' --pretty
```

Example output:

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Generated a friendly greeting"
  },
  "data": {
    "greeting": "Good morning, John!",
    "rationale": "Used time_of_day and name to personalize the greeting"
  }
}
```

## Legacy v1 Format (Optional)

v1 modules are supported for compatibility, but new modules should use v2.2.
