---
sidebar_position: 1
---

# 发布说明

本节记录 Cognitive 2.2.x 的运行时与包变更。

## 最新版本

- [v2.2.7](./v2.2.7)

## 说明

默认 CLI/HTTP/MCP/compose 输出使用统一 envelope。
`compose --trace` 属于调试包装输出，不是纯 envelope 模式。

## 不同渠道版本号（有意不一致）

本发布线下，npm、PyPI 与 registry tarball 的版本号**有意不完全一致**：

- npm（主运行时）：`cognitive-modules-cli@2.2.7` 与 `cogn@2.2.7`
- registry tarball（GitHub Release 资产）：`*-2.2.7.tar.gz`
- PyPI（遗留，冻结）：`cognitive-modules@2.2.3`

原因：Node.js 运行时与 registry assets 是主要维护对象；Python 包属于遗留，当前不再随发布线同步更新。
