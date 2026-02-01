# 模块格式

## 文件结构

### 新格式（推荐）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
└── examples/       # 可选
    ├── input.json
    └── output.json
```

### 旧格式（兼容）

```
my-module/
├── module.md           # 元数据
├── input.schema.json   # 输入 Schema
├── output.schema.json  # 输出 Schema
├── constraints.yaml    # 约束
├── prompt.txt          # 指令
└── examples/
```

## MODULE.md

### YAML Frontmatter

```yaml
---
# 必填
name: my-module
version: 1.0.0
responsibility: 一句话描述模块职责

# 必填：明确排除的行为
excludes:
  - 不做的事情1
  - 不做的事情2

# 可选：运行约束
constraints:
  no_network: true          # 禁止网络访问
  no_side_effects: true     # 禁止副作用
  no_inventing_data: true   # 禁止编造数据
  require_confidence: true  # 必须输出置信度
  require_rationale: true   # 必须输出推理过程

# 可选：调用控制
invocation:
  user_invocable: true      # 用户可直接调用
  agent_invocable: true     # Agent 可自动调用

# 可选：执行上下文
context: fork               # fork=隔离, main=共享（默认）
---
```

### Prompt 部分

```markdown
# 模块标题

模块说明...

## 输入

用户需求：$ARGUMENTS

或者描述 JSON 输入格式...

## 处理流程

1. 步骤一
2. 步骤二
3. ...

## 输出要求

描述输出格式...
```

## schema.json

```json
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
  "input": {
    "type": "object",
    "required": ["field1"],
    "properties": {
      "field1": { "type": "string" },
      "$ARGUMENTS": { "type": "string" }
    },
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "required": ["result", "rationale", "confidence"],
    "properties": {
      "result": { ... },
      "rationale": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "decisions": { "type": "array" },
              "assumptions": { "type": "array" }
            }
          }
        ]
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      }
    },
    "additionalProperties": false
  }
}
```

## 示例文件

### examples/input.json

```json
{
  "field1": "示例输入值"
}
```

### examples/output.json

```json
{
  "result": { ... },
  "rationale": "示例推理过程",
  "confidence": 0.9
}
```

## 验证

```bash
cog validate my-module
```

验证内容：

1. MODULE.md 存在且格式正确
2. schema.json 是有效的 JSON Schema
3. 示例输入符合输入 Schema
4. 示例输出符合输出 Schema
