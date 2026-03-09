---
sidebar_position: 2
---

# 第一个模块

本教程创建一个 v2.2 模块并使用 `npx cogn@2.2.16 ...` 运行。

## 快速路径（Core）

如果你希望先用单文件跑通，再升级为 v2 目录结构：

```bash
npx cogn@2.2.16 core new demo.md
npx cogn@2.2.16 core run demo.md --args "hello" --pretty
npx cogn@2.2.16 core promote demo.md
```

之后你可以直接编辑生成的 `./cognitive/modules/<name>/`，它就是标准 v2 模块目录。

## 目录结构（v2.2）

```
hello-world/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
```

## 1. 创建目录

```bash
mkdir -p cognitive/modules/hello-world/tests
cd cognitive/modules/hello-world
```

## 2. 创建 module.yaml

```yaml
name: hello-world
version: 1.0.0
responsibility: 生成友好的问候语

tier: decision
schema_strictness: medium

excludes:
  - offensive language

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny
```

## 3. 创建 prompt.md

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

## 4. 创建 schema.json

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

## 5. 运行模块

```bash
npx cogn@2.2.16 run hello-world --input '{"name":"John","time_of_day":"morning"}' --pretty
```

输出示例：

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

## 旧版 v1（可选）

v1 仍可兼容，但建议新模块使用 v2.2。
