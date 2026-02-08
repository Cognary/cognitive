"""
Cognitive Modules MCP Server

提供 MCP (Model Context Protocol) 接口，让 Claude Code、Cursor 等工具可以使用 Cognitive Modules。

启动方式:
    cogn mcp
    
或直接运行:
    python -m cognitive.mcp_server
"""

from typing import Optional, Any
import json
import os

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    raise ImportError(
        "MCP dependencies not installed. "
        "Install with: pip install cognitive-modules[mcp]"
    )

from .registry import list_modules, find_module
from .loader import load_module
from .runner import run_module as execute_module

# ============================================================
# MCP Server Setup
# ============================================================

mcp = FastMCP(
    "Cognitive Modules",
    description="可验证的结构化 AI 任务规范 - 提供代码审查、任务排序等模块",
)


# ============================================================
# Tools
# ============================================================

@mcp.tool()
def cognitive_run(
    module: str,
    args: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> dict[str, Any]:
    """
    运行 Cognitive Module，获取结构化的 AI 分析结果。
    
    Args:
        module: 模块名称，如 "code-reviewer", "task-prioritizer"
        args: 输入参数，如代码片段或任务列表
        provider: LLM 提供商（可选），如 "openai", "anthropic"
        model: 模型名称（可选），如 "gpt-4o", "claude-3-5-sonnet-20241022"
    
    Returns:
        结构化结果，包含分析内容、confidence（置信度）和 rationale（推理过程）
    
    Example:
        cognitive_run("code-reviewer", "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')")
        
        返回:
        {
            "ok": true,
            "data": {
                "issues": [{"type": "security", "severity": "critical", "description": "SQL 注入"}],
                "confidence": 0.95,
                "rationale": "检测到字符串拼接 SQL"
            }
        }
    """
    # 检查模块是否存在
    module_path = find_module(module)
    if not module_path:
        return {"ok": False, "error": f"Module '{module}' not found"}
    
    # 设置 provider（如果指定）
    original_provider = os.environ.get("LLM_PROVIDER")
    original_model = os.environ.get("LLM_MODEL")
    
    try:
        if provider:
            os.environ["LLM_PROVIDER"] = provider
        if model:
            os.environ["LLM_MODEL"] = model
        
        # 执行模块
        result = execute_module(module, args=args)
        
        return {"ok": True, "data": result, "module": module}
    except Exception as e:
        return {"ok": False, "error": str(e), "module": module}
    finally:
        # 恢复原始环境变量
        if original_provider:
            os.environ["LLM_PROVIDER"] = original_provider
        elif "LLM_PROVIDER" in os.environ and provider:
            del os.environ["LLM_PROVIDER"]
        
        if original_model:
            os.environ["LLM_MODEL"] = original_model
        elif "LLM_MODEL" in os.environ and model:
            del os.environ["LLM_MODEL"]


@mcp.tool()
def cognitive_list() -> dict[str, Any]:
    """
    列出所有已安装的 Cognitive Modules。
    
    Returns:
        模块列表，包含名称、位置和格式信息
    
    Example:
        cognitive_list()
        
        返回:
        {
            "modules": [
                {"name": "code-reviewer", "location": "builtin", "format": "v1"},
                {"name": "task-prioritizer", "location": "builtin", "format": "v1"}
            ],
            "count": 2
        }
    """
    modules = list_modules()
    return {
        "modules": [
            {"name": m["name"], "location": m["location"], "format": m["format"]}
            for m in modules
        ],
        "count": len(modules),
    }


@mcp.tool()
def cognitive_info(module: str) -> dict[str, Any]:
    """
    获取 Cognitive Module 的详细信息。
    
    Args:
        module: 模块名称
    
    Returns:
        模块详情，包含名称、描述、输入输出格式等
    
    Example:
        cognitive_info("code-reviewer")
        
        返回:
        {
            "name": "code-reviewer",
            "version": "1.0.0",
            "description": "代码安全和质量审查",
            "responsibility": "分析代码并识别潜在问题"
        }
    """
    module_path = find_module(module)
    if not module_path:
        return {"ok": False, "error": f"Module '{module}' not found"}
    
    try:
        m = load_module(module)
        meta = m.get("meta", {})
        
        return {
            "ok": True,
            "name": meta.get("name", module),
            "version": meta.get("version"),
            "description": meta.get("description") or meta.get("responsibility"),
            "responsibility": meta.get("responsibility"),
            "input_schema": m.get("input_schema"),
            "output_schema": m.get("output_schema"),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
# Resources
# ============================================================

@mcp.resource("cognitive://modules")
def get_modules_resource() -> str:
    """获取所有模块列表（资源形式）"""
    modules = list_modules()
    return json.dumps([m["name"] for m in modules], indent=2)


@mcp.resource("cognitive://module/{name}")
def get_module_resource(name: str) -> str:
    """获取单个模块的 prompt 内容"""
    module_path = find_module(name)
    if not module_path:
        return f"Module '{name}' not found"
    
    try:
        m = load_module(name)
        return m.get("prompt", "")
    except Exception as e:
        return f"Error: {e}"


# ============================================================
# Prompts
# ============================================================

@mcp.prompt()
def code_review_prompt(code: str) -> str:
    """生成代码审查提示"""
    return f"""请使用 cognitive_run 工具审查以下代码：

```
{code}
```

调用: cognitive_run("code-reviewer", "{code[:100]}...")
"""


@mcp.prompt()
def task_prioritize_prompt(tasks: str) -> str:
    """生成任务排序提示"""
    return f"""请使用 cognitive_run 工具对以下任务进行优先级排序：

{tasks}

调用: cognitive_run("task-prioritizer", "{tasks}")
"""


# ============================================================
# 启动入口
# ============================================================

def serve():
    """启动 MCP 服务器"""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    serve()
