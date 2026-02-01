# Cognitive Modules

[![CI](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml/badge.svg)](https://github.com/ziel-io/cognitive-modules/actions/workflows/ci.yml)
[![PyPI version](https://badge.fury.io/py/cognitive-modules.svg)](https://pypi.org/project/cognitive-modules/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 可验证的结构化 AI 任务规范

Cognitive Modules 是一种 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

## 特性

- **强类型契约** - JSON Schema 双向验证输入输出
- **可解释输出** - 强制输出 `confidence` + `rationale`
- **子代理编排** - `@call:module` 支持模块间调用
- **参数传递** - `$ARGUMENTS` 运行时替换
- **多 LLM 支持** - OpenAI / Anthropic / MiniMax / Ollama
- **公共注册表** - `cog install registry:module-name`

## 安装

```bash
# 基础安装
pip install cognitive-modules

# 带 LLM 支持
pip install cognitive-modules[openai]      # OpenAI
pip install cognitive-modules[anthropic]   # Claude
pip install cognitive-modules[all]         # 全部
```

## 快速开始

```bash
# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 或使用 MiniMax
export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx

# 运行代码审查
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 运行任务排序
cog run task-prioritizer --args "修复bug(紧急), 写文档, 优化性能" --pretty

# 运行 API 设计
cog run api-designer --args "用户系统 CRUD API" --pretty
```

## 与 Skills 对比

| | Skills | Cognitive Modules |
|---|--------|------------------|
| 定位 | 轻量指令扩展 | 可验证的结构化任务 |
| 输入校验 | ❌ | ✅ JSON Schema |
| 输出校验 | ❌ | ✅ JSON Schema |
| 置信度 | ❌ | ✅ 必须 0-1 |
| 推理过程 | ❌ | ✅ 必须 rationale |
| 参数传递 | ✅ $ARGUMENTS | ✅ $ARGUMENTS |
| 子代理 | ✅ context: fork | ✅ @call + context |
| 验证工具 | ❌ | ✅ cog validate |
| 注册表 | ❌ | ✅ cog install |

## CLI 命令

```bash
# 模块管理
cog list                    # 列出已安装模块
cog info <module>           # 查看模块详情
cog validate <module>       # 验证模块结构

# 运行模块
cog run <module> input.json -o output.json --pretty
cog run <module> --args "需求描述" --pretty
cog run <module> --args "需求" --subagent  # 启用子代理

# 创建模块
cog init <name> -d "描述"

# 安装/卸载
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

| 模块 | 功能 | 示例 |
|------|------|------|
| `code-reviewer` | 代码审查 | `cog run code-reviewer --args "你的代码"` |
| `task-prioritizer` | 任务优先级排序 | `cog run task-prioritizer --args "任务1,任务2"` |
| `api-designer` | REST API 设计 | `cog run api-designer --args "订单系统"` |
| `ui-spec-generator` | UI 规范生成 | `cog run ui-spec-generator --args "电商首页"` |
| `product-analyzer` | 产品分析（子代理示例） | `cog run product-analyzer --args "健康产品" -s` |

## 模块格式

### 新格式（推荐）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
└── examples/
    ├── input.json
    └── output.json
```

### MODULE.md

```yaml
---
name: my-module
version: 1.0.0
responsibility: 一句话描述

excludes:
  - 不做的事情

constraints:
  no_network: true
  no_inventing_data: true
  require_confidence: true
  require_rationale: true

context: fork  # 可选：隔离执行
---

# 指令

根据用户需求 $ARGUMENTS 执行任务。

可以调用其他模块：
@call:other-module($ARGUMENTS)
```

## 在 AI 工具中使用

### Cursor / Codex CLI

在项目根目录创建 `AGENTS.md`：

```markdown
## 代码审查

当需要审查代码时：
1. 读取 `~/.cognitive/modules/code-reviewer/MODULE.md`
2. 按 schema.json 格式输出
3. 包含 issues、summary、rationale、confidence
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

## 开发

```bash
# 克隆
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 创建新模块
cog init my-module -d "模块描述"
cog validate my-module
```

## 项目结构

```
cognitive-modules/
├── src/cognitive/          # CLI 源码
│   ├── cli.py              # 命令入口
│   ├── loader.py           # 模块加载
│   ├── runner.py           # 模块执行
│   ├── subagent.py         # 子代理编排
│   ├── validator.py        # 模块验证
│   ├── registry.py         # 模块安装
│   ├── templates.py        # 模块模板
│   └── providers/          # LLM 后端
├── cognitive/modules/      # 内置模块
├── tests/                  # 单元测试
├── SPEC.md                 # 规范文档
├── INTEGRATION.md          # 集成指南
└── cognitive-registry.json # 公共注册表
```

## 文档

- [SPEC.md](SPEC.md) - 完整规范（含上下文哲学）
- [INTEGRATION.md](INTEGRATION.md) - Agent 工具集成指南

## License

MIT
