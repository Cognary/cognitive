# Cognitive Modules

[![CI](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml/badge.svg)](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml)
[![PyPI version](https://badge.fury.io/py/cognitive-modules.svg)](https://pypi.org/project/cognitive-modules/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 可验证的结构化 AI 任务规范

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
- **公共注册表** - `cogn install registry:module-name`

## 安装

### Node.js (npm) - 推荐

```bash
# 零安装快速体验（推荐）
npx cogn run code-reviewer --args "your code"

# 全局安装
npm install -g cogn

# 或安装完整包名
npm install -g cognitive-modules-cli
```

### Python (pip)

```bash
pip install cognitive-modules

# 带 LLM 支持
pip install cognitive-modules[openai]      # OpenAI
pip install cognitive-modules[anthropic]   # Claude
pip install cognitive-modules[all]         # 全部
```

| 平台 | 包名 | 命令 | 特性 |
|------|------|------|------|
| **npm** | `cogn` | `cog` | ✅ 推荐，零安装，完整功能 |
| pip | `cognitive-modules` | `cogn` | ✅ 完整功能 |

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
| **验证工具** | `cogn validate` / `cogn validate --v22` |

## 集成方式

| 方式 | 命令 | 适用场景 |
|------|------|----------|
| CLI | `cogn run` | 命令行 |
| HTTP API | `cogn serve` | n8n、Coze、Dify |
| MCP Server | `cogn mcp` | Claude、Cursor |

## CLI 命令

```bash
# 模块管理
cogn list                    # 列出已安装模块
cogn info <module>           # 查看模块详情
cogn validate <module>       # 验证模块结构
cogn validate <module> --v22 # 验证 v2.2 格式

# 运行模块
cogn run <module> input.json -o output.json --pretty
cogn run <module> --args "需求描述" --pretty
cogn run <module> --args "需求" --subagent  # 启用子代理

# 创建模块
cogn init <name> -d "描述"
cogn init <name> --format v22  # 创建 v2.2 格式模块

# 迁移模块
cogn migrate <module>        # 将 v1/v2.1 模块迁移到 v2.2

# 从 GitHub 安装（推荐）
cogn add ziel-io/cognitive-modules -m code-simplifier
cogn add org/repo -m module-name --tag v1.0.0   # 安装指定版本
cogn remove <module>                             # 删除模块

# 版本管理
cogn update <module>                 # 更新到最新版本
cogn update <module> --tag v2.0.0    # 更新到指定版本
cogn versions <url>                  # 查看可用版本

# 其他安装方式
cogn install github:user/repo/path
cogn install registry:module-name
cogn uninstall <module>

# 注册表
cogn registry                # 查看公共模块
cogn search <query>          # 搜索模块

# 环境检查
cogn doctor
```

## 内置模块

| 模块 | Tier | 功能 | 示例 |
|------|------|------|------|
| `code-reviewer` | decision | 代码审查 | `cogn run code-reviewer --args "你的代码"` |
| `code-simplifier` | decision | 代码简化 | `cogn run code-simplifier --args "复杂代码"` |
| `task-prioritizer` | decision | 任务优先级排序 | `cogn run task-prioritizer --args "任务1,任务2"` |
| `api-designer` | decision | REST API 设计 | `cogn run api-designer --args "订单系统"` |
| `ui-spec-generator` | exploration | UI 规范生成 | `cogn run ui-spec-generator --args "电商首页"` |
| `product-analyzer` | exploration | 产品分析（子代理） | `cogn run product-analyzer --args "健康产品" -s` |

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
cogn doctor
```

## 迁移到 v2.2

从 v1 或 v2.1 模块迁移到 v2.2：

```bash
# 自动迁移单个模块
cogn migrate code-reviewer

# 迁移所有模块
cogn migrate --all

# 验证迁移结果
cogn validate code-reviewer --v22
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
cogn init my-module -d "模块描述" --format v22
cogn validate my-module --v22
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
| Python | `cognitive-modules` | `cogn` | `pip install cognitive-modules` |
| Node.js | `cogn` 或 `cognitive-modules-cli` | `cog` | `npm install -g cogn` 或 `npx cogn` |

两个版本共享相同的模块格式和 v2.2 规范。

## 文档

- [SPEC-v2.2.md](SPEC-v2.2.md) - v2.2 完整规范（Control/Data 分离、Tier、Overflow）
- [SPEC.md](SPEC.md) - v0.1 规范（含上下文哲学）
- [INTEGRATION.md](INTEGRATION.md) - Agent 工具集成指南

## License

MIT
