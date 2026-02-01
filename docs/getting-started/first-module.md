# 第一个模块

本教程将带你创建一个简单的 Cognitive Module。

## 创建模块骨架

```bash
cog init hello-world -d "生成友好的问候语"
```

这会在 `./cognitive/modules/hello-world/` 创建：

```
hello-world/
├── MODULE.md       # 模块定义
├── schema.json     # 输入输出 Schema
└── examples/
    ├── input.json
    └── output.json
```

## 编辑 MODULE.md

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
  no_inventing_data: true
  require_confidence: true
  require_rationale: true
---

# 问候语生成器

根据用户提供的信息，生成一条友好、个性化的问候语。

## 输入

用户信息：$ARGUMENTS

或 JSON 格式：
- `name`: 用户名字
- `time_of_day`: 时间段（morning/afternoon/evening）
- `language`: 语言偏好（可选）

## 处理流程

1. 解析用户信息
2. 根据时间选择合适的问候
3. 加入个性化元素
4. 生成自然流畅的问候语

## 输出要求

返回 JSON：
- `greeting`: 问候语文本
- `tone`: 语气描述
- `rationale`: 生成理由
- `confidence`: 置信度 [0-1]
```

## 编辑 schema.json

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
  "input": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "time_of_day": { 
        "type": "string",
        "enum": ["morning", "afternoon", "evening"]
      },
      "language": { "type": "string" },
      "$ARGUMENTS": { "type": "string" }
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
  }
}
```

## 验证模块

```bash
cog validate hello-world
# ✓ Module 'hello-world' is valid
```

## 运行模块

```bash
cog run hello-world --args "小明 早上" --pretty
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

## 下一步

- [模块格式](../guide/module-format.md) - 深入了解模块结构
- [参数传递](../guide/arguments.md) - 学习 $ARGUMENTS 用法
- [模块库](../modules/index.md) - 查看更多示例
