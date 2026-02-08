"""
Module Runner - Execute cognitive modules with validation.
Supports v2.2 envelope format with Control/Data plane separation.

v2.2 Features:
  - meta (Control Plane): confidence, risk, explain
  - data (Data Plane): business payload + rationale
  - Repair pass for schema validation failures
  - Auto-wrap v2.1 payloads to v2.2 envelope
  
v2.2.1 Features:
  - $version field for version negotiation
  - Enhanced error taxonomy (recoverable, retry_after_ms, details)
  - Observability hooks (on_before_call, on_after_call, on_error)
  - Streaming support (run_module_stream)
"""

import copy
import json
import time
from pathlib import Path
from typing import Optional, TypedDict, Union, Literal, Callable, Iterator

import jsonschema
import yaml

from .registry import find_module
from .loader import load_module
from .providers import call_llm


# =============================================================================
# Constants
# =============================================================================

ENVELOPE_VERSION = "2.2"


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


class EnvelopeError(TypedDict, total=False):
    """Enhanced error structure with retry and recovery info."""
    code: str  # Required
    message: str  # Required
    recoverable: bool  # Whether the error can be retried
    retry_after_ms: int  # Suggested wait time before retry
    details: dict  # Additional error context


class EnvelopeSuccessV22(TypedDict, total=False):
    ok: Literal[True]
    meta: EnvelopeMeta
    data: dict
    version: str  # Envelope version (e.g., "2.2")


class EnvelopeFailureV22(TypedDict, total=False):
    ok: Literal[False]
    meta: EnvelopeMeta
    error: EnvelopeError
    partial_data: Optional[dict]
    version: str  # Envelope version (e.g., "2.2")


EnvelopeResponseV22 = Union[EnvelopeSuccessV22, EnvelopeFailureV22]


# =============================================================================
# Observability Hooks
# =============================================================================

# Hook type definitions
BeforeCallHook = Callable[[str, dict, dict], None]  # (module_name, input_data, module_config)
AfterCallHook = Callable[[str, EnvelopeResponseV22, float], None]  # (module_name, result, latency_ms)
ErrorHook = Callable[[str, Exception, Optional[dict]], None]  # (module_name, error, partial_result)

# Global hook registries
_before_call_hooks: list[BeforeCallHook] = []
_after_call_hooks: list[AfterCallHook] = []
_error_hooks: list[ErrorHook] = []


def on_before_call(hook: BeforeCallHook) -> BeforeCallHook:
    """
    Decorator to register a before-call hook.
    
    Example:
        @on_before_call
        def log_input(module_name, input_data, module_config):
            print(f"Calling {module_name} with {input_data}")
    """
    _before_call_hooks.append(hook)
    return hook


def on_after_call(hook: AfterCallHook) -> AfterCallHook:
    """
    Decorator to register an after-call hook.
    
    Example:
        @on_after_call
        def log_result(module_name, result, latency_ms):
            print(f"{module_name} completed in {latency_ms}ms")
    """
    _after_call_hooks.append(hook)
    return hook


def on_error(hook: ErrorHook) -> ErrorHook:
    """
    Decorator to register an error hook.
    
    Example:
        @on_error
        def log_error(module_name, error, partial_result):
            print(f"Error in {module_name}: {error}")
    """
    _error_hooks.append(hook)
    return hook


def register_hook(
    hook_type: Literal["before_call", "after_call", "error"],
    hook: Callable
) -> None:
    """Register a hook programmatically."""
    if hook_type == "before_call":
        _before_call_hooks.append(hook)
    elif hook_type == "after_call":
        _after_call_hooks.append(hook)
    elif hook_type == "error":
        _error_hooks.append(hook)
    else:
        raise ValueError(f"Unknown hook type: {hook_type}")


def unregister_hook(
    hook_type: Literal["before_call", "after_call", "error"],
    hook: Callable
) -> bool:
    """Unregister a hook. Returns True if found and removed."""
    if hook_type == "before_call":
        if hook in _before_call_hooks:
            _before_call_hooks.remove(hook)
            return True
    elif hook_type == "after_call":
        if hook in _after_call_hooks:
            _after_call_hooks.remove(hook)
            return True
    elif hook_type == "error":
        if hook in _error_hooks:
            _error_hooks.remove(hook)
            return True
    return False


def clear_hooks() -> None:
    """Clear all registered hooks."""
    _before_call_hooks.clear()
    _after_call_hooks.clear()
    _error_hooks.clear()


def _invoke_before_hooks(module_name: str, input_data: dict, module_config: dict) -> None:
    """Invoke all registered before-call hooks."""
    for hook in _before_call_hooks:
        try:
            hook(module_name, input_data, module_config)
        except Exception:
            pass  # Hooks should not break the main flow


def _invoke_after_hooks(module_name: str, result: EnvelopeResponseV22, latency_ms: float) -> None:
    """Invoke all registered after-call hooks."""
    for hook in _after_call_hooks:
        try:
            hook(module_name, result, latency_ms)
        except Exception:
            pass


def _invoke_error_hooks(module_name: str, error: Exception, partial_result: Optional[dict]) -> None:
    """Invoke all registered error hooks."""
    for hook in _error_hooks:
        try:
            hook(module_name, error, partial_result)
        except Exception:
            pass


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

RiskRule = Literal["max_changes_risk", "max_issues_risk", "explicit"]


def aggregate_risk_from_list(items: list[dict]) -> RiskLevel:
    """Compute max risk from list of items with risk field."""
    if not items:
        return "medium"  # Default conservative
    
    max_level = 0
    for item in items:
        risk = item.get("risk", "medium")
        level = RISK_LEVELS.get(risk, 2)
        max_level = max(max_level, level)
    
    return RISK_NAMES[max_level]


def aggregate_risk(
    data: dict,
    risk_rule: RiskRule = "max_changes_risk"
) -> RiskLevel:
    """
    Compute aggregated risk based on risk_rule.
    
    Rules:
    - max_changes_risk: max(data.changes[*].risk) - default
    - max_issues_risk: max(data.issues[*].risk) - for review modules
    - explicit: return "medium", module should set risk explicitly
    """
    if risk_rule == "max_changes_risk":
        changes = data.get("changes", [])
        return aggregate_risk_from_list(changes)
    elif risk_rule == "max_issues_risk":
        issues = data.get("issues", [])
        return aggregate_risk_from_list(issues)
    elif risk_rule == "explicit":
        return "medium"  # Module should override
    else:
        # Fallback to changes
        changes = data.get("changes", [])
        return aggregate_risk_from_list(changes)


# =============================================================================
# Error Response Builder
# =============================================================================

# Error codes and their default properties
ERROR_PROPERTIES = {
    "MODULE_NOT_FOUND": {"recoverable": False, "retry_after_ms": None},
    "INVALID_INPUT": {"recoverable": False, "retry_after_ms": None},
    "PARSE_ERROR": {"recoverable": True, "retry_after_ms": 1000},
    "SCHEMA_VALIDATION_FAILED": {"recoverable": True, "retry_after_ms": 1000},
    "META_VALIDATION_FAILED": {"recoverable": True, "retry_after_ms": 1000},
    "LLM_ERROR": {"recoverable": True, "retry_after_ms": 5000},
    "RATE_LIMITED": {"recoverable": True, "retry_after_ms": 10000},
    "TIMEOUT": {"recoverable": True, "retry_after_ms": 5000},
    "UNKNOWN": {"recoverable": False, "retry_after_ms": None},
}


def make_error_response(
    code: str,
    message: str,
    explain: Optional[str] = None,
    partial_data: Optional[dict] = None,
    details: Optional[dict] = None,
    recoverable: Optional[bool] = None,
    retry_after_ms: Optional[int] = None,
    confidence: float = 0.0,
    risk: RiskLevel = "high",
) -> EnvelopeResponseV22:
    """
    Build a standardized error response with enhanced taxonomy.
    
    Args:
        code: Error code (e.g., "INVALID_INPUT", "PARSE_ERROR")
        message: Human-readable error message
        explain: Short explanation for meta.explain (defaults to message[:280])
        partial_data: Any partial results that were computed
        details: Additional error context
        recoverable: Whether the error can be retried (auto-detected from code if None)
        retry_after_ms: Suggested wait time before retry
        confidence: Confidence in the error diagnosis (usually 0.0 or 1.0)
        risk: Risk level (usually "high" for errors)
    
    Returns:
        EnvelopeResponseV22 with proper error structure
    """
    # Get default properties from error code
    defaults = ERROR_PROPERTIES.get(code, ERROR_PROPERTIES["UNKNOWN"])
    
    error_obj: EnvelopeError = {
        "code": code,
        "message": message,
    }
    
    # Add recoverable flag
    is_recoverable = recoverable if recoverable is not None else defaults["recoverable"]
    if is_recoverable is not None:
        error_obj["recoverable"] = is_recoverable
    
    # Add retry suggestion
    retry_ms = retry_after_ms if retry_after_ms is not None else defaults["retry_after_ms"]
    if retry_ms is not None:
        error_obj["retry_after_ms"] = retry_ms
    
    # Add details if provided
    if details:
        error_obj["details"] = details
    
    return {
        "ok": False,
        "version": ENVELOPE_VERSION,
        "meta": {
            "confidence": confidence,
            "risk": risk,
            "explain": (explain or message)[:280]
        },
        "error": error_obj,
        "partial_data": partial_data
    }


def make_success_response(
    data: dict,
    confidence: float,
    risk: RiskLevel,
    explain: str,
    latency_ms: Optional[float] = None,
    model: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> EnvelopeResponseV22:
    """
    Build a standardized success response.
    
    Args:
        data: The data payload
        confidence: Confidence score 0-1
        risk: Risk level
        explain: Short explanation (max 280 chars)
        latency_ms: Processing time in milliseconds
        model: Model used for inference
        trace_id: Trace ID for distributed tracing
    
    Returns:
        EnvelopeResponseV22 with proper success structure
    """
    meta: EnvelopeMeta = {
        "confidence": max(0.0, min(1.0, confidence)),
        "risk": risk,
        "explain": explain[:280] if explain else "No explanation provided"
    }
    
    if latency_ms is not None:
        meta["latency_ms"] = latency_ms
    if model:
        meta["model"] = model
    if trace_id:
        meta["trace_id"] = trace_id
    
    return {
        "ok": True,
        "version": ENVELOPE_VERSION,
        "meta": meta,
        "data": data
    }


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
    max_explain_length: int = 280,
    risk_rule: RiskRule = "max_changes_risk"
) -> dict:
    """
    Attempt to repair envelope format issues without changing semantics.
    
    Repairs (mostly lossless, except explain truncation):
    - Missing meta fields (fill with conservative defaults)
    - Truncate explain if too long (lossy operation, but required for v2.2 spec)
    - Trim whitespace from string fields (lossless)
    - Clamp confidence to [0, 1] range (lossy if out of range)
    
    Does NOT repair:
    - Invalid enum values (treated as validation failure)
    
    Note: Returns a deep copy to avoid modifying the original data.
    """
    repaired = copy.deepcopy(data)
    
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
    
    # Repair risk - use configurable aggregation rule
    if "risk" not in meta:
        meta["risk"] = aggregate_risk(data_payload, risk_rule)
    
    # Trim whitespace from risk (lossless), but do NOT invent new values
    if isinstance(meta.get("risk"), str):
        meta["risk"] = meta["risk"].strip().lower()
        # If invalid after trim, leave as-is (validation will catch it)
    
    # Repair explain
    if "explain" not in meta:
        # Try to extract from rationale
        rationale = data_payload.get("rationale", "")
        if rationale:
            meta["explain"] = str(rationale)[:max_explain_length]
        else:
            meta["explain"] = "No explanation provided"
    
    # Trim whitespace from explain (lossless)
    if isinstance(meta.get("explain"), str):
        meta["explain"] = meta["explain"].strip()
    
    # Truncate explain if too long
    if len(meta.get("explain", "")) > max_explain_length:
        meta["explain"] = meta["explain"][:max_explain_length - 3] + "..."
    
    return repaired


def repair_error_envelope(
    data: dict,
    max_explain_length: int = 280
) -> dict:
    """
    Repair error envelope format.
    
    Note: Returns a deep copy to avoid modifying the original data.
    """
    repaired = copy.deepcopy(data)
    
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
        # Already v2.2, but ensure version field exists
        if "version" not in v21_response:
            v21_response = dict(v21_response)  # Shallow copy to avoid mutation
            v21_response["version"] = ENVELOPE_VERSION
        return v21_response
    
    if v21_response.get("ok") is True:
        data = v21_response.get("data", {})
        
        # Extract or compute meta fields
        confidence = data.get("confidence", 0.5)
        rationale = data.get("rationale", "")
        
        return {
            "ok": True,
            "version": ENVELOPE_VERSION,
            "meta": {
                "confidence": confidence,
                "risk": aggregate_risk(data),  # Uses default max_changes_risk
                "explain": rationale[:280] if rationale else "No explanation provided"
            },
            "data": data
        }
    else:
        error = v21_response.get("error", {"code": "UNKNOWN", "message": "Unknown error"})
        
        return {
            "ok": False,
            "version": ENVELOPE_VERSION,
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
            "version": ENVELOPE_VERSION,
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
        
        return {
            "ok": True,
            "version": ENVELOPE_VERSION,
            "meta": {
                "confidence": confidence,
                "risk": aggregate_risk(data),  # Uses default max_changes_risk
                "explain": rationale[:280] if rationale else "No explanation provided"
            },
            "data": data
        }


# =============================================================================
# Prompt Building
# =============================================================================

def substitute_arguments(text: str, input_data: dict) -> str:
    """
    Substitute $ARGUMENTS and $N placeholders in text.
    
    Substitution order (important to avoid partial replacements):
    1. $ARGUMENTS[N] - indexed access (descending order to avoid $1 matching $10)
    2. $N - shorthand indexed access (descending order)
    3. $ARGUMENTS - full argument string
    """
    args_value = input_data.get("$ARGUMENTS", input_data.get("query", input_data.get("code", "")))
    
    # Replace $ARGUMENTS[N] and $N for indexed access FIRST
    # Process in descending order to avoid $1 replacing part of $10
    if isinstance(args_value, str):
        args_list = args_value.split()
        for i in range(len(args_list) - 1, -1, -1):
            text = text.replace(f"$ARGUMENTS[{i}]", args_list[i])
            text = text.replace(f"${i}", args_list[i])
    
    # Replace $ARGUMENTS LAST (after indexed forms)
    text = text.replace("$ARGUMENTS", str(args_value))
    
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
    trace_id: Optional[str] = None,
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
        trace_id: Optional trace ID for distributed tracing
    
    Returns:
        EnvelopeResponseV22 with ok=True/False, meta, and data/error
    """
    start_time = time.time()
    module_name = name_or_path
    module = None
    
    try:
        # Find module path
        path = Path(name_or_path)
        if path.exists() and path.is_dir():
            module_path = path
        else:
            module_path = find_module(name_or_path)
            if not module_path:
                result = make_error_response(
                    code="MODULE_NOT_FOUND",
                    message=f"Module not found: {name_or_path}",
                    confidence=1.0
                )
                _invoke_error_hooks(module_name, ValueError(f"Module not found: {name_or_path}"), None)
                return result
        
        # Load module (auto-detects format)
        module = load_module(module_path)
        module_name = module.get("name", name_or_path)
        
        # Invoke before hooks
        _invoke_before_hooks(module_name, input_data, module)
        
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
                result = make_error_response(
                    code="INVALID_INPUT",
                    message=str(errors),
                    explain="Input validation failed.",
                    confidence=1.0,
                    risk="none",
                    details={"validation_errors": errors}
                )
                _invoke_error_hooks(module_name, ValueError(str(errors)), None)
                return result
        
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
            result = make_error_response(
                code="PARSE_ERROR",
                message=f"Failed to parse JSON: {e}",
                explain="Failed to parse LLM response as JSON.",
                details={"raw_response": response[:500] if len(response) > 500 else response}
            )
            _invoke_error_hooks(module_name, e, None)
            return result
        
        # Convert to v2.2 envelope
        if is_v22_envelope(output_data):
            result = output_data
        elif is_envelope_response(output_data):
            # v2.1 envelope -> v2.2
            result = wrap_v21_to_v22(output_data)
        else:
            # Legacy format -> v2.2
            result = convert_legacy_to_envelope(output_data)
        
        # Add version and meta fields
        result["version"] = ENVELOPE_VERSION
        if "meta" in result:
            result["meta"]["latency_ms"] = latency_ms
            if model:
                result["meta"]["model"] = model
            if trace_id:
                result["meta"]["trace_id"] = trace_id
    
        # Validate and potentially repair
        if result.get("ok") and validate_output:
            # Get data schema (support both "data" and "output" aliases)
            data_schema = module.get("data_schema") or module.get("output_schema")
            meta_schema = module.get("meta_schema")
            
            # Get risk_rule from module.yaml meta config
            meta_config = module.get("metadata", {}).get("meta", {})
            risk_rule = meta_config.get("risk_rule", "max_changes_risk")
            
            if data_schema:
                data_to_validate = result.get("data", {})
                errors = validate_data(data_to_validate, data_schema, "Data")
                
                if errors and enable_repair:
                    # Attempt repair pass
                    result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                    result["version"] = ENVELOPE_VERSION
                    
                    # Re-validate after repair
                    errors = validate_data(result.get("data", {}), data_schema, "Data")
                
                if errors:
                    err_result = make_error_response(
                        code="SCHEMA_VALIDATION_FAILED",
                        message=str(errors),
                        explain="Schema validation failed after repair attempt.",
                        partial_data=result.get("data"),
                        details={"validation_errors": errors}
                    )
                    _invoke_error_hooks(module_name, ValueError(str(errors)), result.get("data"))
                    return err_result
            
            # Validate meta if schema exists
            if meta_schema:
                meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
                if meta_errors and enable_repair:
                    result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                    result["version"] = ENVELOPE_VERSION
                    # Re-validate meta after repair
                    meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
                    if meta_errors:
                        err_result = make_error_response(
                            code="META_VALIDATION_FAILED",
                            message=str(meta_errors),
                            explain="Meta schema validation failed after repair attempt.",
                            partial_data=result.get("data"),
                            details={"validation_errors": meta_errors}
                        )
                        _invoke_error_hooks(module_name, ValueError(str(meta_errors)), result.get("data"))
                        return err_result
        
        # Repair error envelopes to ensure they have proper meta fields
        elif not result.get("ok") and enable_repair:
            result = repair_error_envelope(result)
            result["version"] = ENVELOPE_VERSION
        
        # Invoke after hooks
        final_latency_ms = (time.time() - start_time) * 1000
        _invoke_after_hooks(module_name, result, final_latency_ms)
        
        return result
    
    except Exception as e:
        # Handle unexpected errors
        latency_ms = (time.time() - start_time) * 1000
        result = make_error_response(
            code="UNKNOWN",
            message=str(e),
            explain=f"Unexpected error: {type(e).__name__}",
            details={"exception_type": type(e).__name__}
        )
        if "meta" in result:
            result["meta"]["latency_ms"] = latency_ms
        _invoke_error_hooks(module_name, e, None)
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
# Streaming Support
# =============================================================================

class StreamEvent(TypedDict, total=False):
    """Event emitted during streaming execution."""
    type: Literal["start", "chunk", "meta", "complete", "error"]
    timestamp_ms: float
    module_name: str
    chunk: str  # For type="chunk"
    meta: EnvelopeMeta  # For type="meta"
    result: EnvelopeResponseV22  # For type="complete"
    error: EnvelopeError  # For type="error"


def run_module_stream(
    name_or_path: str,
    input_data: dict,
    validate_input: bool = True,
    validate_output: bool = True,
    model: Optional[str] = None,
    use_v22: bool = True,
    enable_repair: bool = True,
    trace_id: Optional[str] = None,
) -> Iterator[StreamEvent]:
    """
    Run a cognitive module with streaming output.
    
    Yields StreamEvent objects as the module executes:
    - type="start": Module execution started
    - type="chunk": Incremental data chunk (if LLM supports streaming)
    - type="meta": Meta information available early
    - type="complete": Final complete result
    - type="error": Error occurred
    
    Example:
        for event in run_module_stream("code-simplifier", {"code": "..."}):
            if event["type"] == "chunk":
                print(event["chunk"], end="", flush=True)
            elif event["type"] == "complete":
                result = event["result"]
    
    Args:
        name_or_path: Module name or path
        input_data: Input data dictionary
        validate_input: Whether to validate input
        validate_output: Whether to validate output
        model: Optional model override
        use_v22: Use v2.2 format (default True)
        enable_repair: Enable repair pass
        trace_id: Optional trace ID
    
    Yields:
        StreamEvent dictionaries
    """
    start_time = time.time()
    module_name = name_or_path
    
    def make_event(event_type: str, **kwargs) -> StreamEvent:
        return {
            "type": event_type,
            "timestamp_ms": (time.time() - start_time) * 1000,
            "module_name": module_name,
            **kwargs
        }
    
    try:
        # Emit start event
        yield make_event("start")
        
        # Find and load module
        path = Path(name_or_path)
        if path.exists() and path.is_dir():
            module_path = path
        else:
            module_path = find_module(name_or_path)
            if not module_path:
                error_result = make_error_response(
                    code="MODULE_NOT_FOUND",
                    message=f"Module not found: {name_or_path}"
                )
                yield make_event("error", error=error_result.get("error", {}))
                yield make_event("complete", result=error_result)
                return
        
        module = load_module(module_path)
        module_name = module.get("name", name_or_path)
        
        # Validate input
        if validate_input and module.get("input_schema"):
            errors = validate_data(input_data, module["input_schema"], "Input")
            if errors:
                error_result = make_error_response(
                    code="INVALID_INPUT",
                    message=str(errors),
                    confidence=1.0,
                    risk="none"
                )
                yield make_event("error", error=error_result.get("error", {}))
                yield make_event("complete", result=error_result)
                return
        
        # Build prompt
        full_prompt = build_prompt(module, input_data, use_envelope=True, use_v22=use_v22)
        
        # Try streaming if provider supports it
        try:
            from .providers import call_llm_stream
            
            collected_chunks = []
            for chunk in call_llm_stream(full_prompt, model=model):
                collected_chunks.append(chunk)
                yield make_event("chunk", chunk=chunk)
            
            response = "".join(collected_chunks)
            
        except (ImportError, AttributeError):
            # Fallback to non-streaming
            response = call_llm(full_prompt, model=model)
            yield make_event("chunk", chunk=response)
        
        # Parse response
        try:
            output_data = parse_llm_response(response)
        except json.JSONDecodeError as e:
            error_result = make_error_response(
                code="PARSE_ERROR",
                message=f"Failed to parse JSON: {e}"
            )
            yield make_event("error", error=error_result.get("error", {}))
            yield make_event("complete", result=error_result)
            return
        
        # Convert to v2.2 envelope
        if is_v22_envelope(output_data):
            result = output_data
        elif is_envelope_response(output_data):
            result = wrap_v21_to_v22(output_data)
        else:
            result = convert_legacy_to_envelope(output_data)
        
        # Add version and meta
        result["version"] = ENVELOPE_VERSION
        latency_ms = (time.time() - start_time) * 1000
        if "meta" in result:
            result["meta"]["latency_ms"] = latency_ms
            if model:
                result["meta"]["model"] = model
            if trace_id:
                result["meta"]["trace_id"] = trace_id
            
            # Emit meta event early
            yield make_event("meta", meta=result["meta"])
        
        # Validate and repair
        if result.get("ok") and validate_output:
            data_schema = module.get("data_schema") or module.get("output_schema")
            meta_schema = module.get("meta_schema")
            meta_config = module.get("metadata", {}).get("meta", {})
            risk_rule = meta_config.get("risk_rule", "max_changes_risk")
            
            if data_schema:
                errors = validate_data(result.get("data", {}), data_schema, "Data")
                
                if errors and enable_repair:
                    result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                    result["version"] = ENVELOPE_VERSION
                    # Re-validate after repair
                    errors = validate_data(result.get("data", {}), data_schema, "Data")
                
                if errors:
                    error_result = make_error_response(
                        code="SCHEMA_VALIDATION_FAILED",
                        message=str(errors),
                        explain="Schema validation failed after repair attempt.",
                        partial_data=result.get("data"),
                        details={"validation_errors": errors}
                    )
                    yield make_event("error", error=error_result.get("error", {}))
                    yield make_event("complete", result=error_result)
                    return
            
            # Validate meta if schema exists
            if meta_schema:
                meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
                if meta_errors and enable_repair:
                    result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                    result["version"] = ENVELOPE_VERSION
                    meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
                    if meta_errors:
                        error_result = make_error_response(
                            code="META_VALIDATION_FAILED",
                            message=str(meta_errors),
                            explain="Meta validation failed after repair attempt.",
                            partial_data=result.get("data"),
                            details={"validation_errors": meta_errors}
                        )
                        yield make_event("error", error=error_result.get("error", {}))
                        yield make_event("complete", result=error_result)
                        return
        
        elif not result.get("ok") and enable_repair:
            result = repair_error_envelope(result)
            result["version"] = ENVELOPE_VERSION
        
        # Emit complete event
        yield make_event("complete", result=result)
        
    except Exception as e:
        error_result = make_error_response(
            code="UNKNOWN",
            message=str(e),
            explain=f"Unexpected error: {type(e).__name__}"
        )
        yield make_event("error", error=error_result.get("error", {}))
        yield make_event("complete", result=error_result)


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
