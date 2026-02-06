---
sidebar_position: 1
---

# 发布说明

本节记录 Cognitive 2.2.x 的运行时与包变更。

## 最新版本

- [v2.2.5](./v2.2.5)

## 说明

默认 CLI/HTTP/MCP/compose 输出使用统一 envelope。
`compose --trace` 属于调试包装输出，不是纯 envelope 模式。

## 不同渠道版本号（刻意不一致）

各发行渠道的版本号不要求严格一致，这是刻意设计：

- npm（主运行时）：`cognitive-modules-cli@2.2.5` 与 `cogn@2.2.5`
- PyPI（Python 遗留包）：`cognitive-modules@2.2.3`

原因：Node.js 运行时是 Cognitive 2.2.x 的主要维护对象；Python 包单独发布，可能存在滞后或独立补丁节奏。
