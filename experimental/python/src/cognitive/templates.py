"""
Module Templates - Generate skeleton for new cognitive modules.
"""

import json
from pathlib import Path

MODULE_MD_TEMPLATE = '''---
name: {name}
version: 1.0.0
responsibility: {responsibility}

excludes:
  - 编造未提供的数据
  - 访问外部网络
  - 产生副作用

constraints:
  no_network: true
  no_side_effects: true
  no_inventing_data: true
  require_confidence: true
  require_rationale: true

invocation:
  user_invocable: true
  agent_invocable: true
---

# {name}

你是一个 {name} 模块。{responsibility}

## 输入

用户会提供：
- （描述期望的输入）

## 处理流程

1. 分析输入
2. 执行主要逻辑
3. 生成结构化输出

## 输出要求

输出 JSON 包含：
- `result`: 主要结果
- `rationale`: 决策说明
- `confidence`: 置信度 0-1

## 约束

- 不编造未提供的信息（标记为 unknown）
- 不访问外部资源
- 诚实报告置信度
'''

EXAMPLE_INPUT = {
    "query": "示例输入",
    "context": {}
}

EXAMPLE_OUTPUT = {
    "result": {
        "summary": "示例输出结果"
    },
    "rationale": {
        "decisions": [
            {
                "aspect": "示例决策",
                "decision": "做了什么",
                "reasoning": "为什么这样做"
            }
        ],
        "assumptions": [],
        "open_questions": []
    },
    "confidence": 0.8
}


def get_schema_template(name: str) -> dict:
    """Generate schema template as dict."""
    return {
        "$schema": "https://ziel-io.github.io/cognitive-modules/schema/v1.json",
        "$id": name,
        "title": f"{name.replace('-', ' ').title()} Schema",
        "input": {
            "type": "object",
            "required": ["query"],
            "additionalProperties": False,
            "properties": {
                "query": {
                    "type": "string",
                    "description": "用户输入"
                },
                "context": {
                    "type": "object",
                    "description": "可选上下文"
                }
            }
        },
        "output": {
            "type": "object",
            "required": ["result", "rationale", "confidence"],
            "additionalProperties": False,
            "properties": {
                "result": {
                    "type": "object",
                    "description": "主要输出结果"
                },
                "rationale": {
                    "type": "object",
                    "required": ["decisions"],
                    "properties": {
                        "decisions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["aspect", "decision", "reasoning"]
                            }
                        },
                        "assumptions": {"type": "array"},
                        "open_questions": {"type": "array"}
                    }
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                }
            }
        }
    }


def create_module(
    name: str,
    target_dir: Path,
    responsibility: str = "（描述模块职责）",
    with_examples: bool = True,
) -> Path:
    """
    Create a new cognitive module from template.
    
    Args:
        name: Module name (lowercase, hyphenated)
        target_dir: Directory to create module in
        responsibility: One-line description
        with_examples: Whether to create examples directory
    
    Returns:
        Path to created module directory
    """
    module_path = target_dir / name
    module_path.mkdir(parents=True, exist_ok=True)
    
    # Create MODULE.md
    module_md = MODULE_MD_TEMPLATE.format(
        name=name,
        responsibility=responsibility,
    )
    (module_path / "MODULE.md").write_text(module_md, encoding='utf-8')
    
    # Create schema.json
    schema = get_schema_template(name)
    (module_path / "schema.json").write_text(
        json.dumps(schema, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )
    
    # Create examples
    if with_examples:
        examples_path = module_path / "examples"
        examples_path.mkdir(exist_ok=True)
        (examples_path / "input.json").write_text(
            json.dumps(EXAMPLE_INPUT, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
        (examples_path / "output.json").write_text(
            json.dumps(EXAMPLE_OUTPUT, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
    
    return module_path
