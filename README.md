# Cognitive Modules

> 可验证的结构化 AI 任务规范

Cognitive Modules 是一种 AI 任务定义规范，专为需要**强约束、可验证、可审计**的生成任务设计。

## 与 Skills 的区别

| | Skills | Cognitive Modules |
|---|--------|------------------|
| 定位 | 轻量指令扩展 | 可验证的结构化任务 |
| 输入校验 | 无 | JSON Schema |
| 输出校验 | 无 | JSON Schema |
| 置信度 | 无 | 必须 0-1 |
| 推理过程 | 无 | 必须 rationale |
| 适用场景 | 快捷命令 | 规范生成、设计文档 |

## 快速开始

### 安装

```bash
git clone https://github.com/YOUR_USERNAME/cognitive-modules.git
cd cognitive-modules
pip install -e .
```

### 使用 CLI

```bash
# 列出模块
cog list

# 运行模块
cog run ui-spec-generator input.json -o output.json

# 验证模块
cog validate ui-spec-generator

# 安装模块
cog install github:org/repo/path/to/module
```

### 在 Codex/Cursor 中使用

无需 CLI，直接告诉 AI：

```
读取 ~/.cognitive/modules/ui-spec-generator/MODULE.md 作为指令，
为一个健康产品官网生成 UI 规范
```

或在项目中添加 `AGENTS.md`，参见 [Agent 集成](#agent-集成)。

## 模块结构

### 最小结构（2 文件）

```
my-module/
├── MODULE.md       # 元数据 + 指令
└── schema.json     # 输入输出 Schema
```

### MODULE.md 格式

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
---

# 指令内容

（prompt 写在这里）
```

## 内置模块

### ui-spec-generator

将产品需求转换为前端可实现的 UI 规范。

**输出包含**：
- 信息架构（sections + hierarchy）
- 组件定义（type, props, states）
- 交互设计（events, transitions）
- 响应式规则（breakpoints, layout）
- 可访问性（WCAG 要求）
- 验收标准（可测试条件）
- 置信度 + 推理过程

## Agent 集成

### 方式 1：直接对话

```
读取 ~/.cognitive/modules/ui-spec-generator/MODULE.md，
为电商首页生成 UI 规范
```

### 方式 2：AGENTS.md

在项目根目录创建 `AGENTS.md`：

```markdown
## UI 规范生成

当需要生成 UI 规范时：
1. 读取 `~/.cognitive/modules/ui-spec-generator/MODULE.md`
2. 按 schema.json 格式输出
3. 保存到 ui-spec.json
```

### 方式 3：包装成 Skill

```yaml
# ~/.claude/skills/ui-spec/SKILL.md
---
name: ui-spec
description: 生成 UI 规范
---
执行 ~/.cognitive/modules/ui-spec-generator/MODULE.md
```

## 规范文档

详见 [SPEC.md](SPEC.md)

## 配置 LLM（仅 CLI 需要）

```bash
# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Anthropic
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx

# Ollama (本地)
export LLM_PROVIDER=ollama
```

## 项目结构

```
cognitive-modules/
├── SPEC.md                    # 规范文档
├── AGENTS.md                  # Agent 集成示例
├── src/cognitive/             # CLI 源码
├── cognitive/modules/         # 内置模块
│   └── ui-spec-generator/
└── pyproject.toml
```

## 创建新模块

```bash
mkdir -p cognitive/modules/my-module

# 创建 MODULE.md 和 schema.json
# 参考 ui-spec-generator 示例

cog validate my-module
```

## License

MIT
