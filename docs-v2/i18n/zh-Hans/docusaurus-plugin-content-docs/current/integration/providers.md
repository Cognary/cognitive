---
sidebar_position: 1
---

# Providers 与能力矩阵

Cognitive 把下列概念分开：

- Provider：OpenAI、Anthropic、Gemini、MiniMax 等
- Model：某个 provider 下的具体模型名
- Policy：运行时门禁策略（校验、审计、structured 输出策略）

本页说明 provider 之间最常见的差异点，以及 Cognitive 如何把行为“协议化”到一致。

## 快速检查

用 `cog providers` 查看当前环境能力：

```bash
cog providers
```

典型字段：

- `structured`：是否支持 provider 原生的 JSON Schema 风格结构化输出
- `streaming`：是否支持流式输出
- `default_model`：未指定 `--model` 时的默认模型

## Structured 输出策略

不同 provider 对 JSON Schema 子集支持不一致。
为了让 v2.2 envelope 在协议层稳定，Cognitive 提供统一开关：

```bash
cog run <module> --args "..." --structured auto|off|prompt|native
```

含义：

- `auto`：优先 native，若不支持则用 prompt；且在 schema 不兼容时允许一次 `native -> prompt` 降级（更稳定）
- `native`：强制原生 structured；不支持或被拒绝就直接失败
- `prompt`：不发送原生 schema，只用提示词让模型返回 JSON
- `off`：不在 provider 层做 structured 强约束（调试用）

推荐默认值：

- 除非你在排查 provider 的 schema 兼容性，否则用 `auto`

## Provider 备注

### Gemini

Gemini 可能拒绝其他 provider 常见的 JSON Schema 关键词。
如果你看到类似 `const`、布尔枚举、空对象 schema 等错误，建议：

```bash
cog run <module> --args "..." --structured prompt
```

这样能保持 envelope 合同稳定，同时绕开 provider 原生 schema 的限制。

### MiniMax

MiniMax 通常在 prompt JSON 路径下稳定，`--structured auto` 一般足够。

## Streaming 传输

Cognitive 标准化的是事件模型，传输层会因接口而不同：

- HTTP：SSE 更适合浏览器与代理
- CLI：NDJSON 更适合管道与日志回放

协议层要求是：事件可重建最终 v2.2 envelope，且行为在 CLI/HTTP/MCP 间一致。

