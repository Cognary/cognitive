---
sidebar_position: 3
---

# 渐进复杂（升级触发器）

Cognitive 2.2 的目标是：5 分钟可跑通，但在你需要更强的严谨性时，也能逐步演进到“协议级”的标准。
核心原则是：**只在需求出现时才引入复杂度**。

## Core（5 分钟）

如果你只是想跑一个模块，可以先忽略 registry / conformance / certification：

```bash
npx cogn@2.2.12 run code-reviewer --args "def login(u,p): pass" --pretty
```

## 升级触发器：什么时候该加什么

| 你什么时候需要 | 你需要增加/开启 | 常用命令 | 你得到什么 |
|---|---|---|---|
| **可重复的结构化输出**（不只是文本） | `schema.json`（input/data/meta） | `npx cogn@2.2.12 validate --all` | 合同可机读、可校验；减少 prompt 回归 |
| **策略护栏**（risk/enums/overflow） | `tier`、`schema_strictness`、`overflow`、`enums` | `npx cogn@2.2.12 run ...`（默认校验） | 防止“悄悄漂移”；CLI/HTTP/MCP 行为一致 |
| **可审计**（事后复盘、合规） | 强制 `meta.explain` + 落盘 envelopes/events | `npx cogn@2.2.12 run --stream` | NDJSON 事件流；可重建最终 envelope，并可定位错误 |
| **团队可迁移**（换仓库/换机器） | 项目内模块（project-local） | 模块放 `./cognitive/modules/` | “可复现”从个人升级到团队 |
| **发现与分发**（可搜索、可安装） | registry index + Release tarballs | `npx cogn@2.2.12 search`、`npx cogn@2.2.12 add <registry>` | 可确定性安装、可 pin 版本；更安全的来源模型 |
| **互操作声明**（不是口号） | conformance 测试 + 测试向量 | `npx cogn@2.2.12 test` | 有证据证明实现符合 CEP 行为 |
| **生态背书**（企业/工具商） | certification 信号 + 可验证结果 | CI + 签名结果 | 面向企业采购与工具原生支持的“共同语言” |

## 推荐里程碑

1. 原型：先用现成模块（registry 或 GitHub repo）。
2. 团队：提交模块 + 补齐 `schema.json` + CI 里跑 `npx cogn@2.2.12 validate --all`。
3. 生产：强制 `meta.explain`，记录 envelope/事件流；对高风险 tier 启用更严格策略。
4. 分发：发布 registry index 与 GitHub Release tarball，统一通过 index 安装。
5. 生态：发布 conformance 结果与 certification 信号。

## 传输备注（SSE vs NDJSON）

一个合理的组合是：

- HTTP：流式用 **SSE**（浏览器友好、代理兼容性高）
- CLI：流式用 **NDJSON**（一行一个 JSON，便于管道与日志）

协议层关键在于：两种传输承载同一套 *events 模型*，并能确定性重建最终 envelope。
