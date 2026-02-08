---
sidebar_position: 3
---

# code-simplifier

代码简化模块（v2.2 格式示例）

## 概述

`code-simplifier` 是一个使用 **v2.2 格式**的示例模块，展示了新格式的所有特性：

- `module.yaml` + `prompt.md` 分离
- `behavior_equivalence` 行为等价性保证
- `changes[].scope` 和 `changes[].risk` 变更追踪
- 标准化的 `error` 输出格式
- Golden 测试

## 使用

```bash
# 简化代码
npx cogn@2.2.13 run code-simplifier --args "x = 1 + 2 + 3"

# 指定语言
echo '{"code": "const x = a && a.b && a.b.c", "language": "javascript"}' | npx cogn@2.2.13 run code-simplifier

# 美化输出
npx cogn@2.2.13 run code-simplifier --args "for i in range(len(arr)): print(arr[i])" --pretty
```

## 输出示例

```json
{
  "simplified": "x = 6",
  "changes": [
    {
      "description": "Folded constant expression 1 + 2 + 3 to 6",
      "scope": "local",
      "risk": "none"
    }
  ],
  "behavior_equivalence": true,
  "rationale": "The expression 1 + 2 + 3 always evaluates to 6, so this is a safe constant folding optimization.",
  "confidence": 0.99
}
```

## 文件结构

```
code-simplifier/
├── module.yaml     # 机器可读清单
├── prompt.md       # 提示词
├── schema.json     # IO 契约
└── tests/
    ├── case1.input.json
    ├── case1.expected.json
    ├── case2.input.json
    └── case2.expected.json
```

## module.yaml

```yaml
name: code-simplifier
version: 1.0.0
responsibility: simplify code while preserving behavior

excludes:
  - changing observable behavior
  - adding new features
  - removing functionality

constraints:
  no_network: true
  no_side_effects: true
  no_file_write: true

output:
  json_strict: true
  require_confidence: true
  require_rationale: true
  require_behavior_equivalence: true

tools:
  allowed: []

failure:
  must_return_error_schema: true
  partial_allowed: true
```

## 关键特性

### 行为等价性

模块必须保证简化后的代码与原代码行为完全一致：

```json
{
  "behavior_equivalence": true
}
```

如果无法保证，必须设为 `false` 并在 `rationale` 中解释原因。

### 变更追踪

每个变更都带有影响范围和风险等级：

```json
{
  "changes": [
    {
      "description": "Replaced verbose loop with list comprehension",
      "scope": "function",
      "risk": "low"
    }
  ]
}
```

| scope | 说明 |
|-------|------|
| local | 局部变量 |
| function | 函数级别 |
| file | 文件级别 |
| project | 项目级别 |

| risk | 说明 |
|------|------|
| none | 无风险 |
| low | 低风险 |
| medium | 中等风险 |
| high | 高风险 |

### 错误处理

失败时返回标准化的错误格式：

```json
{
  "error": {
    "code": "UNSUPPORTED_LANGUAGE",
    "message": "Cannot simplify Brainfuck code",
    "partial": null
  }
}
```

## 与 code-reviewer 的区别

| 特性 | code-reviewer | code-simplifier |
|------|:-------------:|:---------------:|
| 格式 | v1 | **v2.2** |
| 修改代码 | ❌ 只审查 | ✅ 输出简化后代码 |
| 行为等价性 | - | ✅ 必须保证 |
| 变更追踪 | - | ✅ scope + risk |
| 错误契约 | - | ✅ 标准化 |
