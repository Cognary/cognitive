# cogn validate

验证 Cognitive Module 的结构和示例。

## 语法

```bash
cogn validate <module> [--v22]
```

## 参数

| 参数 | 说明 |
|------|------|
| `module` | 模块名称或路径 |
| `--v22` | 启用 v2.2 严格验证 |

## 验证内容

### 标准验证

1. **模块文件存在**
   - `module.yaml` 或 `MODULE.md` 存在
   - `schema.json` 存在

2. **YAML 有效**
   - `name`、`version`、`responsibility` 字段存在
   - `excludes` 列表非空

3. **JSON Schema 有效**
   - `schema.json` 是有效的 JSON
   - `input` 和 `output/data` 定义存在

4. **示例验证**
   - 示例文件符合对应 Schema

### v2.2 严格验证 (`--v22`)

在标准验证基础上增加：

| 检查项 | 说明 |
|--------|------|
| `tier` 存在 | exec / decision / exploration |
| `meta` schema | 包含 confidence, risk, explain |
| `meta.explain.maxLength` | ≤280 |
| `data.rationale` | data 必须要求 rationale |
| `overflow` 配置 | 启用时需要 `$defs.extensions` |
| `prompt.md` | 包含 v2.2 envelope 说明 |

## 示例

### 标准验证

```bash
cogn validate code-reviewer
```

输出：

```
→ Validating module: code-reviewer

⚠ Warnings (1):
  - Consider adding 'tier' for v2.2 (use 'cogn validate --v22' for full check)

✓ Module 'code-reviewer' is valid
```

### v2.2 严格验证

```bash
cogn validate code-reviewer --v22
```

成功输出：

```
→ Validating module: code-reviewer (v2.2 strict)

✓ Module 'code-reviewer' is valid v2.2 format
```

失败输出：

```
→ Validating module: code-reviewer (v2.2 strict)

⚠ Warnings (1):
  - overflow.require_suggested_mapping not set

✗ Validation failed (2 errors):
  - module.yaml missing 'tier'
  - schema.json missing 'meta' schema (required for v2.2)
```

## 常见错误

| 错误 | 解决方法 |
|------|----------|
| `Missing module.yaml, MODULE.md, or module.md` | 创建模块定义文件 |
| `Invalid tier: xxx` | 改为 exec / decision / exploration |
| `schema.json missing 'meta' schema` | 添加 meta schema 定义 |
| `meta schema must require 'confidence'` | 在 meta.required 添加 confidence |
| `meta.explain should have maxLength <= 280` | 设置 explain.maxLength: 280 |
| `Module is v1 format` | 使用 `cogn migrate` 升级 |

## 迁移建议

如果验证失败提示需要升级格式：

```bash
# 预览迁移变更
cogn migrate code-reviewer --dry-run

# 执行迁移
cogn migrate code-reviewer

# 重新验证
cogn validate code-reviewer --v22
```

## 最佳实践

1. 新模块使用 v2.2 格式
2. 使用 `--v22` 进行严格验证
3. 在 CI 中自动验证所有模块
4. 迁移旧模块时先用 `--dry-run` 预览
