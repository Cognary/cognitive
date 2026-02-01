# UI Spec Generator

将产品需求转换为可实施的 UI 规范。

## 何时使用

当用户需要将产品需求转换为前端可实施的 UI 规范、设计系统组件、定义交互逻辑时，使用此 Skill。

## 使用方法

```bash
cog run ui-spec-generator --args "页面需求描述" --pretty
```

## 输入

描述页面需求，包括：
- 页面功能
- 目标用户
- 核心交互

## 输出

JSON 格式，包含：

- `specification`:
  - `information_architecture`: 信息架构和层级
  - `components`: 组件列表（类型、属性、状态）
  - `interactions`: 交互定义（事件、过渡）
  - `responsive`: 响应式规则
  - `accessibility`: 无障碍要求
  - `design_tokens`: 设计令牌（如有）
  - `acceptance_criteria`: 验收标准
- `confidence`: 0-1 之间的置信度
- `rationale`: 设计决策说明

## 示例

```bash
cog run ui-spec-generator --args "电商首页，展示轮播图、商品分类、推荐商品列表" --pretty
```

## 注意事项

- 这是一个 Cognitive Module 的 Skill 包装
- 输出始终是结构化 JSON
- 需要先安装：`pip install cognitive-modules`
- 需要配置 LLM
