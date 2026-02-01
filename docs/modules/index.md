# 模块库

Cognitive Modules 提供多个内置模块，开箱即用。

## 内置模块

| 模块 | 功能 | 格式 | 分类 |
|------|------|:----:|------|
| [code-reviewer](code-reviewer.md) | 代码审查 | v1 | 代码质量 |
| [code-simplifier](code-simplifier.md) | 代码简化（行为等价） | **v2** | 代码质量 |
| [task-prioritizer](task-prioritizer.md) | 任务优先级排序 | v1 | 项目管理 |
| [api-designer](api-designer.md) | REST API 设计 | v1 | 设计规范 |
| [ui-spec-generator](ui-spec-generator.md) | UI 规范生成 | v1 | 设计规范 |
| product-analyzer | 产品分析（子代理示例） | v1 | 编排示例 |

## 快速使用

```bash
# 代码审查
cog run code-reviewer --args "你的代码" --pretty

# 任务排序
cog run task-prioritizer --args "修复bug, 写文档, 优化性能" --pretty

# API 设计
cog run api-designer --args "订单系统 CRUD" --pretty

# UI 规范
cog run ui-spec-generator --args "电商首页" --pretty
```

## 安装更多模块

### 从注册表安装

```bash
cog search "关键词"
cog install registry:module-name
```

### 从 GitHub 安装

```bash
cog install github:user/repo/path/to/module
```

### 从本地安装

```bash
cog install ./path/to/module
```

## 查看模块详情

```bash
cog info code-reviewer
```

输出：

```
code-reviewer v1.0.0
Format: new

Responsibility:
  审查代码并提供结构化的改进建议

Excludes:
  - 重写整个代码
  - 执行代码

Constraints:
  ✓ no_network
  ✓ no_side_effects
  ✓ no_inventing_data

Path: /path/to/cognitive/modules/code-reviewer
Prompt size: 1234 chars
```
