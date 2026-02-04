# Cognitive Modules

[![CI](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml/badge.svg)](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![PyPI version](https://img.shields.io/pypi/v/cognitive-modules.svg)](https://pypi.org/project/cognitive-modules/)
[![npm downloads](https://img.shields.io/npm/dm/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 可验证的结构化 AI 任务规范

[English](README.md) | 中文

Cognitive Modules 是一种 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

## v2.2 新特性

| 特性 | 说明 |
|------|------|
| **Control/Data 分离** | `meta` 控制面 + `data` 数据面，中间件无需解析业务 |
| **模块分级 (Tier)** | `exec` / `decision` / `exploration` 不同严格度 |
| **可回收溢出** | `extensions.insights` 保留 LLM 的额外洞察 |
| **可扩展 Enum** | 允许自定义类型，不牺牲类型安全 |
| **Repair Pass** | 自动修复格式问题，降低验证失败率 |

## 特性

- **强类型契约** - JSON Schema 双向验证输入输出
- **可解释输出** - 强制输出 `confidence` + `rationale`
- **Control/Data 分离** - `meta.explain` 快速路由 + `data.rationale` 详细审计
- **模块分级** - exec / decision / exploration 不同约束等级
- **子代理编排** - `@call:module` 支持模块间调用
- **参数传递** - `$ARGUMENTS` 运行时替换
- **多 LLM 支持** - OpenAI / Anthropic / MiniMax / Ollama
- **公共注册表** - `cog install registry:module-name`

## 版本选择

| 版本 | 规范 | npm | PyPI | 状态 |
|------|------|-----|------|------|
| **v2.2** | v2.2 | `2.2.1` | `2.2.1` | ✅ 稳定版 (推荐) |
| **v2.5** | v2.5 | `2.5.0-beta.x` | `2.5.0bx` | 🧪 测试版 (流式 + 多模态) |

```bash
# 安装稳定版 v2.2
npm install cognitive-modules-cli@2.2.1
# 或安装别名包（同样提供 `cog` 命令）
npm install cogn@2.2.1
pip install cognitive-modules==2.2.1

# 安装测试版 v2.5 (流式 + 多模态)
npm install cognitive-modules-cli@beta
pip install cognitive-modules==2.5.0b1
```

## 安装

### Node.js (npm) - 推荐

```bash
# 零安装快速体验（推荐）
npx cogn@2.2.1 run code-reviewer --args "your code"

# 或使用完整包名
npx cognitive-modules-cli@2.2.1 run code-reviewer --args "your code"

# 全局安装
npm install -g cogn@2.2.1
# 或: npm install -g cognitive-modules-cli@2.2.1
```

> **说明**: `cogn` 是 `cognitive-modules-cli` 的别名包，两者提供相同的 `cog` 命令。

### Python (pip)

```bash
pip install cognitive-modules==2.2.1

# 带 LLM 支持
pip install "cognitive-modules[openai]==2.2.1"      # OpenAI
pip install "cognitive-modules[anthropic]==2.2.1"   # Claude
pip install "cognitive-modules[all]==2.2.1"         # 全部
```

| 平台 | 包名 | 命令 | 特性 |
|------|------|------|------|
| **npm** | `cognitive-modules-cli` | `cog` | ✅ 推荐，零安装，完整功能 |
| pip | `cognitive-modules` | `cog` | ✅ 完整功能 |

## 快速开始

```bash
# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 运行代码审查（npm）
npx cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 或使用全局安装的 cog 命令
cog run code-reviewer --args "..." --pretty

# 运行任务排序
cog run task-prioritizer --args "修复bug(紧急), 写文档, 优化性能" --pretty

# 运行 API 设计
cog run api-designer --args "用户系统 CRUD API" --pretty

# 启动 HTTP 服务（API 集成）
cog serve --port 8000

# 启动 MCP 服务（Claude Code / Cursor 集成）
cog mcp
```

## v2.2 响应格式

所有模块现在返回统一的 v2.2 envelope 格式：

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "简短摘要，用于快速路由决策（≤280字符）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理过程，用于审计和人工审核",
    "extensions": {
      "insights": [
        {
          "text": "额外洞察",
          "suggested_mapping": "建议添加到 schema 的字段"
        }
      ]
    }
  }
}
```

### Control vs Data Plane

| 层 | 字段 | 用途 |
|---|------|------|
| **Control Plane** | `meta.confidence` | 路由/降级决策 |
| **Control Plane** | `meta.risk` | 人工审核触发 |
| **Control Plane** | `meta.explain` | 日志/卡片 UI |
| **Data Plane** | `data.rationale` | 详细审计 |
| **Data Plane** | `data.extensions` | 可回收洞察 |

## 核心特性

| 特性 | 说明 |
|------|------|
| **JSON Schema 验证** | 输入输出双向校验 |
| **置信度** | 每个输出必须包含 0-1 的 confidence |
| **推理过程** | `meta.explain` (简短) + `data.rationale` (详细) |
| **模块分级** | `tier: exec \| decision \| exploration` |
| **风险聚合** | `meta.risk = max(changes[*].risk)` |
| **参数传递** | `$ARGUMENTS` 运行时替换 |
| **子代理** | `@call:module` 支持模块间调用 |
| **验证工具** | `cog validate` / `cog validate --v22` |

## 集成方式

| 方式 | 命令 | 适用场景 |
|------|------|----------|
| CLI | `cog run` | 命令行 |
| HTTP API | `cog serve` | n8n、Coze、Dify |
| MCP Server | `cog mcp` | Claude、Cursor |

## CLI 命令

```bash
# 模块管理
cog list                    # 列出已安装模块
cog info <module>           # 查看模块详情
cog validate <module>       # 验证模块结构
cog validate <module> --v22 # 验证 v2.2 格式

# 运行模块
cog run <module> input.json -o output.json --pretty
cog run <module> --args "需求描述" --pretty
cog run <module> --args "需求" --subagent  # 启用子代理

# 创建模块
cog init <name> -d "描述"
cog init <name> --format v22  # 创建 v2.2 格式模块

# 迁移模块
cog migrate <module>        # 将 v1/v2.1 模块迁移到 v2.2

# 从 GitHub 安装（推荐）
cog add ziel-io/cognitive-modules -m code-simplifier
cog add org/repo -m module-name --tag v1.0.0   # 安装指定版本
cog remove <module>                             # 删除模块

# 版本管理
cog update <module>                 # 更新到最新版本
cog update <module> --tag v2.0.0    # 更新到指定版本
cog versions <url>                  # 查看可用版本

# 其他安装方式
cog install github:user/repo/path
cog install registry:module-name
cog uninstall <module>

# 注册表
cog registry                # 查看公共模块
cog search <query>          # 搜索模块

# 环境检查
cog doctor
```

## 内置模块

| 模块 | Tier | 功能 | 示例 |
|------|------|------|------|
| `code-reviewer` | decision | 代码审查 | `cog run code-reviewer --args "你的代码"` |
| `code-simplifier` | decision | 代码简化 | `cog run code-simplifier --args "复杂代码"` |
| `task-prioritizer` | decision | 任务优先级排序 | `cog run task-prioritizer --args "任务1,任务2"` |
| `api-designer` | decision | REST API 设计 | `cog run api-designer --args "订单系统"` |
| `ui-spec-generator` | exploration | UI 规范生成 | `cog run ui-spec-generator --args "电商首页"` |
| `product-analyzer` | exploration | 产品分析（子代理） | `cog run product-analyzer --args "健康产品" -s` |

## 模块格式

### v2.2 格式（推荐）

```
my-module/
├── module.yaml     # 机器可读 manifest（含 tier/overflow/enums）
├── prompt.md       # 人类可读 prompt
├── schema.json     # meta + input + data + error schemas
└── tests/          # 黄金测试用例
    ├── case1.input.json
    └── case1.expected.json
```

### module.yaml (v2.2)

```yaml
name: my-module
version: 2.2.0
responsibility: 一句话描述

tier: decision           # exec | decision | exploration
schema_strictness: medium # high | medium | low

excludes:
  - 不做的事情

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
  strategy: extensible   # strict | extensible

failure:
  contract: error_union
  partial_allowed: true

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
```

### v1 格式（仍支持）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
└── examples/
    ├── input.json
    └── output.json
```

## Tier 说明

| Tier | 用途 | Schema 严格度 | Overflow |
|------|------|---------------|----------|
| `exec` | 自动执行（patch、指令生成） | high | 关闭 |
| `decision` | 判断/评估/分类 | medium | 开启 |
| `exploration` | 探索/调研/灵感 | low | 开启 |

## 在 AI 工具中使用

### Cursor / Codex CLI

在项目根目录创建 `AGENTS.md`：

```markdown
## 代码审查

当需要审查代码时：
1. 读取 `~/.cognitive/modules/code-reviewer/MODULE.md`
2. 按 schema.json 格式输出
3. 包含 meta.explain + data.rationale
```

### 直接对话

```
读取 ~/.cognitive/modules/code-reviewer/MODULE.md，
审查这段代码：def login(u,p): ...
```

## 配置 LLM

```bash
# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Anthropic Claude
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx

# MiniMax
export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx

# Ollama（本地）
export LLM_PROVIDER=ollama

# 检查配置
cog doctor
```

## 迁移到 v2.2

从 v1 或 v2.1 模块迁移到 v2.2：

```bash
# 自动迁移单个模块
cog migrate code-reviewer

# 迁移所有模块
cog migrate --all

# 验证迁移结果
cog validate code-reviewer --v22
```

手动迁移步骤：
1. 创建 `module.yaml`（添加 tier/overflow/enums）
2. 更新 `schema.json`（添加 meta schema）
3. 创建/更新 `prompt.md`（说明 v2.2 envelope 格式）
4. 保留 `MODULE.md`（向后兼容）

## 开发

```bash
# 克隆
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 创建新模块（v2.2 格式）
cog init my-module -d "模块描述" --format v22
cog validate my-module --v22
```

## 项目结构

```
cognitive-modules/
├── src/cognitive/          # Python CLI 源码
│   ├── cli.py              # 命令入口
│   ├── loader.py           # 模块加载（支持 v0/v1/v2.2）
│   ├── runner.py           # 模块执行（v2.2 envelope）
│   ├── validator.py        # 模块验证（含 v2.2 验证）
│   ├── migrate.py          # v2.2 迁移工具
│   ├── subagent.py         # 子代理编排
│   ├── registry.py         # 模块安装
│   ├── templates.py        # 模块模板
│   └── providers/          # LLM 后端
├── packages/
│   └── cli-node/           # Node.js CLI (npm: cognitive-modules-cli)
│       ├── src/            # TypeScript 源码
│       └── package.json
├── cognitive/modules/      # 内置模块（全部 v2.2）
├── coze-plugin/            # Coze 集成插件
├── tests/                  # 单元测试
├── SPEC.md                 # v0.1 规范（历史）
├── SPEC-v2.2.md            # v2.2 规范（最新）
├── INTEGRATION.md          # 集成指南
└── cognitive-registry.json # 公共注册表
```

## 多平台支持

| 平台 | 包名 | 命令 | 安装 |
|------|------|------|------|
| Python | `cognitive-modules` | `cog` | `pip install cognitive-modules` |
| Node.js | `cognitive-modules-cli` | `cog` | `npm install -g cognitive-modules-cli` |

两个版本共享相同的模块格式和 v2.2 规范。

## 文档

### 规范

| 文档 | 说明 |
|------|------|
| [SPEC-v2.2_zh.md](SPEC-v2.2_zh.md) | v2.2 完整规范（Control/Data 分离、Tier、Overflow） |
| [SPEC-v2.2.md](SPEC-v2.2.md) | v2.2 specification (English) |
| [SPEC.md](SPEC.md) | v0.1 规范（含上下文哲学） |

### 实现者指南

| 文档 | 说明 |
|------|------|
| [IMPLEMENTERS-GUIDE.md](IMPLEMENTERS-GUIDE.md) | 第三方运行时实现指南 |
| [CONFORMANCE.md](CONFORMANCE.md) | 合规等级（Level 1/2/3） |
| [ERROR-CODES.md](ERROR-CODES.md) | 标准错误码分类（E1xxx-E4xxx） |
| [templates/runtime-starter/](templates/runtime-starter/) | 新实现起步模板 |

### 高级功能

| 文档 | 说明 |
|------|------|
| [COMPOSITION.md](COMPOSITION.md) | 模块组合与数据流规范 |
| [CONTEXT-PROTOCOL.md](CONTEXT-PROTOCOL.md) | 有状态工作流的上下文协议 |

### Schema 与测试向量

| 资源 | 说明 |
|------|------|
| [spec/response-envelope.schema.json](spec/response-envelope.schema.json) | v2.2 信封验证 JSON Schema |
| [spec/module.yaml.schema.json](spec/module.yaml.schema.json) | module.yaml JSON Schema |
| [spec/test-vectors/](spec/test-vectors/) | 官方合规测试向量 |

### 注册表与分发

| 资源 | 说明 |
|------|------|
| [REGISTRY-PROTOCOL.md](REGISTRY-PROTOCOL.md) | 注册表协议规范 |
| [spec/registry-entry.schema.json](spec/registry-entry.schema.json) | 注册表条目 JSON Schema |
| [cognitive-registry.json](cognitive-registry.json) | 当前公共注册表 |
| [CERTIFICATION.md](CERTIFICATION.md) | 认证体系（徽章、验证流程） |

### 治理

| 文档 | 说明 |
|------|------|
| [GOVERNANCE.md](GOVERNANCE.md) | 项目治理结构 |
| [CMEP-PROCESS.md](CMEP-PROCESS.md) | 增强提案流程 |

### 集成

| 文档 | 说明 |
|------|------|
| [INTEGRATION.md](INTEGRATION.md) | Agent 工具集成指南 |
| [COGNITIVE-PROTOCOL.md](COGNITIVE-PROTOCOL.md) | 协议详情 |

## License

MIT
