---
sidebar_position: 1
---

# Providers 与能力矩阵

Cognitive 把下列概念分开：

- Provider：OpenAI、Anthropic、Gemini、MiniMax 等
- Model：某个 provider 下的具体模型名
- Policy：运行时门禁策略（校验、审计、structured 输出策略）

本页说明 provider 之间最常见的差异点，以及 Cognitive 如何把行为“协议化”到一致。

## 稳定支持面（Stable Support Surface）

为了减少认知负担、避免对长尾 provider 过度承诺，npm 运行时对外只承诺以下 6 个 provider 的“稳定支持面”（文档/CI/发布门禁保证）：

- OpenAI (ChatGPT)
- Anthropic (Claude)
- Gemini
- MiniMax
- DeepSeek
- Qwen (DashScope)

其他 provider 可能作为实验/社区集成保留实现，但默认不在“稳定支持矩阵”里承诺稳定性，通常需要显式指定 `--provider`，并可能需要 provider 级适配。

## 快速检查

用 `npx cogn@2.2.13 providers` 查看当前环境能力（默认只列出稳定支持面）：

```bash
npx cogn@2.2.13 providers
```

如需查看全部 provider（含实验/社区）：

```bash
npx cogn@2.2.13 providers --all
```

典型字段：

- `structured`：是否支持 provider 原生的 JSON Schema 风格结构化输出
- `streaming`：是否支持流式输出
- `default_model`：未指定 `--model` 时的默认模型

## Structured 输出策略

不同 provider 对 JSON Schema 子集支持不一致。
为了让 v2.2 envelope 在协议层稳定，Cognitive 提供统一开关：

```bash
npx cogn@2.2.13 run <module> --args "..." --structured auto|off|prompt|native
```

含义：

- `auto`：优先 native，若不支持则用 prompt；且在 schema 不兼容时允许一次 `native -> prompt` 降级（更稳定）
- `native`：优先使用原生 **JSON Schema** enforcement（更接近 provider 原生能力）；当 provider 不支持 JSON Schema 原生或方言不是 JSON Schema 时会安全降级到 `prompt`，避免 400；当 provider 因 schema 子集不兼容而拒绝时，会尝试一次 `native -> prompt`（更好的 UX）
- `prompt`：不发送原生 schema，只用提示词让模型返回 JSON
- `off`：不在 provider 层做 structured 强约束（调试用）

推荐默认值：

- 除非你在排查 provider 的 schema 兼容性，否则用 `auto`

## 运行时如何解释“降级”

每次运行的最终决定会写入 v2.2 envelope 的 `meta.policy.structured`，用于诊断 provider 差异：

- `requested`：用户请求值（`auto|native|prompt|off`）
- `resolved`：运行时计划采用的策略
- `applied`：实际采用的策略（包含重试/降级后的最终值）
- `downgraded`：`applied != resolved` 时为 `true`
- `fallback.attempted`：是否发生过一次 `native -> prompt` 的重试
- `fallback.reason`：发生重试时的简短原因
- `provider.*`：provider 能力快照（用于解释为什么会计划/降级）

## Provider 备注

### Gemini

Gemini 可能拒绝其他 provider 常见的 JSON Schema 关键词。
如果你看到类似 `const`、布尔枚举、空对象 schema 等错误，建议：

```bash
npx cogn@2.2.13 run <module> --args "..." --structured prompt
```

这样能保持 envelope 合同稳定，同时绕开 provider 原生 schema 的限制。

### MiniMax

MiniMax 通常在 prompt JSON 路径下稳定，`--structured auto` 一般足够。

## Streaming 传输

Cognitive 标准化的是事件模型，传输层会因接口而不同：

- HTTP：SSE 更适合浏览器与代理
- CLI：NDJSON 更适合管道与日志回放

协议层要求是：事件可重建最终 v2.2 envelope，且行为在 CLI/HTTP/MCP 间一致。
