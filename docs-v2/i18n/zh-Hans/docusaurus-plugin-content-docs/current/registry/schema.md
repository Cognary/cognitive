---
sidebar_position: 3
---

# Registry Schema

Registry 条目应通过官方 JSON Schema 校验。

## 必填信息

- 模块标识（`name`、`version`）
- 来源位置（`repository`、`path` 或包地址）
- 运行时兼容信息（`tier`、规范版本、可选一致性等级）

## 校验目标

在安装前拒绝畸形或语义不明确的条目。

## 权威来源

- `spec/registry-entry.schema.json`
- `REGISTRY-PROTOCOL.md`
