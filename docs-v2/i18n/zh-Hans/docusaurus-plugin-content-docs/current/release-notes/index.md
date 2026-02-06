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

## 不同渠道版本号（统一）

本发布线下，npm、PyPI 与 registry tarball 的版本号保持一致：

- npm（主运行时）：`cognitive-modules-cli@2.2.7` 与 `cogn@2.2.7`
- PyPI：`cognitive-modules@2.2.7`

原因：统一版本号能显著降低用户理解成本，避免“Release tag vs 资产文件名”不一致造成的困惑。
