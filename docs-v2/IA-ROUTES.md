# Cognitive 2.2.7 文档站点目录与路由清单（信息架构落地版）

## 1) 站点基线

- 文档框架：Docusaurus (`docs-v2`)
- Docs 基础路由：`/docs/*`
- 站点主页路由：`/`
- 生产环境基路径（当前配置）：`/cognitive/`
- 国际化：`en`、`zh-Hans`（中文路由前缀为 `/zh-Hans/*`）

## 2) UI 规范 IA -> 路由域映射

| IA section id | 路由域 | 说明 |
|---|---|---|
| `site-header` | 全站导航（非独立页面） | 顶部导航、搜索、版本切换 |
| `homepage-hero` | `/` | 首页 Hero 与主入口 CTA |
| `docs-explorer` | `/docs/*` | 主文档阅读区、侧边栏、目录 |
| `api-reference` | `/docs/cli/*`, `/docs/integration/*` | CLI/API/MCP/集成参考 |
| `conformance` | `/docs/conformance/*` | 一致性等级与测试 |
| `registry` | `/docs/registry/*` | 发现、分发、协议、schema |
| `release-notes` | `/docs/release-notes/*` | 版本发布说明与迁移 |
| `community-feedback` | `/docs/community/*` | 治理、贡献、反馈 |
| `site-footer` | 全站页脚（非独立页面） | spec/governance/license 固定入口 |

## 3) 站点目录（落地版）

```text
docs-v2/
  docusaurus.config.ts
  sidebars.ts
  src/pages/
    index.tsx                                  # 已有：首页
  docs/
    index.md                                   # 已有：Docs 首页
    spec.md                                    # 已有：规范入口

    getting-started/                           # 已有
      installation.md
      first-module.md
      progressive-complexity.md
      use-cases.md
      llm-config.md

    guide/                                     # 已有
      module-format.md
      arguments.md
      subagent.md
      context-philosophy.md
      typescript-runtime.md
      programmatic-api.md
      testing.md

    cli/                                       # 已有
      overview.md
      run.md
      validate.md
      migrate.md

    integration/                               # 已有
      providers.md                             # 新增：providers 能力矩阵与 structured 策略
      http-api.md
      mcp.md
      ai-tools.md
      agent-protocol.md

    modules/                                   # 已有
      index.md
      code-reviewer.md
      code-simplifier.md
      task-prioritizer.md
      api-designer.md
      ui-spec-generator.md

    conformance/                               # 已新增
      index.md
      levels.md
      testing.md

    registry/                                  # 已新增
      index.md
      protocol.md
      schema.md
      publishable-artifacts.md                 # 新增：可迁移/可发布产物清单（实践版）

    release-notes/                             # 已新增
      index.md
      v2.2.7.md

    community/                                 # 已新增
      contributing.md
      governance.md
      cmep-process.md
      spec-lifecycle.md

    spec/                                      # 已新增（CEP 分层规范）
      cep/
        overview.md
        module.md
        envelope.md
        events.md
        conformance.md
        registry.md
        artifacts.md
```

## 4) 路由清单

### 4.1 当前已落地路由

| 路由 | 页面文件 |
|---|---|
| `/` | `src/pages/index.tsx` |
| `/docs` | `docs/index.md` |
| `/docs/spec` | `docs/spec.md` |
| `/docs/getting-started/installation` | `docs/getting-started/installation.md` |
| `/docs/getting-started/first-module` | `docs/getting-started/first-module.md` |
| `/docs/getting-started/progressive-complexity` | `docs/getting-started/progressive-complexity.md` |
| `/docs/getting-started/use-cases` | `docs/getting-started/use-cases.md` |
| `/docs/getting-started/llm-config` | `docs/getting-started/llm-config.md` |
| `/docs/guide/module-format` | `docs/guide/module-format.md` |
| `/docs/guide/arguments` | `docs/guide/arguments.md` |
| `/docs/guide/subagent` | `docs/guide/subagent.md` |
| `/docs/guide/context-philosophy` | `docs/guide/context-philosophy.md` |
| `/docs/guide/typescript-runtime` | `docs/guide/typescript-runtime.md` |
| `/docs/guide/programmatic-api` | `docs/guide/programmatic-api.md` |
| `/docs/guide/testing` | `docs/guide/testing.md` |
| `/docs/cli/overview` | `docs/cli/overview.md` |
| `/docs/cli/core` | `docs/cli/core.md` |
| `/docs/cli/run` | `docs/cli/run.md` |
| `/docs/cli/validate` | `docs/cli/validate.md` |
| `/docs/cli/migrate` | `docs/cli/migrate.md` |
| `/docs/integration/http-api` | `docs/integration/http-api.md` |
| `/docs/integration/providers` | `docs/integration/providers.md` |
| `/docs/integration/mcp` | `docs/integration/mcp.md` |
| `/docs/integration/ai-tools` | `docs/integration/ai-tools.md` |
| `/docs/integration/agent-protocol` | `docs/integration/agent-protocol.md` |
| `/docs/modules` | `docs/modules/index.md` |
| `/docs/modules/code-reviewer` | `docs/modules/code-reviewer.md` |
| `/docs/modules/code-simplifier` | `docs/modules/code-simplifier.md` |
| `/docs/modules/task-prioritizer` | `docs/modules/task-prioritizer.md` |
| `/docs/modules/api-designer` | `docs/modules/api-designer.md` |
| `/docs/modules/ui-spec-generator` | `docs/modules/ui-spec-generator.md` |

### 4.2 IA 目标下新增路由（已落地）

| 路由 | 目标文件 | 主要来源文档 |
|---|---|---|
| `/docs/conformance` | `docs/conformance/index.md` | `CONFORMANCE.md` |
| `/docs/conformance/levels` | `docs/conformance/levels.md` | `CONFORMANCE.md` |
| `/docs/conformance/testing` | `docs/conformance/testing.md` | `CONFORMANCE-TESTING.md`, `spec/test-vectors/README.md` |
| `/docs/registry` | `docs/registry/index.md` | `REGISTRY-PROTOCOL.md` |
| `/docs/registry/protocol` | `docs/registry/protocol.md` | `REGISTRY-PROTOCOL.md` |
| `/docs/registry/schema` | `docs/registry/schema.md` | `spec/registry-entry.schema.json` |
| `/docs/registry/publishable-artifacts` | `docs/registry/publishable-artifacts.md` | `cog registry build/verify`（实践版清单） |
| `/docs/release-notes` | `docs/release-notes/index.md` | `packages/cli-node/CHANGELOG.md`, `packages/cogn/CHANGELOG.md` |
| `/docs/release-notes/v2.2.7` | `docs/release-notes/v2.2.7.md` | `packages/cli-node/CHANGELOG.md` |
| `/docs/community/contributing` | `docs/community/contributing.md` | `README.md`（贡献部分） |
| `/docs/community/governance` | `docs/community/governance.md` | `GOVERNANCE.md` |
| `/docs/community/cmep-process` | `docs/community/cmep-process.md` | `CMEP-PROCESS.md` |
| `/docs/community/spec-lifecycle` | `docs/community/spec-lifecycle.md` | `SPEC-LIFECYCLE.md` |

### 4.3 CEP 规范新增路由（已落地）

| 路由 | 目标文件 | 说明 |
|---|---|---|
| `/docs/spec/cep/overview` | `docs/spec/cep/overview.md` | `cep.*` 总览与版本线 |
| `/docs/spec/cep/module` | `docs/spec/cep/module.md` | `cep.module.v2.2`：`module.yaml`、requires/composition 语义 |
| `/docs/spec/cep/envelope` | `docs/spec/cep/envelope.md` | `cep.envelope.v2.2`：统一 envelope 与错误结构 |
| `/docs/spec/cep/events` | `docs/spec/cep/events.md` | `cep.events.v2.2`：streaming 事件模型（可重建最终 envelope） |
| `/docs/spec/cep/conformance` | `docs/spec/cep/conformance.md` | `cep.conformance.v2.2`：测试向量与一致性断言 |
| `/docs/spec/cep/registry` | `docs/spec/cep/registry.md` | `cep.registry`（草案）：发现与分发（安全模型优先） |
| `/docs/spec/cep/artifacts` | `docs/spec/cep/artifacts.md` | `cep.artifacts`：可迁移/可发布产物清单（tarball 为载体） |

## 5) 国际化路由规则

- 英文：`/docs/...`
- 中文：`/zh-Hans/docs/...`
- 规则：中文页面与英文页面保持一一对应 slug，避免跨语言链接失效。

## 6) 导航结构（用于 `sidebars.ts`）

1. Introduction
2. Getting Started
3. Guide
4. API & CLI Reference
5. Modules
6. Conformance
7. Registry
8. Release Notes
9. Community
10. Specification

## 7) 严格一致性口径（发布说明建议）

- 默认 CLI/HTTP/MCP/compose 输出使用统一 envelope。
- `compose --trace` 为调试包装输出，不属于纯 envelope 输出；发布说明需明确该行为，避免与“严格一致”语义冲突。

## 8) 首页入口落地状态（已实现）

- 首页 Hero 已包含 `Get Started`、`Specification`、`GitHub` 三个主入口。
- 首页已新增主题直达卡片：`Conformance`、`Registry`、`Release Notes`、`Community`。
- 上述入口分别对齐到 `/docs/conformance`、`/docs/registry`、`/docs/release-notes`、`/docs/community/contributing`。
