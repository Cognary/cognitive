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

```bash
# 克隆
git clone https://github.com/leizii/cognitive-modules.git
cd cognitive-modules

# 安装依赖
pip install typer rich jsonschema pyyaml

# 运行
./cog --help
```

## CLI 命令

```bash
# 模块管理
cog list                    # 列出已安装模块
cog info <module>           # 查看模块详情
cog validate <module>       # 验证模块结构

# 创建模块
cog init <name> -d "描述"    # 从模板创建新模块

# 运行模块
cog run <module> input.json -o output.json --pretty

# 安装/卸载
cog install <source>        # 从 git/本地/注册表安装
cog uninstall <module>      # 卸载模块

# 注册表
cog registry                # 查看公共模块
cog search <query>          # 搜索模块

# 环境检查
cog doctor                  # 检查 LLM 配置
```

## 安装来源

```bash
# 从本地安装
cog install ./path/to/module

# 从 GitHub 安装
cog install github:leizii/cognitive-modules/cognitive/modules/ui-spec-generator

# 从注册表安装
cog install registry:ui-spec-generator
```

## 模块格式

### 新格式（推荐，2 文件）

```
my-module/
├── MODULE.md       # 元数据 + 指令
├── schema.json     # 输入输出 Schema
└── examples/       # 可选
    ├── input.json
    └── output.json
```

### 旧格式（兼容，6 文件）

```
my-module/
├── module.md
├── input.schema.json
├── output.schema.json
├── constraints.yaml
├── prompt.txt
└── examples/
```

## MODULE.md 格式

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
---

# 指令内容

（这里写 prompt）
```

## 在 Codex / Cursor 中使用

### 方式 1：直接对话（零配置）

```
读取 ~/.cognitive/modules/ui-spec-generator/MODULE.md，
为电商首页生成 UI 规范，保存到 ui-spec.json
```

### 方式 2：AGENTS.md（项目约定）

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

## 配置 LLM（仅 CLI 需要）

```bash
# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Anthropic Claude
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx

# Ollama（本地免费）
export LLM_PROVIDER=ollama

# 不配置则使用 stub（返回示例输出）
```

## 模块搜索路径

模块按以下顺序查找：

1. `./cognitive/modules/` - 项目本地
2. `~/.cognitive/modules/` - 用户全局
3. `$COGNITIVE_MODULES_PATH` - 自定义路径

## 创建新模块

```bash
# 1. 创建骨架
cog init my-module -d "模块职责描述"

# 2. 编辑 MODULE.md 添加指令
# 3. 编辑 schema.json 定义输入输出
# 4. 验证
cog validate my-module

# 5. 全局安装（可选）
cog install ./cognitive/modules/my-module
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

```bash
cog run ui-spec-generator examples/input.json -o ui-spec.json --pretty
```

## 项目结构

```
cognitive-modules/
├── README.md               # 本文件
├── SPEC.md                 # 规范文档
├── INTEGRATION.md          # Agent 集成指南
├── AGENTS.md               # Agent 约定示例
├── cognitive-registry.json # 公共模块注册表
├── src/cognitive/          # CLI 源码
│   ├── cli.py              # 命令入口
│   ├── loader.py           # 模块加载（支持新旧格式）
│   ├── runner.py           # 模块执行
│   ├── validator.py        # 模块验证
│   ├── registry.py         # 模块发现与安装
│   ├── templates.py        # 模块模板
│   └── providers/          # LLM 后端
├── cognitive/modules/      # 内置模块
│   └── ui-spec-generator/
└── pyproject.toml
```

## 文档

- [SPEC.md](SPEC.md) - 完整规范文档
- [INTEGRATION.md](INTEGRATION.md) - Agent 工具集成指南
- [AGENTS.md](AGENTS.md) - Agent 约定示例

## License

MIT
