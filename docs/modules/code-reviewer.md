# code-reviewer

审查代码并提供结构化的改进建议。

## 基本信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 分类 | 代码质量 |
| 格式 | 新格式 |

## 功能

- 识别安全漏洞（SQL 注入、XSS 等）
- 发现逻辑错误和边界条件问题
- 评估代码可读性和可维护性
- 提供具体的改进建议

## 审查维度

1. **正确性** - 逻辑错误、边界条件、异常处理
2. **安全性** - 注入风险、敏感数据、权限问题
3. **性能** - 时间复杂度、内存使用、N+1 问题
4. **可读性** - 命名、注释、结构清晰度
5. **可维护性** - 耦合度、测试友好、扩展性

## 使用

```bash
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
```

## 输出示例

```json
{
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "location": "line 1",
      "description": "SQL 注入漏洞",
      "suggestion": "使用参数化查询"
    }
  ],
  "highlights": [
    "函数命名清晰"
  ],
  "summary": "代码存在严重安全问题",
  "rationale": "检测到 f-string 直接拼接...",
  "confidence": 0.95
}
```

## 输出字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `issues` | array | 发现的问题列表 |
| `issues[].severity` | string | critical/high/major/medium/minor/low/info |
| `issues[].category` | string | correctness/security/performance/readability/maintainability |
| `issues[].location` | string | 问题位置 |
| `issues[].description` | string | 问题描述 |
| `issues[].suggestion` | string | 改进建议 |
| `highlights` | array | 代码优点 |
| `summary` | string | 整体评价 |
| `rationale` | string/object | 审查思路 |
| `confidence` | number | 置信度 0-1 |
