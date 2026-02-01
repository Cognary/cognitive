"""
Module Runner - Execute cognitive modules with validation.
Supports both old and new module formats.
"""

import json
from pathlib import Path
from typing import Optional

import jsonschema
import yaml

from .registry import find_module
from .loader import load_module
from .providers import call_llm


def validate_data(data: dict, schema: dict, label: str = "Data") -> list[str]:
    """Validate data against schema. Returns list of errors."""
    errors = []
    if not schema:
        return errors
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"{label} validation error: {e.message} at {list(e.absolute_path)}")
    except jsonschema.SchemaError as e:
        errors.append(f"Schema error: {e.message}")
    return errors


def substitute_arguments(text: str, input_data: dict) -> str:
    """Substitute $ARGUMENTS and $N placeholders in text."""
    # Get arguments
    args_value = input_data.get("$ARGUMENTS", input_data.get("query", ""))
    
    # Replace $ARGUMENTS
    text = text.replace("$ARGUMENTS", str(args_value))
    
    # Replace $ARGUMENTS[N] and $N for indexed access
    if isinstance(args_value, str):
        args_list = args_value.split()
        for i, arg in enumerate(args_list):
            text = text.replace(f"$ARGUMENTS[{i}]", arg)
            text = text.replace(f"${i}", arg)
    
    return text


def build_prompt(module: dict, input_data: dict) -> str:
    """Build the complete prompt for the LLM."""
    # Substitute $ARGUMENTS in prompt
    prompt = substitute_arguments(module["prompt"], input_data)
    
    parts = [
        prompt,
        "\n\n## Constraints\n",
        yaml.dump(module["constraints"], default_flow_style=False),
        "\n\n## Input\n",
        "```json\n",
        json.dumps(input_data, indent=2, ensure_ascii=False),
        "\n```\n",
        "\n## Instructions\n",
        "Analyze the input and generate output matching the required schema.",
        "Return ONLY valid JSON. Do not include any text before or after the JSON.",
    ]
    return "".join(parts)


def parse_llm_response(response: str) -> dict:
    """Parse LLM response, handling potential markdown code blocks."""
    text = response.strip()
    
    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1
        end = len(lines) - 1
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end])
    
    return json.loads(text)


def run_module(
    name_or_path: str,
    input_data: dict,
    validate_input: bool = True,
    validate_output: bool = True,
    model: Optional[str] = None,
) -> dict:
    """
    Run a cognitive module with the given input.
    Supports both old and new module formats.
    
    Args:
        name_or_path: Module name or path to module directory
        input_data: Input data dictionary
        validate_input: Whether to validate input against schema
        validate_output: Whether to validate output against schema
        model: Optional model override
    
    Returns:
        The module output as a dictionary
    """
    # Find module path
    path = Path(name_or_path)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(name_or_path)
        if not module_path:
            raise FileNotFoundError(f"Module not found: {name_or_path}")
    
    # Load module (auto-detects format)
    module = load_module(module_path)
    
    # Validate input
    if validate_input and module["input_schema"]:
        errors = validate_data(input_data, module["input_schema"], "Input")
        if errors:
            raise ValueError(f"Input validation failed: {errors}")
    
    # Build prompt and call LLM
    full_prompt = build_prompt(module, input_data)
    response = call_llm(full_prompt, model=model)
    
    # Parse response
    output_data = parse_llm_response(response)
    
    # Validate output
    if validate_output and module["output_schema"]:
        errors = validate_data(output_data, module["output_schema"], "Output")
        if errors:
            raise ValueError(f"Output validation failed: {errors}")
    
    return output_data
