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
- **公共注册表** - `cogn install registry:module-name`

## 安装

### Python (pip)

```bash
pip install cognitive-modules

# 带 LLM 支持
pip install cognitive-modules[openai]      # OpenAI
pip install cognitive-modules[anthropic]   # Claude
pip install cognitive-modules[all]         # 全部
```

### Node.js (npm)

```bash
# 全局安装
npm install -g cognitive-modules-cli

# 或 npx 零安装使用
npx cognitive-modules-cli --help
```

| 平台 | 包名 | 命令 |
|------|------|------|
| pip | `cognitive-modules` | `cogn` |
| npm | `cognitive-modules-cli` | `cog` |

## 快速开始

```bash
# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 或使用 MiniMax
export LLM_PROVIDER=minimax
export MINIMAX_API_KEY=sk-xxx

# 运行代码审查
cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 运行任务排序
cogn run task-prioritizer --args "修复bug(紧急), 写文档, 优化性能" --pretty

# 运行 API 设计
cogn run api-designer --args "用户系统 CRUD API" --pretty
```

## 核心特性

| 特性 | 说明 |
|------|------|
| **JSON Schema 验证** | 输入输出双向校验 |
| **置信度** | 每个输出必须包含 0-1 的 confidence |
| **推理过程** | 强制输出 rationale，可审计 |
| **参数传递** | `$ARGUMENTS` 运行时替换 |
| **子代理** | `@call:module` 支持模块间调用 |
| **验证工具** | `cogn validate` 检查模块结构 |
| **版本管理** | `cogn add/update/remove` 管理模块 |

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

# 运行模块
cogn run <module> input.json -o output.json --pretty
cogn run <module> --args "需求描述" --pretty
cogn run <module> --args "需求" --subagent  # 启用子代理

# 创建模块
cogn init <name> -d "描述"

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

| 模块 | 功能 | 示例 |
|------|------|------|
| `code-reviewer` | 代码审查 | `cogn run code-reviewer --args "你的代码"` |
| `code-simplifier` | 代码简化 | `cogn run code-simplifier --args "复杂代码"` |
| `task-prioritizer` | 任务优先级排序 | `cogn run task-prioritizer --args "任务1,任务2"` |
| `api-designer` | REST API 设计 | `cogn run api-designer --args "订单系统"` |
| `ui-spec-generator` | UI 规范生成 | `cogn run ui-spec-generator --args "电商首页"` |
| `product-analyzer` | 产品分析（子代理示例） | `cogn run product-analyzer --args "健康产品" -s` |

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
cogn doctor
```

## 创建新模块（完整流程）

以 `code-simplifier` 为例：

### Step 1: 创建目录结构

```bash
mkdir -p cognitive/modules/code-simplifier
```

### Step 2: 编写 MODULE.md

```bash
cat > cognitive/modules/code-simplifier/MODULE.md << 'EOF'
---
name: code-simplifier
version: 1.0.0
responsibility: Simplify complex code while preserving functionality

excludes:
  - Changing the code's behavior
  - Adding new features
  - Removing functionality

constraints:
  no_network: true
  no_side_effects: true
  require_confidence: true
  require_rationale: true
---

# Code Simplifier Module

You are an expert at refactoring and simplifying code.

## Input

Code to simplify: $ARGUMENTS

## Simplification Strategies

1. **Remove redundancy** - Eliminate duplicate code
2. **Improve naming** - Use clear, descriptive names
3. **Reduce nesting** - Flatten deep conditionals
4. **Simplify logic** - Use built-in functions

## Output Requirements

Return JSON containing:
- `simplified_code`: The simplified version
- `changes`: List of changes made
- `summary`: Brief description
- `rationale`: Explanation of decisions
- `confidence`: Confidence score [0-1]
EOF
```

### Step 3: 编写 schema.json

```bash
cat > cognitive/modules/code-simplifier/schema.json << 'EOF'
{
  "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
  "input": {
    "type": "object",
    "properties": {
      "code": { "type": "string" },
      "language": { "type": "string" },
      "$ARGUMENTS": { "type": "string" }
    }
  },
  "output": {
    "type": "object",
    "required": ["simplified_code", "changes", "summary", "rationale", "confidence"],
    "properties": {
      "simplified_code": { "type": "string" },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string" },
            "description": { "type": "string" }
          }
        }
      },
      "summary": { "type": "string" },
      "rationale": { "type": "string" },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  }
}
EOF
```

### Step 4: 验证模块

```bash
cogn validate code-simplifier
cogn list  # 确认模块出现在列表中
```

### Step 5: 测试运行

```bash
cogn run code-simplifier --args "def calc(x): if x > 0: if x < 10: return x * 2 else: return x else: return 0" --pretty
```

### Step 6: 添加示例（可选）

```bash
mkdir -p cognitive/modules/code-simplifier/examples
# 添加 input.json 和 output.json 作为测试用例
```

### 模块设计要点

| 要素 | 必须 | 说明 |
|------|------|------|
| `name` | ✅ | 唯一标识符，kebab-case |
| `version` | ✅ | 语义化版本 |
| `responsibility` | ✅ | 一句话描述职责 |
| `excludes` | ✅ | 明确列出不做的事 |
| `$ARGUMENTS` | ✅ | 支持命令行参数 |
| `confidence` | ✅ | 输出必须包含 0-1 置信度 |
| `rationale` | ✅ | 输出必须包含推理过程 |
| `schema.json` | ✅ | 定义输入输出契约 |

## 开发

```bash
# 克隆
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 创建新模块（使用模板）
cogn init my-module -d "模块描述"
cogn validate my-module
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
