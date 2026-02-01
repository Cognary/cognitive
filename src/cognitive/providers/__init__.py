"""
LLM Providers - Unified interface for calling different LLM backends.
"""

import json
import os
from pathlib import Path
from typing import Optional


def call_llm(prompt: str, model: Optional[str] = None) -> str:
    """
    Call the configured LLM with the given prompt.
    
    Configure via environment variables:
    - LLM_PROVIDER: "openai", "anthropic", "ollama", "minimax", "stub"
    - OPENAI_API_KEY / ANTHROPIC_API_KEY / MINIMAX_API_KEY
    - LLM_MODEL: model override
    
    Args:
        prompt: The prompt to send
        model: Optional model override
    
    Returns:
        The LLM's response as a string
    """
    provider = os.environ.get("LLM_PROVIDER", "stub").lower()
    
    if provider == "openai":
        return _call_openai(prompt, model)
    elif provider == "anthropic":
        return _call_anthropic(prompt, model)
    elif provider == "ollama":
        return _call_ollama(prompt, model)
    elif provider == "minimax":
        return _call_minimax(prompt, model)
    else:
        return _call_stub(prompt)


def _call_openai(prompt: str, model: Optional[str] = None) -> str:
    """Call OpenAI API."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("OpenAI not installed. Run: pip install cognitive[openai]")
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    client = OpenAI(api_key=api_key)
    model = model or os.environ.get("LLM_MODEL", "gpt-4o")
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You output only valid JSON matching the required schema."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content


def _call_anthropic(prompt: str, model: Optional[str] = None) -> str:
    """Call Anthropic Claude API."""
    try:
        import anthropic
    except ImportError:
        raise ImportError("Anthropic not installed. Run: pip install cognitive[anthropic]")
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")
    
    client = anthropic.Anthropic(api_key=api_key)
    model = model or os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
    
    response = client.messages.create(
        model=model,
        max_tokens=8192,
        system="You output only valid JSON matching the required schema.",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text


def _call_minimax(prompt: str, model: Optional[str] = None) -> str:
    """Call MiniMax API (OpenAI-compatible)."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("OpenAI SDK not installed. Run: pip install openai")
    
    api_key = os.environ.get("MINIMAX_API_KEY")
    if not api_key:
        raise ValueError("MINIMAX_API_KEY environment variable not set")
    
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.minimax.chat/v1"
    )
    model = model or os.environ.get("LLM_MODEL", "MiniMax-Text-01")
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You output only valid JSON matching the required schema. Do not include any text before or after the JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
    )
    
    return response.choices[0].message.content


def _call_ollama(prompt: str, model: Optional[str] = None) -> str:
    """Call local Ollama instance."""
    try:
        import requests
    except ImportError:
        raise ImportError("Requests not installed. Run: pip install cognitive[ollama]")
    
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = model or os.environ.get("LLM_MODEL", "llama3.1")
    
    response = requests.post(
        f"{host}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2}
        }
    )
    response.raise_for_status()
    
    return response.json()["response"]


def _call_stub(prompt: str) -> str:
    """
    Stub implementation for testing without LLM.
    Returns example output if available.
    """
    # Try to find example output from a module
    # This is a heuristic - look for cognitive/modules directories
    search_paths = [
        Path.cwd() / "cognitive" / "modules",
        Path.home() / ".cognitive" / "modules",
    ]
    
    for base in search_paths:
        if not base.exists():
            continue
        for module_dir in base.iterdir():
            if not module_dir.is_dir():
                continue
            prompt_file = module_dir / "prompt.txt"
            output_file = module_dir / "examples" / "output.json"
            if prompt_file.exists() and output_file.exists():
                with open(prompt_file, 'r') as f:
                    module_prompt = f.read()
                # Check if this module's prompt is in the request
                if module_prompt[:100] in prompt:
                    with open(output_file, 'r') as f:
                        return f.read()
    
    # Fallback minimal response
    return json.dumps({
        "specification": {},
        "rationale": {
            "decisions": [{"aspect": "stub", "decision": "stub", "reasoning": "No LLM configured"}],
            "assumptions": [],
            "open_questions": ["Set LLM_PROVIDER environment variable"]
        },
        "confidence": 0.0
    })


def check_provider_status() -> dict:
    """Check which providers are available and configured."""
    status = {}
    
    # OpenAI
    try:
        import openai
        status["openai"] = {
            "installed": True,
            "configured": bool(os.environ.get("OPENAI_API_KEY")),
        }
    except ImportError:
        status["openai"] = {"installed": False, "configured": False}
    
    # Anthropic
    try:
        import anthropic
        status["anthropic"] = {
            "installed": True,
            "configured": bool(os.environ.get("ANTHROPIC_API_KEY")),
        }
    except ImportError:
        status["anthropic"] = {"installed": False, "configured": False}
    
    # MiniMax (uses OpenAI SDK)
    try:
        import openai
        status["minimax"] = {
            "installed": True,
            "configured": bool(os.environ.get("MINIMAX_API_KEY")),
        }
    except ImportError:
        status["minimax"] = {"installed": False, "configured": False}
    
    # Ollama
    try:
        import requests
        host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        try:
            r = requests.get(f"{host}/api/tags", timeout=2)
            status["ollama"] = {"installed": True, "configured": r.status_code == 200}
        except:
            status["ollama"] = {"installed": True, "configured": False}
    except ImportError:
        status["ollama"] = {"installed": False, "configured": False}
    
    # Current provider
    status["current_provider"] = os.environ.get("LLM_PROVIDER", "stub")
    status["current_model"] = os.environ.get("LLM_MODEL", "(default)")
    
    return status
