---
sidebar_position: 4
---

# Killer Use Case（杀手级场景）

“变简单”能提高上手率，但“变必要”才会带来传播与生态。
下面这些场景里，Cognitive 的合同与可审计性很难被临时 prompt 方案替代。

## 1) 高风险决策 + 路由（Human-in-the-Loop）

当 AI 输出可能影响生产时，你通常需要：

- 严格的 envelope（永远同一结构）。
- 明确的 `risk` / `confidence` 用于路由与升级。
- schema 校验阻止畸形 payload 进入下游系统。

常见落地模式：

1. `tier: exec` 或 `tier: decision`
2. 强制 `meta.explain`（短摘要）+ `data.rationale`（审计用长解释）
3. 按 `meta.risk` 分流：
   - `low`：自动应用/自动合并
   - `medium`：必须人工复核
   - `high`：阻断并升级

## 2) IDE 原生工作流（MCP）+ 流式

对 Cursor / Claude Code 等工具来说，理想体验是：

- 工具侧收到 streaming events（进度）+ 最终 envelope（结果）。
- 运行时对 CLI/HTTP/MCP 一视同仁执行同样的 schema/policy 校验。

推荐的传输分工：

- MCP/HTTP：SSE streaming
- CLI：NDJSON streaming

最关键的不变量是：**同一个模块，在不同传输下得到同样的策略行为与最终 envelope**。

## 3) 可组合的多步工作流（Composition）

当满足以下条件时，Composition 才真正成为“协议能力”：

- 每一步都输出可校验的 envelope。
- 路由与聚合消费的是类型化输出（不是自由文本）。
- 中间态与失败都可审计、可复盘。

这是 Cognitive 从“工具”走向“工作流合同系统”的关键边界。

