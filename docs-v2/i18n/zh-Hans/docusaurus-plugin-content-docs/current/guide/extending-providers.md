---
sidebar_position: 8
---

# 扩展 Provider

npm 运行时是 provider-agnostic 的，但项目会刻意维护一个**小且明确的稳定支持面**（减少认知负担，也降低维护成本）：

- OpenAI (ChatGPT)
- Anthropic (Claude)
- Gemini
- MiniMax
- DeepSeek
- Qwen (DashScope)

其他 provider 可能作为实验/社区集成保留实现。它们可以工作，但不纳入“稳定支持承诺”，通常需要 provider 级适配。

本页说明如何以“更像协议工具”的方式新增/适配 provider，并确保对用户的契约稳定：

- 始终输出 v2.2 envelope（`ok/meta/data|error`）
- 运行不炸：原生 schema 不支持/被拒绝时，安全降级继续跑（prompt-only JSON + 后验校验）
- 在 `--verbose` 下用 `meta.policy.*` 解释本次策略与降级原因

## 需要实现什么

Provider 需要实现 `Provider` 接口：

- 文件：`packages/cli-node/src/types.ts`
- 最小要求：
  - `name`
  - `isConfigured()`
  - `invoke({ messages, jsonSchema?, jsonSchemaMode?, temperature?, maxTokens? })`

可选但强烈建议：

- `getCapabilities()` 返回 `ProviderCapabilities`
  - `structuredOutput`: `none | prompt | native`
  - 当 `native` 时给出 `nativeSchemaDialect`（例如 `json-schema` vs `gemini-responseSchema`）
  - `maxNativeSchemaBytes`
  - `streaming`

## 注册 Provider

1. 在目录中新增实现：
   - `packages/cli-node/src/providers/<name>.ts`
2. 在 provider registry 注册：
   - `packages/cli-node/src/providers/index.ts`

同时你必须决定它的支持级别（support tier）：

- `stable`：默认出现在 `cog providers`，并纳入文档/CI/发布门禁承诺
- `experimental/community`：默认隐藏，仅在 `cog providers --all` 中展示

## Structured 输出兼容

运行时会结合 `--structured` 和 provider capabilities 选择策略：

- `native`：尽量走 provider 原生 structured 输出（兼容时）
- `prompt`：不发原生 schema，仅把 schema 作为提示词约束
- `off`：provider 层不做 structured 约束（仍会后验解析/校验）

当 `--structured auto` 时，如果 provider 因 schema 子集不兼容拒绝请求，运行时可能会做一次 `native -> prompt` 的重试（更稳定、更少 400）。

建议：

- 若 provider 原生支持严格 JSON Schema：上报
  - `structuredOutput: 'native'`
  - `nativeSchemaDialect: 'json-schema'`
- 若 provider 有原生 schema API 但方言不是 JSON Schema：上报方言，让运行时避免发送不兼容 JSON Schema 并自动改用 `prompt`。

## 错误与诊断预期

Provider 失败应抛出清晰的 `Error`（尽量带 HTTP 状态码与响应体）。

运行时会：

- 将错误包装为统一 envelope 的 `error` 结构
- 保持稳定的错误码面（provider/runtime 错误通常落在 `E4000`）
- 在输出中包含 `provider` 与 `module` 上下文，方便定位

## 最小测试集（必须）

新增一个单元测试，证明请求整形正确且无需真实网络：

- 文件：`packages/cli-node/src/providers/<name>.test.ts`
- 用 stub 的 `globalThis.fetch` 捕获并断言请求 body 的关键字段

可选但建议：

- 若行为会影响 envelope 合同，补 conformance vectors
- 对实验 provider 的测试用环境变量开关门禁（例如 `COG_TEST_EXPERIMENTAL_PROVIDERS=1`），避免 CI 被外部差异打爆

## 本地开发流程

```bash
cd packages/cli-node
npm test
npm run build
node ./bin.js providers --pretty --all
```

