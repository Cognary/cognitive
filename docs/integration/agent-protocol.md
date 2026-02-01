# Agent 集成协议

本文档定义 AI Agent 如何发现、加载和执行 Cognitive Modules。

## 模块发现

### 搜索路径

按以下顺序查找模块：

1. `./cognitive/modules/` - 项目本地
2. `~/.cognitive/modules/` - 用户全局
3. `/usr/local/share/cognitive/modules/` - 系统级
4. `$COGNITIVE_MODULES_PATH` - 自定义路径

### 模块识别

目录包含以下文件之一即为模块：

- `MODULE.md`（新格式）
- `module.md`（旧格式）

## 模块加载

### 新格式

```python
def load_module(path):
    # 1. 读取 MODULE.md
    with open(path / "MODULE.md") as f:
        content = f.read()
    
    # 2. 解析 YAML frontmatter
    metadata, prompt = parse_frontmatter(content)
    
    # 3. 读取 schema.json
    with open(path / "schema.json") as f:
        schema = json.load(f)
    
    return {
        "name": metadata["name"],
        "metadata": metadata,
        "prompt": prompt,
        "input_schema": schema.get("input", {}),
        "output_schema": schema.get("output", {}),
        "constraints": metadata.get("constraints", {}),
    }
```

## 执行协议

### 1. 加载模块

```python
module = load_module("code-reviewer")
```

### 2. 准备输入

```python
input_data = {"code": "...", "language": "python"}
# 或
input_data = {"$ARGUMENTS": "用户输入文本"}
```

### 3. 验证输入（可选）

```python
jsonschema.validate(input_data, module["input_schema"])
```

### 4. 构建 Prompt

```python
full_prompt = f"""
{module["prompt"]}

## Constraints
{yaml.dump(module["constraints"])}

## Input
```json
{json.dumps(input_data)}
```

## Instructions
Return ONLY valid JSON matching the output schema.
"""
```

### 5. 调用 LLM

使用 Agent 自己的 LLM：

```python
response = agent_llm.generate(full_prompt)
```

### 6. 解析输出

```python
output = json.loads(response)
```

### 7. 验证输出（可选）

```python
jsonschema.validate(output, module["output_schema"])
```

## 约束执行

模块可能声明以下约束：

| 约束 | 含义 | Agent 责任 |
|------|------|-----------|
| `no_network` | 禁止网络访问 | 不提供网络工具 |
| `no_side_effects` | 禁止副作用 | 只允许读操作 |
| `no_inventing_data` | 禁止编造 | 对未知标记 "unknown" |
| `require_confidence` | 必须输出置信度 | 验证输出 |
| `require_rationale` | 必须输出推理 | 验证输出 |

## 调用控制

```yaml
invocation:
  user_invocable: true   # 用户可直接调用
  agent_invocable: true  # Agent 可自动调用
```

- `user_invocable: false` - Agent 不应在用户界面暴露此模块
- `agent_invocable: false` - Agent 不应自动选择此模块

## 示例：Cursor 集成

```python
class CursorAgent:
    def handle_request(self, user_input):
        # 1. 检测是否需要使用模块
        if "审查代码" in user_input:
            module = load_module("code-reviewer")
            
            # 2. 准备输入
            code = extract_code(user_input)
            input_data = {"code": code}
            
            # 3. 构建 prompt
            prompt = build_prompt(module, input_data)
            
            # 4. 调用自己的 LLM
            response = self.llm.generate(prompt)
            
            # 5. 返回结构化结果
            return json.loads(response)
```
