# API Designer

设计 RESTful API，输出端点、数据模型、关系和验证规则。

## 何时使用

当用户要求设计 API、规划后端接口、定义数据模型时，使用此 Skill。

## 使用方法

```bash
cog run api-designer --args "资源描述" --pretty
```

## 输入

描述要设计的资源或业务场景，例如：
- "用户管理系统"
- "电商订单和商品"
- "博客文章和评论"

## 输出

JSON 格式，包含：

- `resources`: 资源列表，每个资源有 `name`、`endpoints`、`fields`
- `relationships`: 资源间关系（one-to-many、many-to-many 等）
- `authentication`: 认证方案建议
- `confidence`: 0-1 之间的置信度
- `rationale`: 设计决策说明

## 示例

```bash
cog run api-designer --args "博客系统，包含文章、评论、用户" --pretty
```

## 注意事项

- 这是一个 Cognitive Module 的 Skill 包装
- 输出始终是结构化 JSON
- 需要先安装：`pip install cognitive-modules`
- 需要配置 LLM
