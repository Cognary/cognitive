# Cognitive Modules 集成指南

本文档指导 AI Agent 工具（如 Cursor、Codex CLI、Claude Code 等）如何集成 Cognitive Modules。

---

## 概述

Cognitive Modules 是一种结构化的 AI 任务规范，包含：

- **MODULE.md**: 元数据 + 执行指令
- **schema.json**: 输入输出 JSON Schema
- **examples/**: 示例数据

Agent 工具可以读取这些文件，用自己的 LLM 执行，无需调用外部 API。

---

## 模块发现

### 标准路径

```
./cognitive/modules/           # 项目本地
~/.cognitive/modules/          # 用户全局
/usr/local/share/cognitive/modules/  # 系统级
```

### 发现算法

```python
def find_module(name: str) -> Path | None:
    search_paths = [
        Path.cwd() / "cognitive" / "modules",
        Path.home() / ".cognitive" / "modules",
    ]
    
    for base in search_paths:
        module_path = base / name
        if (module_path / "MODULE.md").exists():
            return module_path
        if (module_path / "module.md").exists():
            return module_path
    
    return None
```

---

## 模块加载

### 新格式 (MODULE.md)

```yaml
# MODULE.md
---
name: my-module
version: 1.0.0
responsibility: 一句话描述
excludes:
  - 不做的事情
constraints:
  no_network: true
  require_confidence: true
---

# 指令内容

（这里是 prompt）
```

**解析步骤**：

1. 读取 MODULE.md
2. 解析 YAML frontmatter（`---` 之间的内容）
3. 提取 markdown body 作为 prompt
4. 读取 schema.json（如存在）

### 旧格式（6 文件）

- `module.md` → 元数据
- `prompt.txt` → 指令
- `input.schema.json` → 输入 Schema
- `output.schema.json` → 输出 Schema
- `constraints.yaml` → 约束
- `examples/` → 示例

---

## 执行协议

### 1. 构建 Prompt

```python
def build_prompt(module: dict, user_input: dict) -> str:
    return f"""
{module['prompt']}

## 约束
{yaml.dump(module['constraints'])}

## 输入
```json
{json.dumps(user_input, indent=2)}
```

## 指令
按照上述要求生成输出，返回纯 JSON。
"""
```

### 2. 执行

使用 Agent 自己的 LLM 执行构建好的 prompt。

### 3. 校验输出

```python
def validate_output(output: dict, schema: dict) -> bool:
    # 1. JSON Schema 校验
    jsonschema.validate(output, schema)
    
    # 2. 必须包含 confidence
    assert 0 <= output['confidence'] <= 1
    
    # 3. 必须包含 rationale
    assert 'decisions' in output['rationale']
    
    return True
```

---

## 约束执行

模块可以声明以下约束：

| 约束 | 含义 |
|------|------|
| `no_network` | 禁止访问外部网络 |
| `no_side_effects` | 禁止产生副作用（写文件、发请求） |
| `no_inventing_data` | 禁止编造数据，缺失信息标记为 unknown |
| `require_confidence` | 输出必须包含置信度 |
| `require_rationale` | 输出必须包含推理过程 |

Agent 应该：

1. 在 system prompt 中强调这些约束
2. 校验输出是否符合约束（如 confidence 范围）

---

## 调用控制

```yaml
invocation:
  user_invocable: true    # 用户可直接调用
  agent_invocable: true   # Agent 可自动调用
```

- `user_invocable: false` → 隐藏，仅供其他模块引用
- `agent_invocable: false` → Agent 不应自动触发

---

## 示例集成

### Cursor / Claude Code

创建 Skill 包装：

```yaml
# ~/.claude/skills/cognitive/SKILL.md
---
name: cognitive
description: 执行 Cognitive Module
---

当用户要求执行 Cognitive Module 时：

1. 找到模块：`~/.cognitive/modules/{name}/`
2. 读取 MODULE.md 获取指令
3. 读取 schema.json 获取格式
4. 执行并输出 JSON
```

### AGENTS.md 约定

```markdown
# AGENTS.md

## Cognitive Modules

当需要执行 Cognitive Module 时：

1. 在 `~/.cognitive/modules/` 或 `./cognitive/modules/` 查找
2. 读取 MODULE.md 作为指令
3. 按 schema.json 格式输出
4. 保存到指定文件
```

### 编程集成

```python
from cognitive.loader import load_module
from cognitive.runner import run_module

# 加载模块
module = load_module(Path("~/.cognitive/modules/ui-spec-generator"))

# 执行
result = run_module("ui-spec-generator", input_data)
```

---

## 注册表

公共模块索引在 `cognitive-registry.json`：

```json
{
  "modules": {
    "ui-spec-generator": {
      "description": "...",
      "source": "github:leizii/cognitive-modules/cognitive/modules/ui-spec-generator"
    }
  }
}
```

### 安装公共模块

```bash
cog install registry:ui-spec-generator
# 或
cog install github:leizii/cognitive-modules/cognitive/modules/ui-spec-generator
```

---

## 最佳实践

1. **优先读取本地模块**：项目级 > 用户级 > 系统级
2. **缓存加载结果**：模块内容不常变化
3. **尊重约束**：在 prompt 中明确约束
4. **校验输出**：执行 JSON Schema 校验
5. **显示置信度**：低置信度时提醒用户

---

## 参考实现

- Python CLI: `src/cognitive/`
- 加载器: `loader.py`
- 运行器: `runner.py`
- 验证器: `validator.py`

---

## 联系

- GitHub: https://github.com/leizii/cognitive-modules
- 规范文档: SPEC.md
