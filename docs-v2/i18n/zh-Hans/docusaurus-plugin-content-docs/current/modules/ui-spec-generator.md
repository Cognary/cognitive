---
sidebar_position: 6
---

# ui-spec-generator

将产品需求转换为前端可实现的 UI 规范。

## 基本信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 分类 | 设计规范 |
| 格式 | 新格式 |

## 功能

- 生成信息架构
- 定义组件结构
- 设计交互流程
- 规划响应式布局
- 可访问性要求

## 输出内容

| 部分 | 说明 |
|------|------|
| information_architecture | 页面结构和层级 |
| components | 组件类型、属性、状态 |
| interactions | 事件和转场 |
| responsive | 断点和布局规则 |
| accessibility | WCAG 要求 |
| design_tokens | 设计令牌（如有） |

## 使用

```bash
npx cogn@2.2.11 run ui-spec-generator --args "健康产品官网，目标用户25-45岁精英" --pretty
```

## 输出示例

```json
{
  "specification": {
    "information_architecture": {
      "sections": ["Header", "Hero", "Features", "Testimonials", "CTA", "Footer"],
      "hierarchy": {...}
    },
    "components": [
      {
        "name": "Hero Section",
        "type": "Hero",
        "props": {
          "headline": "string",
          "subheadline": "string",
          "primaryButton": "object"
        }
      }
    ],
    "interactions": [
      {
        "event": "Click",
        "description": "点击 CTA",
        "action": "跳转到购买页"
      }
    ],
    "responsive": {
      "breakpoints": [
        { "size": "mobile", "maxWidth": "767px" },
        { "size": "tablet", "minWidth": "768px" },
        { "size": "desktop", "minWidth": "1024px" }
      ]
    },
    "accessibility": {
      "level": "WCAG-AA",
      "requirements": [
        "所有图片有 alt 文本",
        "色彩对比度符合标准"
      ]
    }
  },
  "rationale": {
    "decisions": [...],
    "assumptions": [...],
    "open_questions": [...]
  },
  "confidence": 0.85
}
```

## 输出字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `specification` | object | UI 规范主体 |
| `specification.information_architecture` | object | 信息架构 |
| `specification.components` | array | 组件定义 |
| `specification.interactions` | array | 交互定义 |
| `specification.responsive` | object | 响应式规则 |
| `specification.accessibility` | object | 可访问性要求 |
| `rationale` | object | 设计决策 |
| `confidence` | number | 置信度 0-1 |
