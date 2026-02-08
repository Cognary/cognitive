---
sidebar_position: 1
---

# 发布说明

本节记录 Cognitive 2.2.x 的运行时与包变更。

## 最新版本

- [v2.2.13](./v2.2.13)

## 说明

默认 CLI/HTTP/MCP/compose 输出使用统一 envelope。
`compose --trace` 属于调试包装输出，不是纯 envelope 模式。

## 发布渠道

Cognitive 2.2.x 的公开发布渠道包括：

- npm（主运行时）：`cognitive-modules-cli` 与 `cogn`
- registry tarball（GitHub Release 资产）：`*.tar.gz` + `cognitive-registry.v2.json`

版本策略：

- npm 版本与 registry 资产版本保持 **一致**（tag `vX.Y.Z` 对应 `packages/*/package.json` 以及 registry 资产文件名）。
