# Cognitive Modules Specification v0.1

**Cognitive Modules** 是一种结构化的 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

---

## 设计原则

1. **单一职责**：每个模块只做一件事，明确排除项
2. **数据优先**：强类型输入输出，JSON Schema 校验
3. **可验证输出**：必须包含 `confidence` 和 `rationale`
4. **约束执行**：明确禁止的行为（不编造、不访问网络等）
5. **示例驱动**：必须提供可验证的示例

---

## 文件结构

### 最小结构（2 文件）

```
my-module/
├── MODULE.md       # 元数据 + 指令
└── schema.json     # 输入输出 Schema
```

### 完整结构（可选）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
├── examples/       # 示例（推荐）
│   ├── input.json
│   └── output.json
└── tests/          # 测试用例（可选）
    └── cases.json
```

---

## MODULE.md 格式

```yaml
---
# 必填
name: module-name
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

# 可选：调用控制（类似 Skills）
invocation:
  user_invocable: true      # 用户可直接调用
  agent_invocable: true     # Agent 可自动调用
---

# 模块指令

（这里是 prompt 内容，指导 AI 如何执行任务）

## 输入

描述期望的输入...

## 处理流程

1. 步骤一
2. 步骤二
3. ...

## 输出要求

用户需求：$ARGUMENTS

描述输出格式和要求...
```

---

## 参数传递

支持 `$ARGUMENTS` 占位符，运行时会被替换为用户输入：

| 占位符 | 说明 |
|--------|------|
| `$ARGUMENTS` | 完整的用户输入文本 |
| `$ARGUMENTS[0]` | 第一个参数（空格分隔） |
| `$ARGUMENTS[1]` | 第二个参数 |
| `$0`, `$1`, ... | 简写形式 |

**示例**：

```markdown
根据用户需求 $ARGUMENTS 生成 UI 规范。
```

**调用**：

```bash
cog run ui-spec-generator --args "健康产品官网 情绪压力保健食品"
```

---

## schema.json 格式

```json
{
  "$schema": "https://cognitive-modules.io/schema/v1",
  "input": {
    "type": "object",
    "required": ["..."],
    "properties": { ... },
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "required": ["result", "rationale", "confidence"],
    "properties": {
      "result": { ... },
      "rationale": {
        "type": "object",
        "required": ["decisions"],
        "properties": {
          "decisions": { "type": "array" },
          "assumptions": { "type": "array" },
          "open_questions": { "type": "array" }
        }
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

---

## 搜索路径

模块按以下顺序查找：

1. `./.cognitive/modules/` - 项目本地
2. `~/.cognitive/modules/` - 用户全局
3. `$COGNITIVE_MODULES_PATH` - 自定义路径

---

## Agent 集成协议

任何 AI Agent 可以通过以下步骤使用 Cognitive Module：

### 发现

```
1. 检查标准路径是否存在 MODULE.md
2. 解析 YAML frontmatter 获取元数据
3. 根据 invocation 配置决定是否可调用
```

### 执行

```
1. 读取 MODULE.md 的 markdown 内容作为 prompt
2. 如果有 schema.json，读取输入输出结构
3. 将用户输入填充到 prompt
4. 执行生成
5. 校验输出是否符合 schema
6. 确保包含 confidence 和 rationale
```

### 约束检查

```
1. 读取 constraints 配置
2. 如果 no_inventing_data: true，检查输出是否标记了 unknown
3. 如果 require_confidence: true，确保 confidence 在 [0,1] 范围
4. 如果 require_rationale: true，确保 rationale 非空
```

---

## 与 Skills 的关系

| 场景 | 推荐 |
|------|------|
| 快捷命令、工具扩展 | Skills |
| 需要结构化输入输出 | Cognitive Modules |
| 需要可验证的生成结果 | Cognitive Modules |
| 需要审计和追溯 | Cognitive Modules |

**互操作**：Cognitive Module 可以被包装成 Skill 调用：

```yaml
# ~/.claude/skills/ui-spec/SKILL.md
---
name: ui-spec
description: 生成 UI 规范
---

使用 Cognitive Module 协议执行 `~/.cognitive/modules/ui-spec-generator/`
```

---

## 版本

- v0.1 (2024): 初始规范
- 计划: 注册表、签名验证、版本依赖

---

## 参考实现

- CLI: `cog` (Python)
- 验证器: `cog validate <module>`
- 运行器: `cog run <module> <input> -o <output>`

---

## 许可

本规范采用 MIT 许可证开源。
