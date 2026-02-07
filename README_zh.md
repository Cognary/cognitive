# Cognitive Modules

[![CI](https://github.com/Cognary/cognitive/actions/workflows/ci.yml/badge.svg)](https://github.com/Cognary/cognitive/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![npm downloads](https://img.shields.io/npm/dm/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 可验证的结构化 AI 任务规范

[English](README.md) | 中文

Cognitive Modules 是一套用于 **可验证、可审计、强约束** AI 任务的规范与运行时。

## 现状

- **主运行时**：Node.js CLI（`cognitive-modules-cli`，命令 `cog`）

## 版本

- **运行时（npm）**：`2.2.8`
- **规范**：v2.2

## 安装（Node.js）

```bash
# 零安装快速体验
npx cogn@2.2.8 --help

# 或使用完整包名
npx cognitive-modules-cli@2.2.8 --help

# 全局安装
npm install -g cogn@2.2.8
# 或：npm install -g cognitive-modules-cli@2.2.8
```

> `cogn` 是 `cognitive-modules-cli` 的别名包，两者提供相同的 `cog` 命令。

## Registry Index（latest 策略）

默认情况下，CLI 会从 **最新 GitHub Release** 的 assets 拉取 registry index：

- `https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json`

如需可复现（可固定版本），建议固定到具体 tag：

- `https://github.com/Cognary/cognitive/releases/download/v2.2.8/cognitive-registry.v2.json`

覆盖方式：

- 环境变量：`COGNITIVE_REGISTRY_URL`
- 环境变量：`COGNITIVE_REGISTRY_TIMEOUT_MS`（毫秒）
- 环境变量：`COGNITIVE_REGISTRY_MAX_BYTES`
- CLI 参数：`--registry <url>`
- CLI 参数：`--registry-timeout-ms <ms>`
- CLI 参数：`--registry-max-bytes <n>`

## 快速开始

```bash
# 配置 Provider（以 OpenAI 为例）
export OPENAI_API_KEY=sk-xxx

# 运行代码审查
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 运行任务优先级排序
cog run task-prioritizer --args "fix bug(urgent), write docs, optimize performance" --pretty

# 运行 API 设计
cog run api-designer --args "order system CRUD API" --pretty

# 启动 HTTP API 服务
cog serve --port 8000

# 启动 MCP Server（Claude Code / Cursor 集成）
cog mcp
```

## v2.2 响应格式

所有模块返回统一 v2.2 envelope：

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "用于快速路由的简短摘要（≤280 字）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理，便于审计与人工复核",
    "extensions": {
      "insights": [
        {
          "text": "额外洞察",
          "suggested_mapping": "建议加入 schema 的字段"
        }
      ]
    }
  }
}
```

## 核心特性

- **强类型契约**：输入/输出 JSON Schema 校验
- **控制/数据分离**：`meta` 用于路由，`data` 为业务负载
- **模块分层**：`exec | decision | exploration`
- **子代理编排**：`@call:module` 模块间调用
- **组合执行**：顺序/并行/条件/迭代工作流
- **HTTP API & MCP**：一线集成能力
- **修复通道**：自动修复常见 envelope 格式问题

## CLI 命令

```bash
# 模块管理
cog list
cog add <url> --module <path>
cog update <module>
cog remove <module>
cog versions <url>

# 运行模块
cog run <module> --args "..."
cog run <module> --input '{"query":"..."}'

# 组合执行
cog compose <module> --args "..."
cog compose-info <module>

# 校验与迁移
cog validate <module> --v22
cog validate --all
cog migrate <module> --dry-run
cog migrate --all --no-backup

# 其他
cog pipe --module <name>
cog init [name]
cog doctor
cog serve --port 8000
cog mcp
```

## 内置模块（仓库内）

| 模块 | 层级 | 功能 | 示例 |
|------|------|------|------|
| `code-reviewer` | decision | 代码审查 | `cog run code-reviewer --args "your code"` |
| `code-simplifier` | decision | 代码简化 | `cog run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | 任务优先级排序 | `cog run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API 设计 | `cog run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI 规范生成 | `cog run ui-spec-generator --args "e-commerce homepage"` |
| `ui-component-generator` | exploration | UI 组件规范 | `cog run ui-component-generator --args "button component"` |
| `product-analyzer` | exploration | 产品分析 | `cog run product-analyzer --args "health product"` |

## 模块格式（v2.2）

```
my-module/
├── module.yaml     # 机器可读清单
├── prompt.md       # 人类可读 Prompt
├── schema.json     # meta + input + data + error schemas
└── tests/          # 金标测试
```

最小 `module.yaml` 示例：

```yaml
name: my-module
version: 2.2.0
responsibility: One-line description

tier: decision                # exec | decision | exploration
schema_strictness: medium     # high | medium | low

excludes:
  - things not to do

policies:
  network: deny
  filesystem_write: deny
  side_effects: deny

overflow:
  enabled: true
  recoverable: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible        # strict | extensible

failure:
  contract: error_union
  partial_allowed: true

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
```

## LLM 配置

运行时会根据已配置的 API Key 自动选择 Provider，也可以用 `--provider`/`--model` 显式指定。

环境变量：

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `MINIMAX_API_KEY`
- `MOONSHOT_API_KEY`
- `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`
- `OLLAMA_HOST`（本地 Ollama）
- `COG_MODEL`（强制模型覆盖）

检查配置：

```bash
cog doctor
```

## 开发（Node.js）

```bash
# 克隆
git clone https://github.com/Cognary/cognitive.git
cd cognitive-modules

# 安装
cd packages/cli-node
npm install

# 构建
npm run build

# 测试
npm test
```

## 文档

### 规范

| 文档 | 说明 |
|------|------|
| [SPEC-v2.2.md](SPEC-v2.2.md) | v2.2 完整规范 |
| [SPEC-v2.2_zh.md](SPEC-v2.2_zh.md) | v2.2 中文规范 |

### 实现者

| 文档 | 说明 |
|------|------|
| [IMPLEMENTERS-GUIDE.md](IMPLEMENTERS-GUIDE.md) | 运行时实现指南 |
| [CONFORMANCE.md](CONFORMANCE.md) | 合规等级 |
| [ERROR-CODES.md](ERROR-CODES.md) | 标准错误码 |
| [templates/runtime-starter/](templates/runtime-starter/) | 运行时模板 |

### 高级

| 文档 | 说明 |
|------|------|
| [COMPOSITION.md](COMPOSITION.md) | 组合执行与数据流 |
| [CONTEXT-PROTOCOL.md](CONTEXT-PROTOCOL.md) | 上下文协议 |
| [COGNITIVE-PROTOCOL.md](COGNITIVE-PROTOCOL.md) | 协议细节 |
| [INTEGRATION.md](INTEGRATION.md) | 集成指南 |

### Schema 与测试向量

| 资源 | 说明 |
|------|------|
| [spec/response-envelope.schema.json](spec/response-envelope.schema.json) | v2.2 envelope schema |
| [spec/module.yaml.schema.json](spec/module.yaml.schema.json) | module.yaml schema |
| [spec/test-vectors/](spec/test-vectors/) | 合规测试向量 |

### Registry（仅规范层）

| 资源 | 说明 |
|------|------|
| [REGISTRY-PROTOCOL.md](REGISTRY-PROTOCOL.md) | Registry 协议规范 |
| [cognitive-registry.v2.json](cognitive-registry.v2.json) | Node CLI 默认使用的 Registry Index（v2） |
| [spec/registry.schema.json](spec/registry.schema.json) | Registry Index Schema（v2） |
| [spec/registry-entry.schema.json](spec/registry-entry.schema.json) | Registry entry schema |

## License

MIT
