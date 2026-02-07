---
sidebar_position: 1
---

# 发布说明

本节记录 Cognitive 2.2.x 的运行时与包变更。

## 最新版本

- [v2.2.8](./v2.2.8)

## 说明

默认 CLI/HTTP/MCP/compose 输出使用统一 envelope。
`compose --trace` 属于调试包装输出，不是纯 envelope 模式。

## 不同渠道版本号（有意不一致）

Cognitive 2.2.x 的公开发布渠道包括：

- npm（主运行时）：`cognitive-modules-cli` 与 `cogn`
- registry tarball（GitHub Release 资产）：`*.tar.gz` + `cognitive-registry.v2.json`
