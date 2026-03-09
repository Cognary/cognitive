---
sidebar_position: 6
---

# Benchmark 证据

这一页只回答一个很窄的问题：

**和 raw prompting 相比，Cognitive 是否真的更适合作为 merge-gate contract？**

## Benchmark 设置

我们用内置 benchmark runner，在同样的 4 个 case 上对比 4 种模式：

- `raw-text`
- `raw-schema`
- `cognitive-core`
- `cognitive-standard`

Case：

- `incident-triage-extraction`
- `product-brief-extraction`
- `pr-review-sql-injection`
- `pr-review-input-validation`

核心指标：

- `targetSchemaPassRate`
- `semanticPassRate`
- `manualFixRate`
- `stabilityRate`

## Gemini（`gemini-3-pro-preview`）

| Mode | schema | semantic | manual fix | stability |
|------|--------|----------|------------|-----------|
| `raw-text` | `0.00` | `0.25` | `1.00` | `0.625` |
| `raw-schema` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-core` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-standard` | `1.00` | `1.00` | `0.00` | `1.00` |

## MiniMax（`MiniMax-M2.1`）

| Mode | schema | semantic | manual fix | stability |
|------|--------|----------|------------|-----------|
| `raw-text` | `0.00` | `0.25` | `1.00` | `0.625` |
| `raw-schema` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-core` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-standard` | `1.00` | `1.00` | `0.00` | `1.00` |

## 这意味着什么

### `raw-text` 不是系统接口

它看起来像能用，但并不能稳定满足合同。在上面两个 provider 上，它都没法通过 schema baseline，并且需要人工清理。

### `raw-schema` 是强基线

这一点很重要。Cognitive 不能只和弱 prompt 对比。

benchmark 说明：在一个收敛后的任务集上，强 schema prompt 也可以很稳。

### Cognitive 的价值不是“更会写 JSON”

`cognitive-core` 和 `cognitive-standard` 达到了和强 schema prompt 一样的稳定度，但还额外提供：

- v2.2 envelope（`ok/meta/data|error`）
- repair / normalization
- provider 降级处理
- policy 可见性（`meta.policy`）
- 可发布模块格式

所以真正的价值不是“更聪明”，而是：

**更适合进入 CI、门禁和工作流系统。**

## 为什么结果会变好

早期结果里，最不稳定的是自由文本字段，例如：

- `summary`
- `title`
- `customer_impact`
- `next_action`

现在这套 benchmark 合同已经收敛成 canonical labels，例如：

- `reject_until_security_fix`
- `reject_until_validation_added`
- `sql_injection`
- `missing_input_validation`
- `parameterized_queries`

这样就把不必要的措辞漂移压掉了，也让稳定性变得可测。

## 推荐的解读方式

如果你的目标是：

- 临时 prompt
- 一次性分析
- 只给人看

那 Cognitive 可能偏重。

如果你的目标是：

- PR gate
- 结构化抽取进入工作流
- 依据 risk/confidence 路由
- 跨 provider 的合同稳定性

那 Cognitive 现在已经有了实测证据。

## 本地复现

在 `packages/cli-node` 下：

```bash
npm run build
npm run bench:cognitive-vs-raw -- --provider gemini --model gemini-3-pro-preview --runs 2
npm run bench:cognitive-vs-raw -- --provider minimax --model MiniMax-M2.1 --runs 2
```

benchmark runner 位置：

- `packages/cli-node/benchmarks/cognitive-vs-raw/run.mjs`
