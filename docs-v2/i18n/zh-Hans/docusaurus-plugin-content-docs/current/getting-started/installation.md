---
sidebar_position: 1
---

# 安装（Node.js）

Cognitive Modules 2.2 通过 npm 分发，命令为 `cog`。

## 安装

```bash
# 零安装
npx cogn@2.2.5 --help

# 全局安装
npm install -g cogn@2.2.5
# 或：npm install -g cognitive-modules-cli@2.2.5
```

## 验证安装

```bash
cog --version
# 输出：Cognitive Runtime v2.2.5

cog doctor
```

## 安装模块

```bash
# 从 GitHub 安装模块（推荐）
cog add Cognary/cognitive -m code-simplifier

# 安装指定版本
cog add Cognary/cognitive -m code-reviewer --tag v1.0.0

# 列出模块
cog list
```

## 版本管理

```bash
cog update code-simplifier
cog update code-simplifier --tag v2.0.0
cog versions Cognary/cognitive
cog remove code-simplifier
```

## 模块搜索路径

1. `./cognitive/modules/`
2. `~/.cognitive/modules/`
