---
sidebar_position: 1
sidebar_label: Overview
---

# 模块库

本仓库包含若干示例模块，可通过 GitHub 安装后使用 `cog` 运行。

## 仓库内模块

- code-reviewer
- code-simplifier
- task-prioritizer
- api-designer
- ui-spec-generator
- ui-component-generator
- product-analyzer

## 从 GitHub 安装

```bash
cog add ziel-io/cognitive-modules -m code-reviewer
cog add ziel-io/cognitive-modules -m code-simplifier
```

## 快速使用

```bash
cog run code-reviewer --args "your code" --pretty
cog run task-prioritizer --args "fix bug, write docs" --pretty
```
