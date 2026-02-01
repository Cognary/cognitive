# cog validate

验证 Cognitive Module 的结构和示例。

## 语法

```bash
cog validate <module>
```

## 参数

| 参数 | 说明 |
|------|------|
| `module` | 模块名称或路径 |

## 验证内容

1. **模块文件存在**
   - `MODULE.md` 或 `module.md` 存在
   - `schema.json` 存在（新格式）

2. **YAML Frontmatter 有效**
   - `name` 字段存在
   - `version` 字段存在

3. **JSON Schema 有效**
   - `schema.json` 是有效的 JSON
   - `input` 和 `output` 定义存在

4. **示例验证**
   - `examples/input.json` 符合输入 Schema
   - `examples/output.json` 符合输出 Schema

## 示例

### 验证成功

```bash
cog validate code-reviewer
```

输出：

```
→ Validating module: code-reviewer

✓ Module 'code-reviewer' is valid
```

### 验证失败

```bash
cog validate broken-module
```

输出：

```
→ Validating module: broken-module

⚠ Warnings (1):
  - No examples directory found

✗ Validation failed (2 errors):
  - Missing required field: version
  - Example input fails schema: 'name' is a required property
```

## 常见错误

| 错误 | 解决方法 |
|------|----------|
| `No MODULE.md or module.md found` | 创建 MODULE.md 文件 |
| `Invalid JSON in schema.json` | 检查 JSON 语法 |
| `Example input fails schema` | 修改示例或 Schema |
| `Missing required field: version` | 在 frontmatter 添加 version |

## 最佳实践

1. 每次修改模块后运行验证
2. 在 CI 中自动验证所有模块
3. 提供完整的示例输入输出
