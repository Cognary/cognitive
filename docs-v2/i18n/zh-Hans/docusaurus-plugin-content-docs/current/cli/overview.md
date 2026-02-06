---
sidebar_position: 1
---

# CLI 概览（Node.js）

Cognitive Modules CLI 通过 npm 分发，命令为 `cog`。

## 安装

```bash
npx cogn@2.2.5 --help
npm install -g cogn@2.2.5
# 或：npm install -g cognitive-modules-cli@2.2.5
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `list` | 列出模块 |
| `run <module>` | 运行模块 |
| `pipe --module <name>` | 管道模式 |
| `init [name]` | 初始化项目/创建模块 |
| `add <url>` | 从 GitHub 安装模块 |
| `update <module>` | 更新模块 |
| `versions <url>` | 查看可用版本 |
| `remove <module>` | 删除模块 |
| `compose <module>` | 组合执行 |
| `compose-info <module>` | 查看组合配置 |
| `validate <module>` | 校验模块 |
| `migrate <module>` | 迁移到 v2.2 |
| `serve` | 启动 HTTP API |
| `mcp` | 启动 MCP Server |
| `doctor` | 环境检查 |

## 常用流程

```bash
cog run code-reviewer --args "your code" --pretty
cog init my-module
cog validate my-module --v22
cog add ziel-io/cognitive-modules -m code-simplifier
cog compose code-review-pipeline --args "code" --trace
```
