---
name: ui-component-generator
version: 2.2.0
responsibility: 根据需求描述生成可用的 React/Vue 组件代码
excludes:
  - 生成后端代码
  - 创建数据库操作
  - 发起网络请求
  - 读写文件系统
---

# UI Component Generator

将组件需求描述转换为可直接使用的前端组件代码。

## 支持的框架

- React (推荐，TypeScript)
- Vue 3 (Composition API)

## 支持的样式方案

- Tailwind CSS (默认)
- CSS Modules
- Styled Components
- Inline Styles

## 使用示例

### 命令行

```bash
# 自然语言描述
cog run ui-component-generator --args "创建一个支持多选的下拉菜单组件"

# JSON 输入
cog run ui-component-generator --input '{"component_name": "Dropdown", "framework": "react"}'
```

### 编程调用

```typescript
import { run } from '@anthropic/cognitive-runtime';

const result = await run('ui-component-generator', {
  component_name: 'Dropdown',
  framework: 'react',
  description: '支持多选的下拉菜单',
  props: [
    { name: 'options', type: 'Option[]', required: true },
    { name: 'multiple', type: 'boolean', default: false }
  ],
  styling: 'tailwind'
});
```

## 输出说明

生成的组件包含：

1. **主组件文件** - 完整的 TypeScript 组件代码
2. **类型定义** - Props 接口和相关类型
3. **样式文件** - 根据选择的样式方案
4. **使用示例** - 展示各种用法的代码片段
5. **Props 文档** - 每个 prop 的说明

## 质量保证

- ✅ TypeScript 类型完整
- ✅ 无障碍支持 (ARIA)
- ✅ 响应式设计
- ✅ 可组合和可扩展
