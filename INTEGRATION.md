# Cognitive Modules 集成指南

本文档指导 AI Agent 工具（如 Cursor、Claude Code 等）如何集成 Cognitive Modules。

---

## 集成方式

| 方式 | 适用场景 | 文档 |
|------|----------|------|
| **MCP Server** | Claude Desktop、Cursor 等 AI 工具 | [MCP 文档](docs/integration/mcp.md) |
| **HTTP API** | n8n、Coze、Dify 等工作流平台 | [API 文档](docs/integration/http-api.md) |
| **CLI** | 命令行、脚本 | `cogn run` |
| **Python API** | 程序化集成 | `from cognitive.runner import run_module` |

---

## MCP Server（推荐）

MCP 是 Anthropic 提出的标准协议，Claude Desktop 和 Cursor 原生支持。

### 安装

```bash
pip install cognitive-modules[mcp]
```

### 启动

```bash
cogn mcp
```

### 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "cognitive": {
      "command": "cogn",
      "args": ["mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### 暴露的工具

| Tool | 说明 |
|------|------|
| `cognitive_run(module, args)` | 运行模块 |
| `cognitive_list()` | 列出所有模块 |
| `cognitive_info(module)` | 获取模块详情 |

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
        if (module_path / "module.yaml").exists():  # v2 format
            return module_path
    
    return None
```

---

## 模块格式

### v2 格式（推荐）

```
module-name/
├── module.yaml    # 元数据
├── prompt.md      # 执行指令
├── schema.json    # 输入输出 Schema
└── tests/         # 测试用例
```

### v1 格式

```
module-name/
├── MODULE.md      # 元数据 + 指令（YAML frontmatter）
└── schema.json    # Schema
```

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
    assert 'rationale' in output
    
    return True
```

---

## 约束执行

模块可以声明以下约束：

| 约束 | 含义 |
|------|------|
| `no_network` | 禁止访问外部网络 |
| `no_side_effects` | 禁止产生副作用 |
| `require_confidence` | 输出必须包含置信度 |
| `require_rationale` | 输出必须包含推理过程 |

---

## 编程集成

### Python

```python
from cognitive.loader import load_module
from cognitive.runner import run_module

# 执行模块
result = run_module("code-reviewer", args="your code here")
print(result)
```

### HTTP API

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"module": "code-reviewer", "args": "your code"}'
```

---

## 参考实现

- Python CLI: `src/cognitive/`
- MCP Server: `src/cognitive/mcp_server.py`
- HTTP API: `src/cognitive/server.py`

---

## 联系

- GitHub: https://github.com/ziel-io/cognitive-modules
- 规范文档: SPEC.md
