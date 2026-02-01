"""
Cognitive Modules HTTP API Server

提供 RESTful API 接口，支持工作流平台集成（包括 Coze 插件）。

启动方式:
    cogn serve --port 8000
    
或直接运行:
    uvicorn cognitive.server:app --host 0.0.0.0 --port 8000
    
环境变量:
    COGNITIVE_API_KEY - API Key 认证（可选，不设置则无需认证）
    LLM_PROVIDER - LLM 提供商 (openai, anthropic, deepseek, minimax)
    OPENAI_API_KEY - OpenAI API Key
    ANTHROPIC_API_KEY - Anthropic API Key
    DEEPSEEK_API_KEY - DeepSeek API Key
"""

from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
import os

from .registry import list_modules, find_module
from .loader import load_module
from .runner import run_module as execute_module

# ============================================================
# API Key 认证
# ============================================================

API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> Optional[str]:
    """
    验证 API Key
    
    如果 COGNITIVE_API_KEY 未设置，则跳过验证。
    如果设置了，则要求请求头携带 Bearer <key> 格式的认证。
    """
    expected_key = os.environ.get("COGNITIVE_API_KEY")
    
    # 如果未设置 API Key，则不需要认证
    if not expected_key:
        return None
    
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API Key. Use header: Authorization: Bearer <your-api-key>"
        )
    
    # 支持 Bearer token 格式
    if api_key.startswith("Bearer "):
        api_key = api_key[7:]
    
    if api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    return api_key

# ============================================================
# App Setup
# ============================================================

app = FastAPI(
    title="Cognitive Modules API",
    description="可验证的结构化 AI 任务规范 - HTTP API",
    version="0.4.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Request/Response Models
# ============================================================

class RunRequest(BaseModel):
    """运行模块请求"""
    module: str = Field(..., description="模块名称", example="code-reviewer")
    args: str = Field(..., description="输入参数", example="def foo(): pass")
    provider: Optional[str] = Field(None, description="LLM 提供商", example="openai")
    model: Optional[str] = Field(None, description="模型名称", example="gpt-4o")


class RunResponse(BaseModel):
    """运行模块响应"""
    ok: bool = Field(..., description="是否成功")
    data: Optional[Dict[str, Any]] = Field(None, description="成功时的结果")
    error: Optional[str] = Field(None, description="失败时的错误信息")
    module: str = Field(..., description="模块名称")
    provider: Optional[str] = Field(None, description="使用的 LLM 提供商")


class ModuleInfo(BaseModel):
    """模块信息"""
    name: str
    version: Optional[str] = None
    description: Optional[str] = None
    format: str  # v0, v1, v2
    path: str
    responsibility: Optional[str] = None


class ModuleListResponse(BaseModel):
    """模块列表响应"""
    modules: List[ModuleInfo]
    count: int


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    version: str
    providers: Dict[str, bool]


# ============================================================
# API Endpoints
# ============================================================

@app.get("/", tags=["Info"])
async def root():
    """API 根路径"""
    return {
        "name": "Cognitive Modules API",
        "version": "0.4.0",
        "docs": "/docs",
        "endpoints": {
            "run": "POST /run",
            "modules": "GET /modules",
            "module_info": "GET /modules/{name}",
            "health": "GET /health",
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["Info"])
async def health():
    """健康检查"""
    providers = {
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "minimax": bool(os.environ.get("MINIMAX_API_KEY")),
        "deepseek": bool(os.environ.get("DEEPSEEK_API_KEY")),
    }
    return HealthResponse(
        status="healthy",
        version="0.4.0",
        providers=providers,
    )


@app.get("/modules", response_model=ModuleListResponse, tags=["Modules"])
async def get_modules():
    """列出所有已安装模块"""
    modules_data = list_modules()
    modules = []
    
    for m in modules_data:
        try:
            module = load_module(m["name"])
            modules.append(ModuleInfo(
                name=m["name"],
                version=module.get("version"),
                description=module.get("description") or module.get("responsibility"),
                format=m.get("format", "unknown"),
                path=m["path"],
                responsibility=module.get("responsibility"),
            ))
        except Exception:
            modules.append(ModuleInfo(
                name=m["name"],
                format=m.get("format", "unknown"),
                path=m["path"],
            ))
    
    return ModuleListResponse(modules=modules, count=len(modules))


@app.get("/modules/{name}", response_model=ModuleInfo, tags=["Modules"])
async def get_module(name: str):
    """获取单个模块信息"""
    module_path = find_module(name)
    if not module_path:
        raise HTTPException(status_code=404, detail=f"Module '{name}' not found")
    
    try:
        module = load_module(name)
        modules_data = list_modules()
        module_meta = next((m for m in modules_data if m["name"] == name), {})
        
        return ModuleInfo(
            name=name,
            version=module.get("version"),
            description=module.get("description") or module.get("responsibility"),
            format=module_meta.get("format", "unknown"),
            path=str(module_path),
            responsibility=module.get("responsibility"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run", response_model=RunResponse, tags=["Execution"])
async def run_module(
    request: RunRequest,
    api_key: Optional[str] = Depends(verify_api_key)
):
    """
    运行 Cognitive Module
    
    示例:
    ```json
    {
        "module": "code-reviewer",
        "args": "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"
    }
    ```
    
    认证:
        如果服务器设置了 COGNITIVE_API_KEY，需要在请求头中携带:
        Authorization: Bearer <your-api-key>
    """
    # 检查模块是否存在
    module_path = find_module(request.module)
    if not module_path:
        raise HTTPException(status_code=404, detail=f"Module '{request.module}' not found")
    
    # 设置 provider（如果指定）
    original_provider = os.environ.get("LLM_PROVIDER")
    original_model = os.environ.get("LLM_MODEL")
    
    try:
        if request.provider:
            os.environ["LLM_PROVIDER"] = request.provider
        if request.model:
            os.environ["LLM_MODEL"] = request.model
        
        # 执行模块
        result = execute_module(request.module, args=request.args)
        
        return RunResponse(
            ok=True,
            data=result,
            module=request.module,
            provider=request.provider or os.environ.get("LLM_PROVIDER", "openai"),
        )
    except Exception as e:
        return RunResponse(
            ok=False,
            error=str(e),
            module=request.module,
            provider=request.provider,
        )
    finally:
        # 恢复原始环境变量
        if original_provider:
            os.environ["LLM_PROVIDER"] = original_provider
        elif "LLM_PROVIDER" in os.environ and request.provider:
            del os.environ["LLM_PROVIDER"]
        
        if original_model:
            os.environ["LLM_MODEL"] = original_model
        elif "LLM_MODEL" in os.environ and request.model:
            del os.environ["LLM_MODEL"]


# ============================================================
# 启动入口
# ============================================================

def serve(host: str = "0.0.0.0", port: int = 8000):
    """启动 API 服务器"""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    serve()
