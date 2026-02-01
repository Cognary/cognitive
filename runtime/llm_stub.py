#!/usr/bin/env python3
"""
LLM Stub / Interface

This module provides the interface for calling LLMs.
Replace the stub implementation with your actual LLM integration.

Supported backends:
- OpenAI API
- Anthropic Claude API
- Local models via Ollama
- Any OpenAI-compatible API

Configure via environment variables:
- LLM_PROVIDER: "openai", "anthropic", "ollama", "stub"
- OPENAI_API_KEY: OpenAI API key
- ANTHROPIC_API_KEY: Anthropic API key
- OLLAMA_HOST: Ollama server URL (default: http://localhost:11434)
- LLM_MODEL: Model to use (default depends on provider)
"""

import json
import os
from pathlib import Path


def call_llm(prompt: str, model: str = None) -> str:
    """
    Call the configured LLM with the given prompt.
    
    Args:
        prompt: The prompt to send to the LLM
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
    else:
        return _call_stub(prompt)


def _call_openai(prompt: str, model: str = None) -> str:
    """Call OpenAI API."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("Please install openai: pip install openai")
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    client = OpenAI(api_key=api_key)
    model = model or os.environ.get("LLM_MODEL", "gpt-4o")
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a precise UI specification generator. Output only valid JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )
    
    return response.choices[0].message.content


def _call_anthropic(prompt: str, model: str = None) -> str:
    """Call Anthropic Claude API."""
    try:
        import anthropic
    except ImportError:
        raise ImportError("Please install anthropic: pip install anthropic")
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")
    
    client = anthropic.Anthropic(api_key=api_key)
    model = model or os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
    
    response = client.messages.create(
        model=model,
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        system="You are a precise UI specification generator. Output only valid JSON matching the required schema."
    )
    
    return response.content[0].text


def _call_ollama(prompt: str, model: str = None) -> str:
    """Call local Ollama instance."""
    try:
        import requests
    except ImportError:
        raise ImportError("Please install requests: pip install requests")
    
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    model = model or os.environ.get("LLM_MODEL", "llama3.1")
    
    response = requests.post(
        f"{host}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }
    )
    response.raise_for_status()
    
    return response.json()["response"]


def _call_stub(prompt: str) -> str:
    """
    Stub implementation that returns the example output.
    Used for testing without an actual LLM.
    """
    print("  ⚠ Using stub LLM (set LLM_PROVIDER env var for real LLM)")
    
    # Try to find and return the example output for the module
    # This is a simple heuristic based on the prompt content
    modules_path = Path(__file__).parent.parent / "cognitive" / "modules"
    
    for module_dir in modules_path.iterdir():
        if module_dir.is_dir():
            example_output = module_dir / "examples" / "output.json"
            if example_output.exists():
                # Check if this module's prompt is in the request
                prompt_file = module_dir / "prompt.txt"
                if prompt_file.exists():
                    with open(prompt_file, 'r') as f:
                        module_prompt = f.read()
                    if module_prompt[:100] in prompt:
                        with open(example_output, 'r') as f:
                            return f.read()
    
    # Fallback: return a minimal valid response
    return json.dumps({
        "specification": {},
        "rationale": {
            "decisions": [{"aspect": "stub", "decision": "stub response", "reasoning": "No LLM configured"}],
            "assumptions": [],
            "open_questions": ["Configure LLM_PROVIDER environment variable"]
        },
        "confidence": 0.0
    })


# Convenience function for testing
def test_connection() -> bool:
    """Test LLM connection with a simple prompt."""
    try:
        response = call_llm("Say 'OK' if you can read this.")
        return "OK" in response.upper() or len(response) > 0
    except Exception as e:
        print(f"Connection test failed: {e}")
        return False


if __name__ == "__main__":
    # Quick test
    print(f"LLM Provider: {os.environ.get('LLM_PROVIDER', 'stub')}")
    print(f"Testing connection...")
    if test_connection():
        print("✓ Connection successful")
    else:
        print("✗ Connection failed")
