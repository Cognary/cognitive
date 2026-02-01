# 参数传递

Cognitive Modules 支持 `$ARGUMENTS` 占位符，允许运行时传入参数。

## 基本用法

### 在 MODULE.md 中使用

```markdown
## 输入

用户需求：$ARGUMENTS

根据上述需求生成输出。
```

### 运行时传参

```bash
cog run my-module --args "你的需求描述"
```

## 占位符语法

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `$ARGUMENTS` | 完整输入文本 | "健康产品 官网" |
| `$ARGUMENTS[0]` | 第一个词（空格分隔） | "健康产品" |
| `$ARGUMENTS[1]` | 第二个词 | "官网" |
| `$0`, `$1`, ... | 简写形式 | 同上 |

## 示例

### MODULE.md

```markdown
---
name: page-designer
version: 1.0.0
---

# 页面设计器

为 $0 类型的产品设计 $1 页面。

产品类型：$ARGUMENTS[0]
页面类型：$ARGUMENTS[1]
```

### 调用

```bash
cog run page-designer --args "健康产品 首页"
```

### 替换结果

```
为 健康产品 类型的产品设计 首页 页面。

产品类型：健康产品
页面类型：首页
```

## 与 JSON 输入配合

当使用 `--args` 时：

1. 跳过输入 Schema 验证
2. 创建 `{"$ARGUMENTS": "...", "query": "..."}` 输入

当使用 JSON 文件时：

1. 正常验证输入 Schema
2. `$ARGUMENTS` 从 JSON 的 `$ARGUMENTS` 或 `query` 字段获取

```json
{
  "$ARGUMENTS": "自定义参数",
  "other_field": "其他值"
}
```

## 最佳实践

1. **简单任务**：直接使用 `$ARGUMENTS`
2. **复杂输入**：定义完整的输入 Schema
3. **混合使用**：Schema 中包含 `$ARGUMENTS` 字段

```json
{
  "input": {
    "type": "object",
    "properties": {
      "$ARGUMENTS": { "type": "string" },
      "options": { "type": "object" }
    }
  }
}
```
