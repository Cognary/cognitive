# 第一个模块

本教程将带你创建一个 Cognitive Module。

## 选择格式

=== "v2 格式（推荐）"

    v2 格式将机器可读的元数据和人类可读的提示词分离：
    
    ```
    hello-world/
    ├── module.yaml     # 机器可读清单
    ├── prompt.md       # 人类可读提示词
    ├── schema.json     # IO 契约
    └── tests/          # Golden 测试
    ```

=== "v1 格式（简化版）"

    v1 格式将元数据和提示词合并在一个文件中：
    
    ```
    hello-world/
    ├── MODULE.md       # 元数据 + 提示词
    ├── schema.json     # IO 契约
    └── examples/
    ```

---

## 创建 v2 模块（推荐）

### 1. 创建目录结构

```bash
mkdir -p cognitive/modules/hello-world/tests
cd cognitive/modules/hello-world
```

### 2. 创建 module.yaml

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

### 3. 创建 prompt.md

```markdown
# Greeting Generator

Generate a friendly, personalized greeting based on user information.

## Input

- `name`: User's name (required)
- `time_of_day`: morning/afternoon/evening (optional)
- `language`: Language preference (optional, default: zh)

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

### 4. 创建 schema.json

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
      "language": { "type": "string", "default": "zh" }
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

### 5. 创建测试用例

```json
// tests/case1.input.json
{
  "name": "小明",
  "time_of_day": "morning"
}
```

```json
// tests/case1.expected.json
{
  "_validate": {
    "required": ["greeting", "rationale", "confidence"],
    "confidence_min": 0.7
  }
}
```

### 6. 运行模块

```bash
# 使用 JSON 输入
echo '{"name": "小明", "time_of_day": "morning"}' | cog run hello-world --pretty

# 使用 --args（映射到 name）
cog run hello-world --args "小明" --pretty
```

输出：

```json
{
  "greeting": "早上好，小明！祝你今天充满活力！",
  "tone": "温暖友好",
  "rationale": "根据早上时间选择了 '早上好'，加入了积极的祝福语",
  "confidence": 0.92
}
```

---

## 创建 v1 模块（简化版）

### 1. 使用 cog init

```bash
cog init hello-world -d "生成友好的问候语"
```

### 2. 编辑 MODULE.md

```yaml
---
name: hello-world
version: 1.0.0
responsibility: 根据用户信息生成个性化问候语

excludes:
  - 生成超过 100 字的内容
  - 使用不礼貌的语言

constraints:
  no_network: true
  require_confidence: true
  require_rationale: true
---

# 问候语生成器

根据用户提供的信息，生成一条友好、个性化的问候语。

## 输入

用户信息：$ARGUMENTS

或 JSON 格式：
- `name`: 用户名字
- `time_of_day`: 时间段

## 输出要求

返回 JSON：
- `greeting`: 问候语
- `rationale`: 理由
- `confidence`: 置信度
```

### 3. 编辑 schema.json

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

## v1 vs v2 对比

| 特性 | v1 | v2 |
|------|:--:|:--:|
| 文件数量 | 2 | 3+ |
| 机器/人类分离 | ❌ | ✅ |
| `$ARGUMENTS` | ✅ | ❌ 移除 |
| 错误契约 | ❌ | ✅ |
| Golden 测试 | ❌ | ✅ |
| 工具策略 | ❌ | ✅ |

!!! tip "推荐"
    新项目请使用 v2 格式，它更适合工具链集成和自动化测试。

---

## 下一步

- [模块格式](../guide/module-format.md) - 深入了解 v2 格式
- [参数传递](../guide/arguments.md) - 学习输入处理
- [模块库](../modules/index.md) - 查看 code-simplifier 示例
