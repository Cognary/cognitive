"""
Module Runner - Execute cognitive modules with validation.
Supports v2.2 envelope format with Control/Data plane separation.

v2.2 Features:
  - meta (Control Plane): confidence, risk, explain
  - data (Data Plane): business payload + rationale
  - Repair pass for schema validation failures
  - Auto-wrap v2.1 payloads to v2.2 envelope
"""

import json
from pathlib import Path
from typing import Optional, TypedDict, Union, Literal

import jsonschema
import yaml

from .registry import find_module
from .loader import load_module
from .providers import call_llm


# =============================================================================
# Type Definitions (v2.2)
# =============================================================================

RiskLevel = Literal["none", "low", "medium", "high"]

class EnvelopeMeta(TypedDict, total=False):
    """Control plane metadata - unified across all modules."""
    confidence: float  # 0-1
    risk: RiskLevel
    explain: str  # max 280 chars
    trace_id: str
    model: str
    latency_ms: float


class EnvelopeError(TypedDict):
    code: str
    message: str


class EnvelopeSuccessV22(TypedDict):
    ok: Literal[True]
    meta: EnvelopeMeta
    data: dict


class EnvelopeFailureV22(TypedDict, total=False):
    ok: Literal[False]
    meta: EnvelopeMeta
    error: EnvelopeError
    partial_data: Optional[dict]


EnvelopeResponseV22 = Union[EnvelopeSuccessV22, EnvelopeFailureV22]


# Legacy types for compatibility
class EnvelopeSuccessV21(TypedDict):
    ok: Literal[True]
    data: dict


class EnvelopeFailureV21(TypedDict, total=False):
    ok: Literal[False]
    error: EnvelopeError
    partial_data: Optional[dict]


EnvelopeResponse = Union[EnvelopeResponseV22, EnvelopeSuccessV21, EnvelopeFailureV21]


# =============================================================================
# Risk Aggregation
# =============================================================================

RISK_LEVELS = {"none": 0, "low": 1, "medium": 2, "high": 3}
RISK_NAMES = ["none", "low", "medium", "high"]


def aggregate_risk(changes: list[dict]) -> RiskLevel:
    """Compute max risk from list of changes."""
    if not changes:
        return "medium"  # Default conservative
    
    max_level = 0
    for change in changes:
        risk = change.get("risk", "medium")
        level = RISK_LEVELS.get(risk, 2)
        max_level = max(max_level, level)
    
    return RISK_NAMES[max_level]


# =============================================================================
# Schema Validation
# =============================================================================

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


# =============================================================================
# Repair Pass (v2.2)
# =============================================================================

def repair_envelope(
    data: dict,
    meta_schema: Optional[dict] = None,
    max_explain_length: int = 280
) -> dict:
    """
    Attempt to repair envelope format issues without changing semantics.
    
    Repairs:
    - Missing meta fields (fill with conservative defaults)
    - Truncate explain if too long
    - Normalize risk enum values
    """
    repaired = dict(data)
    
    # Ensure meta exists
    if "meta" not in repaired:
        repaired["meta"] = {}
    
    meta = repaired["meta"]
    data_payload = repaired.get("data", {})
    
    # Repair confidence
    if "confidence" not in meta:
        # Try to extract from data (v2.1 compatibility)
        meta["confidence"] = data_payload.get("confidence", 0.5)
    
    # Ensure confidence is in valid range
    if isinstance(meta.get("confidence"), (int, float)):
        meta["confidence"] = max(0.0, min(1.0, float(meta["confidence"])))
    
    # Repair risk
    if "risk" not in meta:
        # Aggregate from changes if available
        changes = data_payload.get("changes", [])
        meta["risk"] = aggregate_risk(changes)
    
    # Normalize risk value
    risk = str(meta.get("risk", "medium")).lower()
    if risk not in RISK_LEVELS:
        meta["risk"] = "medium"
    else:
        meta["risk"] = risk
    
    # Repair explain
    if "explain" not in meta:
        # Try to extract from rationale
        rationale = data_payload.get("rationale", "")
        if rationale:
            meta["explain"] = rationale[:max_explain_length]
        else:
            meta["explain"] = "No explanation provided"
    
    # Truncate explain if too long
    if len(meta.get("explain", "")) > max_explain_length:
        meta["explain"] = meta["explain"][:max_explain_length - 3] + "..."
    
    return repaired


def repair_error_envelope(
    data: dict,
    max_explain_length: int = 280
) -> dict:
    """Repair error envelope format."""
    repaired = dict(data)
    
    # Ensure meta exists for errors
    if "meta" not in repaired:
        repaired["meta"] = {}
    
    meta = repaired["meta"]
    
    # Set default meta for errors
    if "confidence" not in meta:
        meta["confidence"] = 0.0
    if "risk" not in meta:
        meta["risk"] = "high"
    if "explain" not in meta:
        error = repaired.get("error", {})
        meta["explain"] = error.get("message", "An error occurred")[:max_explain_length]
    
    return repaired


# =============================================================================
# Envelope Detection & Conversion
# =============================================================================

def is_envelope_response(data: dict) -> bool:
    """Check if response is in envelope format (v2.1 or v2.2)."""
    return isinstance(data.get("ok"), bool)


def is_v22_envelope(data: dict) -> bool:
    """Check if response is in v2.2 envelope format (has meta)."""
    return is_envelope_response(data) and "meta" in data


def wrap_v21_to_v22(v21_response: dict) -> EnvelopeResponseV22:
    """
    Convert v2.1 envelope to v2.2 envelope.
    Adds meta field by extracting/computing from data.
    """
    if is_v22_envelope(v21_response):
        return v21_response  # Already v2.2
    
    if v21_response.get("ok") is True:
        data = v21_response.get("data", {})
        
        # Extract or compute meta fields
        confidence = data.get("confidence", 0.5)
        rationale = data.get("rationale", "")
        changes = data.get("changes", [])
        
        return {
            "ok": True,
            "meta": {
                "confidence": confidence,
                "risk": aggregate_risk(changes),
                "explain": rationale[:280] if rationale else "No explanation provided"
            },
            "data": data
        }
    else:
        error = v21_response.get("error", {"code": "UNKNOWN", "message": "Unknown error"})
        
        return {
            "ok": False,
            "meta": {
                "confidence": 0.0,
                "risk": "high",
                "explain": error.get("message", "An error occurred")[:280]
            },
            "error": error,
            "partial_data": v21_response.get("partial_data")
        }


def convert_legacy_to_envelope(data: dict, is_error: bool = False) -> EnvelopeResponseV22:
    """Convert legacy format (no envelope) to v2.2 envelope."""
    if is_error or "error" in data:
        error = data.get("error", {})
        error_msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)
        
        return {
            "ok": False,
            "meta": {
                "confidence": 0.0,
                "risk": "high",
                "explain": error_msg[:280]
            },
            "error": {
                "code": error.get("code", "UNKNOWN") if isinstance(error, dict) else "UNKNOWN",
                "message": error_msg
            },
            "partial_data": None
        }
    else:
        # Legacy success response - data is the payload itself
        confidence = data.get("confidence", 0.5)
        rationale = data.get("rationale", "")
        changes = data.get("changes", [])
        
        return {
            "ok": True,
            "meta": {
                "confidence": confidence,
                "risk": aggregate_risk(changes),
                "explain": rationale[:280] if rationale else "No explanation provided"
            },
            "data": data
        }


# =============================================================================
# Prompt Building
# =============================================================================

def substitute_arguments(text: str, input_data: dict) -> str:
    """Substitute $ARGUMENTS and $N placeholders in text."""
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


def build_prompt(module: dict, input_data: dict, use_envelope: bool = False, use_v22: bool = False) -> str:
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
        if use_v22:
            parts.extend([
                "\n## Response Format (Envelope v2.2)\n",
                "You MUST wrap your response in the v2.2 envelope format with separate meta and data:\n",
                "- Success: { \"ok\": true, \"meta\": { \"confidence\": 0.9, \"risk\": \"low\", \"explain\": \"short summary\" }, \"data\": { ...payload... } }\n",
                "- Error: { \"ok\": false, \"meta\": { \"confidence\": 0.0, \"risk\": \"high\", \"explain\": \"error summary\" }, \"error\": { \"code\": \"ERROR_CODE\", \"message\": \"...\" } }\n",
                "Note: meta.explain must be ≤280 characters. data.rationale can be longer for detailed reasoning.\n",
                "Return ONLY valid JSON.\n",
            ])
        else:
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


# =============================================================================
# LLM Response Parsing
# =============================================================================

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


# =============================================================================
# Main Runner
# =============================================================================

def run_module(
    name_or_path: str,
    input_data: dict,
    validate_input: bool = True,
    validate_output: bool = True,
    model: Optional[str] = None,
    use_envelope: Optional[bool] = None,
    use_v22: Optional[bool] = None,
    enable_repair: bool = True,
) -> EnvelopeResponseV22:
    """
    Run a cognitive module with the given input.
    Returns v2.2 envelope format response.
    
    Args:
        name_or_path: Module name or path to module directory
        input_data: Input data dictionary
        validate_input: Whether to validate input against schema
        validate_output: Whether to validate output against schema
        model: Optional model override
        use_envelope: Force envelope format (auto-detect if None)
        use_v22: Force v2.2 envelope format (auto-detect if None)
        enable_repair: Enable repair pass for validation failures
    
    Returns:
        EnvelopeResponseV22 with ok=True/False, meta, and data/error
    """
    import time
    start_time = time.time()
    
    # Find module path
    path = Path(name_or_path)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(name_or_path)
        if not module_path:
            return {
                "ok": False,
                "meta": {
                    "confidence": 1.0,
                    "risk": "high",
                    "explain": f"Module '{name_or_path}' not found."
                },
                "error": {"code": "MODULE_NOT_FOUND", "message": f"Module not found: {name_or_path}"},
                "partial_data": None
            }
    
    # Load module (auto-detects format)
    module = load_module(module_path)
    
    # Determine envelope version
    compat = module.get("compat", {})
    is_v22_module = module.get("tier") is not None or "meta_schema" in module
    
    should_use_envelope = use_envelope
    if should_use_envelope is None:
        output_contract = module.get("output_contract", {})
        should_use_envelope = (
            module.get("format") == "v2" or 
            output_contract.get("envelope", False)
        )
    
    should_use_v22 = use_v22
    if should_use_v22 is None:
        should_use_v22 = is_v22_module or compat.get("runtime_auto_wrap", False)
    
    # Validate input
    if validate_input and module.get("input_schema"):
        errors = validate_data(input_data, module["input_schema"], "Input")
        if errors:
            return {
                "ok": False,
                "meta": {
                    "confidence": 1.0,
                    "risk": "none",
                    "explain": "Input validation failed."
                },
                "error": {"code": "INVALID_INPUT", "message": str(errors)},
                "partial_data": None
            }
    
    # Build prompt and call LLM
    full_prompt = build_prompt(
        module, 
        input_data, 
        use_envelope=should_use_envelope,
        use_v22=should_use_v22
    )
    response = call_llm(full_prompt, model=model)
    
    # Calculate latency
    latency_ms = (time.time() - start_time) * 1000
    
    # Parse response
    try:
        output_data = parse_llm_response(response)
    except json.JSONDecodeError as e:
        return {
            "ok": False,
            "meta": {
                "confidence": 0.0,
                "risk": "high",
                "explain": "Failed to parse LLM response as JSON."
            },
            "error": {"code": "PARSE_ERROR", "message": f"Failed to parse JSON: {e}"},
            "partial_data": None
        }
    
    # Convert to v2.2 envelope
    if is_v22_envelope(output_data):
        result = output_data
    elif is_envelope_response(output_data):
        # v2.1 envelope -> v2.2
        result = wrap_v21_to_v22(output_data)
    else:
        # Legacy format -> v2.2
        result = convert_legacy_to_envelope(output_data)
    
    # Add latency to meta
    if "meta" in result:
        result["meta"]["latency_ms"] = latency_ms
        if model:
            result["meta"]["model"] = model
    
    # Validate and potentially repair
    if result.get("ok") and validate_output:
        # Get data schema (support both "data" and "output" aliases)
        data_schema = module.get("data_schema") or module.get("output_schema")
        meta_schema = module.get("meta_schema")
        
        if data_schema:
            data_to_validate = result.get("data", {})
            errors = validate_data(data_to_validate, data_schema, "Data")
            
            if errors and enable_repair:
                # Attempt repair pass
                result = repair_envelope(result, meta_schema)
                
                # Re-validate after repair
                errors = validate_data(result.get("data", {}), data_schema, "Data")
            
            if errors:
                return {
                    "ok": False,
                    "meta": {
                        "confidence": 0.0,
                        "risk": "high",
                        "explain": "Schema validation failed after repair attempt."
                    },
                    "error": {"code": "SCHEMA_VALIDATION_FAILED", "message": str(errors)},
                    "partial_data": result.get("data")
                }
        
        # Validate meta if schema exists
        if meta_schema:
            meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
            if meta_errors and enable_repair:
                result = repair_envelope(result, meta_schema)
    
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
        use_envelope=False,
        use_v22=False
    )
    
    if result.get("ok"):
        return result.get("data", {})
    else:
        error = result.get("error", {})
        raise ValueError(f"{error.get('code', 'UNKNOWN')}: {error.get('message', 'Unknown error')}")


# =============================================================================
# Convenience Functions
# =============================================================================

def extract_meta(result: EnvelopeResponseV22) -> EnvelopeMeta:
    """Extract meta from v2.2 envelope for routing/logging."""
    return result.get("meta", {
        "confidence": 0.5,
        "risk": "medium",
        "explain": "No meta available"
    })


def should_escalate(result: EnvelopeResponseV22, confidence_threshold: float = 0.7) -> bool:
    """Determine if result should be escalated to human review based on meta."""
    meta = extract_meta(result)
    
    # Escalate if low confidence
    if meta.get("confidence", 0) < confidence_threshold:
        return True
    
    # Escalate if high risk
    if meta.get("risk") == "high":
        return True
    
    # Escalate if error
    if not result.get("ok"):
        return True
    
    return False
