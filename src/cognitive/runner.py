"""
Module Runner - Execute cognitive modules with validation.
Supports v2 envelope format and legacy formats.
"""

import json
from pathlib import Path
from typing import Optional, TypedDict, Union

import jsonschema
import yaml

from .registry import find_module
from .loader import load_module
from .providers import call_llm


class EnvelopeError(TypedDict):
    code: str
    message: str


class EnvelopeSuccess(TypedDict):
    ok: bool  # True
    data: dict


class EnvelopeFailure(TypedDict):
    ok: bool  # False
    error: EnvelopeError
    partial_data: Optional[dict]


EnvelopeResponse = Union[EnvelopeSuccess, EnvelopeFailure]


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
    args_value = input_data.get("$ARGUMENTS", input_data.get("query", input_data.get("code", "")))
    
    # Replace $ARGUMENTS
    text = text.replace("$ARGUMENTS", str(args_value))
    
    # Replace $ARGUMENTS[N] and $N for indexed access
    if isinstance(args_value, str):
        args_list = args_value.split()
        for i, arg in enumerate(args_list):
            text = text.replace(f"$ARGUMENTS[{i}]", arg)
            text = text.replace(f"${i}", arg)
    
    return text


def build_prompt(module: dict, input_data: dict, use_envelope: bool = False) -> str:
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
    ]
    
    if use_envelope:
        parts.extend([
            "\n## Response Format (Envelope)\n",
            "You MUST wrap your response in the envelope format:\n",
            "- Success: { \"ok\": true, \"data\": { ...your output... } }\n",
            "- Error: { \"ok\": false, \"error\": { \"code\": \"ERROR_CODE\", \"message\": \"...\" } }\n",
            "Return ONLY valid JSON.\n",
        ])
    else:
        parts.extend([
            "\n## Instructions\n",
            "Analyze the input and generate output matching the required schema.",
            "Return ONLY valid JSON. Do not include any text before or after the JSON.",
        ])
    
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


def is_envelope_response(data: dict) -> bool:
    """Check if response is in envelope format."""
    return isinstance(data.get("ok"), bool)


def parse_envelope_response(data: dict) -> EnvelopeResponse:
    """Parse and normalize envelope response."""
    if data.get("ok") is True:
        return {
            "ok": True,
            "data": data.get("data", {})
        }
    else:
        return {
            "ok": False,
            "error": data.get("error", {"code": "UNKNOWN", "message": "Unknown error"}),
            "partial_data": data.get("partial_data")
        }


def convert_to_envelope(data: dict, is_error: bool = False) -> EnvelopeResponse:
    """Convert legacy format to envelope format."""
    if is_error or "error" in data:
        error = data.get("error", {})
        return {
            "ok": False,
            "error": {
                "code": error.get("code", "UNKNOWN"),
                "message": error.get("message", str(error))
            },
            "partial_data": None
        }
    else:
        return {
            "ok": True,
            "data": data
        }


def run_module(
    name_or_path: str,
    input_data: dict,
    validate_input: bool = True,
    validate_output: bool = True,
    model: Optional[str] = None,
    use_envelope: Optional[bool] = None,
) -> EnvelopeResponse:
    """
    Run a cognitive module with the given input.
    Returns envelope format response.
    
    Args:
        name_or_path: Module name or path to module directory
        input_data: Input data dictionary
        validate_input: Whether to validate input against schema
        validate_output: Whether to validate output against schema
        model: Optional model override
        use_envelope: Force envelope format (auto-detect if None)
    
    Returns:
        EnvelopeResponse with ok=True/False and data/error
    """
    # Find module path
    path = Path(name_or_path)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(name_or_path)
        if not module_path:
            return {
                "ok": False,
                "error": {"code": "MODULE_NOT_FOUND", "message": f"Module not found: {name_or_path}"},
                "partial_data": None
            }
    
    # Load module (auto-detects format)
    module = load_module(module_path)
    
    # Determine if we should use envelope format
    should_use_envelope = use_envelope
    if should_use_envelope is None:
        # Auto-detect: use envelope for v2 format or if output.envelope is True
        output_contract = module.get("output_contract", {})
        should_use_envelope = (
            module.get("format") == "v2" or 
            output_contract.get("envelope", False)
        )
    
    # Validate input
    if validate_input and module["input_schema"]:
        errors = validate_data(input_data, module["input_schema"], "Input")
        if errors:
            return {
                "ok": False,
                "error": {"code": "INVALID_INPUT", "message": str(errors)},
                "partial_data": None
            }
    
    # Build prompt and call LLM
    full_prompt = build_prompt(module, input_data, use_envelope=should_use_envelope)
    response = call_llm(full_prompt, model=model)
    
    # Parse response
    try:
        output_data = parse_llm_response(response)
    except json.JSONDecodeError as e:
        return {
            "ok": False,
            "error": {"code": "PARSE_ERROR", "message": f"Failed to parse JSON: {e}"},
            "partial_data": None
        }
    
    # Handle envelope format
    if is_envelope_response(output_data):
        result = parse_envelope_response(output_data)
    else:
        # Convert legacy format to envelope
        result = convert_to_envelope(output_data)
    
    # Validate output (only for success responses)
    if result["ok"] and validate_output and module["output_schema"]:
        data_to_validate = result.get("data", {})
        errors = validate_data(data_to_validate, module["output_schema"], "Output")
        if errors:
            return {
                "ok": False,
                "error": {"code": "OUTPUT_VALIDATION_ERROR", "message": str(errors)},
                "partial_data": data_to_validate
            }
    
    return result


def run_module_legacy(
    name_or_path: str,
    input_data: dict,
    validate_input: bool = True,
    validate_output: bool = True,
    model: Optional[str] = None,
) -> dict:
    """
    Run a cognitive module (legacy API, returns raw output).
    For backward compatibility.
    """
    result = run_module(
        name_or_path,
        input_data,
        validate_input=validate_input,
        validate_output=validate_output,
        model=model,
        use_envelope=False
    )
    
    if result["ok"]:
        return result["data"]
    else:
        raise ValueError(f"{result['error']['code']}: {result['error']['message']}")
