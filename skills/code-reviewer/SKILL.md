# Code Reviewer

结构化代码审查，输出问题列表、严重等级、置信度和推理依据。

## 何时使用

当用户要求审查代码、检查代码质量、发现潜在问题时，使用此 Skill。

## 使用方法

```bash
cog run code-reviewer --args "要审查的代码" --pretty
```

## 输入

直接传入代码字符串，支持任何编程语言。

## 输出

JSON 格式，包含：

- `issues`: 问题列表，每个问题有 `severity`（critical/major/minor）、`category`、`description`、`suggestion`
- `confidence`: 0-1 之间的置信度
- `rationale`: 推理过程和决策依据

## 示例

```bash
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
```

输出：

```json
{
  "issues": [
    {
      "severity": "critical",
      "category": "security",
      "description": "SQL 注入漏洞",
      "suggestion": "使用参数化查询"
    }
  ],
  "confidence": 0.95,
  "rationale": "检测到 f-string 直接拼接用户输入..."
}
```

## 注意事项

- 这是一个 Cognitive Module 的 Skill 包装
- 输出始终是结构化 JSON，可直接解析
- 需要先安装：`pip install cognitive-modules`
- 需要配置 LLM：`export LLM_PROVIDER=openai` 和 `export OPENAI_API_KEY=sk-xxx`
