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
import base64
import mimetypes
from pathlib import Path
from typing import Optional, TypedDict, Union, Literal, Callable, AsyncIterator
from dataclasses import dataclass, field
from urllib.request import urlopen
from urllib.error import URLError

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
        
        return {
            "ok": True,
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
        
        return {
            "ok": True,
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
        
        # Get risk_rule from module.yaml meta config
        meta_config = module.get("metadata", {}).get("meta", {})
        risk_rule = meta_config.get("risk_rule", "max_changes_risk")
        
        if data_schema:
            data_to_validate = result.get("data", {})
            errors = validate_data(data_to_validate, data_schema, "Data")
            
            if errors and enable_repair:
                # Attempt repair pass
                result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                
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
                result = repair_envelope(result, meta_schema, risk_rule=risk_rule)
                # Re-validate meta after repair
                meta_errors = validate_data(result.get("meta", {}), meta_schema, "Meta")
                if meta_errors:
                    # Meta validation failed after repair attempt
                    return {
                        "ok": False,
                        "meta": {
                            "confidence": 0.0,
                            "risk": "high",
                            "explain": "Meta schema validation failed after repair attempt."
                        },
                        "error": {"code": "META_VALIDATION_FAILED", "message": str(meta_errors)},
                        "partial_data": result.get("data")
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


# =============================================================================
# v2.5 Streaming Support
# =============================================================================

import uuid
from typing import AsyncIterator, Iterator, Any, Callable
from dataclasses import dataclass, field


@dataclass
class StreamingSession:
    """Represents an active streaming session."""
    session_id: str
    module_name: str
    started_at: float = field(default_factory=lambda: __import__('time').time())
    chunks_sent: int = 0
    accumulated_data: dict = field(default_factory=dict)
    accumulated_text: dict = field(default_factory=dict)  # field -> accumulated string


def create_session_id() -> str:
    """Generate a unique session ID for streaming."""
    return f"sess_{uuid.uuid4().hex[:12]}"


def create_meta_chunk(session_id: str, initial_risk: str = "low") -> dict:
    """Create the initial meta chunk for streaming."""
    return {
        "ok": True,
        "streaming": True,
        "session_id": session_id,
        "meta": {
            "confidence": None,
            "risk": initial_risk,
            "explain": "Processing..."
        }
    }


def create_delta_chunk(seq: int, field: str, delta: str) -> dict:
    """Create a delta chunk for incremental content."""
    return {
        "chunk": {
            "seq": seq,
            "type": "delta",
            "field": field,
            "delta": delta
        }
    }


def create_snapshot_chunk(seq: int, field: str, data: Any) -> dict:
    """Create a snapshot chunk for full field replacement."""
    return {
        "chunk": {
            "seq": seq,
            "type": "snapshot",
            "field": field,
            "data": data
        }
    }


def create_progress_chunk(percent: int, stage: str = "", message: str = "") -> dict:
    """Create a progress update chunk."""
    return {
        "progress": {
            "percent": percent,
            "stage": stage,
            "message": message
        }
    }


def create_final_chunk(meta: dict, data: dict, usage: dict = None) -> dict:
    """Create the final chunk with complete data."""
    chunk = {
        "final": True,
        "meta": meta,
        "data": data
    }
    if usage:
        chunk["usage"] = usage
    return chunk


def create_error_chunk(session_id: str, error_code: str, message: str, 
                       recoverable: bool = False, partial_data: dict = None) -> dict:
    """Create an error chunk for stream failures."""
    chunk = {
        "ok": False,
        "streaming": True,
        "session_id": session_id,
        "error": {
            "code": error_code,
            "message": message,
            "recoverable": recoverable
        }
    }
    if partial_data:
        chunk["partial_data"] = partial_data
    return chunk


def assemble_streamed_data(session: StreamingSession) -> dict:
    """Assemble accumulated streaming data into final format."""
    data = session.accumulated_data.copy()
    
    # Merge accumulated text fields
    for field_path, text in session.accumulated_text.items():
        parts = field_path.split(".")
        target = data
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        target[parts[-1]] = text
    
    return data


class StreamingRunner:
    """Runner with streaming support for v2.5 modules."""
    
    def __init__(self, provider_callback: Callable = None):
        """
        Initialize streaming runner.
        
        Args:
            provider_callback: Function to call LLM with streaming support.
                              Signature: async (prompt, images=None) -> AsyncIterator[str]
        """
        self.provider_callback = provider_callback or self._default_provider
        self.active_sessions: dict[str, StreamingSession] = {}
    
    async def _default_provider(self, prompt: str, images: list = None) -> AsyncIterator[str]:
        """Default provider - yields entire response at once (for testing)."""
        # In real implementation, this would stream from LLM
        yield '{"ok": true, "meta": {"confidence": 0.9, "risk": "low", "explain": "Test"}, "data": {"rationale": "Test response"}}'
    
    async def execute_stream(
        self,
        module_name: str,
        input_data: dict,
        on_chunk: Callable[[dict], None] = None
    ) -> AsyncIterator[dict]:
        """
        Execute a module with streaming output.
        
        Args:
            module_name: Name of the module to execute
            input_data: Input data including multimodal content
            on_chunk: Optional callback for each chunk
        
        Yields:
            Streaming chunks (meta, delta, progress, final, or error)
        """
        session_id = create_session_id()
        session = StreamingSession(session_id=session_id, module_name=module_name)
        self.active_sessions[session_id] = session
        
        try:
            # Load module
            module = load_module(module_name)
            
            # Check if module supports streaming
            response_config = module.get("response", {})
            mode = response_config.get("mode", "sync")
            if mode not in ("streaming", "both"):
                # Fall back to sync execution
                result = await self._execute_sync(module, input_data)
                yield create_meta_chunk(session_id)
                yield create_final_chunk(result["meta"], result["data"])
                return
            
            # Extract images for multimodal
            images = self._extract_media(input_data)
            
            # Build prompt
            prompt = self._build_prompt(module, input_data)
            
            # Send initial meta chunk
            meta_chunk = create_meta_chunk(session_id)
            if on_chunk:
                on_chunk(meta_chunk)
            yield meta_chunk
            
            # Stream from LLM
            seq = 1
            accumulated_response = ""
            
            async for text_chunk in self.provider_callback(prompt, images):
                accumulated_response += text_chunk
                
                # Create delta chunk for rationale field
                delta_chunk = create_delta_chunk(seq, "data.rationale", text_chunk)
                session.chunks_sent += 1
                session.accumulated_text.setdefault("data.rationale", "")
                session.accumulated_text["data.rationale"] += text_chunk
                
                if on_chunk:
                    on_chunk(delta_chunk)
                yield delta_chunk
                seq += 1
            
            # Parse final response
            try:
                final_data = parse_llm_response(accumulated_response)
                final_data = repair_envelope(final_data)
            except Exception as e:
                error_chunk = create_error_chunk(
                    session_id, "E2001", str(e), 
                    recoverable=False,
                    partial_data={"rationale": session.accumulated_text.get("data.rationale", "")}
                )
                yield error_chunk
                return
            
            # Send final chunk
            final_chunk = create_final_chunk(
                final_data.get("meta", {}),
                final_data.get("data", {}),
                {"input_tokens": 0, "output_tokens": seq}  # Placeholder
            )
            if on_chunk:
                on_chunk(final_chunk)
            yield final_chunk
            
        except Exception as e:
            error_chunk = create_error_chunk(
                session_id, "E2010", f"Stream error: {str(e)}",
                recoverable=False
            )
            yield error_chunk
        finally:
            del self.active_sessions[session_id]
    
    async def _execute_sync(self, module: dict, input_data: dict) -> dict:
        """Execute module synchronously (fallback)."""
        # Use existing sync execution
        return run_module(module["name"], input_data)
    
    def _build_prompt(self, module: dict, input_data: dict) -> str:
        """Build prompt from module and input."""
        prompt_template = module.get("prompt", "")
        return substitute_arguments(prompt_template, input_data)
    
    def _extract_media(self, input_data: dict) -> list:
        """Extract media inputs from input data."""
        images = input_data.get("images", [])
        audio = input_data.get("audio", [])
        video = input_data.get("video", [])
        return images + audio + video


# =============================================================================
# v2.5 Multimodal Support
# =============================================================================

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif"
}

SUPPORTED_AUDIO_TYPES = {
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"
}

SUPPORTED_VIDEO_TYPES = {
    "video/mp4", "video/webm", "video/quicktime"
}

# Magic bytes for media type detection
MEDIA_MAGIC_BYTES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],  # Check WEBP signature later
    "audio/mpeg": [b"\xff\xfb", b"\xff\xfa", b"ID3"],
    "audio/wav": [b"RIFF"],  # Check WAVE signature later
    "audio/ogg": [b"OggS"],
    "video/mp4": [b"\x00\x00\x00"],  # ftyp check needed
    "video/webm": [b"\x1a\x45\xdf\xa3"],
    "application/pdf": [b"%PDF"],
}

# Media size limits in bytes
MEDIA_SIZE_LIMITS = {
    "image": 20 * 1024 * 1024,   # 20MB
    "audio": 25 * 1024 * 1024,   # 25MB
    "video": 100 * 1024 * 1024,  # 100MB
    "document": 50 * 1024 * 1024,  # 50MB
}

# Media dimension limits
MEDIA_DIMENSION_LIMITS = {
    "max_width": 8192,
    "max_height": 8192,
    "min_width": 10,
    "min_height": 10,
    "max_pixels": 67108864,  # 8192 x 8192
}

# v2.5 Error codes
ERROR_CODES_V25 = {
    "UNSUPPORTED_MEDIA_TYPE": "E1010",
    "MEDIA_TOO_LARGE": "E1011",
    "MEDIA_FETCH_FAILED": "E1012",
    "MEDIA_DECODE_FAILED": "E1013",
    "MEDIA_TYPE_MISMATCH": "E1014",
    "MEDIA_DIMENSION_EXCEEDED": "E1015",
    "MEDIA_DIMENSION_TOO_SMALL": "E1016",
    "MEDIA_PIXEL_LIMIT": "E1017",
    "UPLOAD_EXPIRED": "E1018",
    "UPLOAD_NOT_FOUND": "E1019",
    "CHECKSUM_MISMATCH": "E1020",
    "STREAM_INTERRUPTED": "E2010",
    "STREAM_TIMEOUT": "E2011",
    "STREAMING_NOT_SUPPORTED": "E4010",
    "MULTIMODAL_NOT_SUPPORTED": "E4011",
    "RECOVERY_NOT_SUPPORTED": "E4012",
    "SESSION_EXPIRED": "E4013",
    "CHECKPOINT_INVALID": "E4014",
}


def detect_media_type_from_magic(data: bytes) -> str | None:
    """Detect media type from magic bytes."""
    for mime_type, magic_list in MEDIA_MAGIC_BYTES.items():
        for magic in magic_list:
            if data.startswith(magic):
                # Special handling for RIFF-based formats
                if magic == b"RIFF" and len(data) >= 12:
                    if data[8:12] == b"WEBP":
                        return "image/webp"
                    elif data[8:12] == b"WAVE":
                        return "audio/wav"
                    continue
                # Special handling for MP4 (check for ftyp)
                if mime_type == "video/mp4" and len(data) >= 8:
                    if b"ftyp" in data[4:8]:
                        return "video/mp4"
                    continue
                return mime_type
    return None


def validate_media_magic_bytes(data: bytes, declared_type: str) -> tuple[bool, str]:
    """
    Validate that media content matches declared MIME type.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    detected_type = detect_media_type_from_magic(data)
    
    if detected_type is None:
        return True, ""  # Can't detect, assume valid
    
    # Normalize types for comparison
    declared_category = declared_type.split("/")[0]
    detected_category = detected_type.split("/")[0]
    
    if declared_category != detected_category:
        return False, f"Media content mismatch: declared {declared_type}, detected {detected_type}"
    
    return True, ""


def validate_image_dimensions(data: bytes) -> tuple[int, int] | None:
    """
    Extract image dimensions from raw bytes.
    
    Returns:
        Tuple of (width, height) or None if cannot determine.
    """
    try:
        # PNG dimensions at bytes 16-24
        if data.startswith(b"\x89PNG"):
            width = int.from_bytes(data[16:20], "big")
            height = int.from_bytes(data[20:24], "big")
            return (width, height)
        
        # JPEG - need to parse markers
        if data.startswith(b"\xff\xd8"):
            i = 2
            while i < len(data) - 8:
                if data[i] != 0xff:
                    break
                marker = data[i + 1]
                if marker in (0xc0, 0xc1, 0xc2):  # SOF markers
                    height = int.from_bytes(data[i + 5:i + 7], "big")
                    width = int.from_bytes(data[i + 7:i + 9], "big")
                    return (width, height)
                length = int.from_bytes(data[i + 2:i + 4], "big")
                i += 2 + length
        
        # GIF dimensions at bytes 6-10
        if data.startswith(b"GIF"):
            width = int.from_bytes(data[6:8], "little")
            height = int.from_bytes(data[8:10], "little")
            return (width, height)
        
    except Exception:
        pass
    
    return None


def validate_media_input(media: dict, constraints: dict = None) -> tuple[bool, str, str | None]:
    """
    Validate a media input object with enhanced v2.5 validation.
    
    Returns:
        Tuple of (is_valid, error_message, error_code)
    """
    constraints = constraints or {}
    
    media_type = media.get("type")
    if media_type not in ("url", "base64", "file", "upload_ref"):
        return False, "Invalid media type. Must be url, base64, file, or upload_ref", None
    
    if media_type == "url":
        url = media.get("url")
        if not url:
            return False, "URL media missing 'url' field", None
        if not url.startswith(("http://", "https://")):
            return False, "URL must start with http:// or https://", None
    
    elif media_type == "base64":
        mime_type = media.get("media_type")
        if not mime_type:
            return False, "Base64 media missing 'media_type' field", None
        data = media.get("data")
        if not data:
            return False, "Base64 media missing 'data' field", None
        
        # Validate base64 and decode
        try:
            decoded = base64.b64decode(data)
        except Exception:
            return False, "Invalid base64 encoding", ERROR_CODES_V25["MEDIA_DECODE_FAILED"]
        
        # Check size
        category = mime_type.split("/")[0]
        max_size = constraints.get("max_size_bytes", MEDIA_SIZE_LIMITS.get(category, 20 * 1024 * 1024))
        if len(decoded) > max_size:
            return False, f"Media exceeds size limit ({len(decoded)} > {max_size} bytes)", ERROR_CODES_V25["MEDIA_TOO_LARGE"]
        
        # Validate magic bytes
        is_valid, error = validate_media_magic_bytes(decoded, mime_type)
        if not is_valid:
            return False, error, ERROR_CODES_V25["MEDIA_TYPE_MISMATCH"]
        
        # Validate image dimensions if applicable
        if category == "image":
            dimensions = validate_image_dimensions(decoded)
            if dimensions:
                width, height = dimensions
                limits = MEDIA_DIMENSION_LIMITS
                
                if width > limits["max_width"] or height > limits["max_height"]:
                    return False, f"Image dimensions ({width}x{height}) exceed maximum ({limits['max_width']}x{limits['max_height']})", ERROR_CODES_V25["MEDIA_DIMENSION_EXCEEDED"]
                
                if width < limits["min_width"] or height < limits["min_height"]:
                    return False, f"Image dimensions ({width}x{height}) below minimum ({limits['min_width']}x{limits['min_height']})", ERROR_CODES_V25["MEDIA_DIMENSION_TOO_SMALL"]
                
                if width * height > limits["max_pixels"]:
                    return False, f"Image pixel count ({width * height}) exceeds maximum ({limits['max_pixels']})", ERROR_CODES_V25["MEDIA_PIXEL_LIMIT"]
        
        # Validate checksum if provided
        checksum = media.get("checksum")
        if checksum:
            import hashlib
            algorithm = checksum.get("algorithm", "sha256")
            expected = checksum.get("value", "")
            
            if algorithm == "sha256":
                actual = hashlib.sha256(decoded).hexdigest()
            elif algorithm == "md5":
                actual = hashlib.md5(decoded).hexdigest()
            elif algorithm == "crc32":
                import zlib
                actual = format(zlib.crc32(decoded) & 0xffffffff, '08x')
            else:
                return False, f"Unsupported checksum algorithm: {algorithm}", None
            
            if actual.lower() != expected.lower():
                return False, f"Checksum mismatch: expected {expected}, got {actual}", ERROR_CODES_V25["CHECKSUM_MISMATCH"]
    
    elif media_type == "file":
        path = media.get("path")
        if not path:
            return False, "File media missing 'path' field", None
        if not Path(path).exists():
            return False, f"File not found: {path}", None
        
        # Check file size
        file_size = Path(path).stat().st_size
        mime, _ = mimetypes.guess_type(str(path))
        if mime:
            category = mime.split("/")[0]
            max_size = constraints.get("max_size_bytes", MEDIA_SIZE_LIMITS.get(category, 20 * 1024 * 1024))
            if file_size > max_size:
                return False, f"File exceeds size limit ({file_size} > {max_size} bytes)", ERROR_CODES_V25["MEDIA_TOO_LARGE"]
    
    elif media_type == "upload_ref":
        upload_id = media.get("upload_id")
        if not upload_id:
            return False, "Upload reference missing 'upload_id' field", None
        # Note: Actual upload validation would require backend lookup
    
    return True, "", None


def load_media_as_base64(media: dict) -> tuple[str, str]:
    """
    Load media from any source and return as base64.
    
    Returns:
        Tuple of (base64_data, media_type)
    """
    media_type = media.get("type")
    
    if media_type == "base64":
        return media["data"], media["media_type"]
    
    elif media_type == "url":
        url = media["url"]
        try:
            with urlopen(url, timeout=30) as response:
                data = response.read()
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                # Extract just the mime type (remove charset etc)
                content_type = content_type.split(";")[0].strip()
                return base64.b64encode(data).decode("utf-8"), content_type
        except URLError as e:
            raise ValueError(f"Failed to fetch media from URL: {e}")
    
    elif media_type == "file":
        path = Path(media["path"])
        if not path.exists():
            raise ValueError(f"File not found: {path}")
        
        mime_type, _ = mimetypes.guess_type(str(path))
        mime_type = mime_type or "application/octet-stream"
        
        with open(path, "rb") as f:
            data = f.read()
        
        return base64.b64encode(data).decode("utf-8"), mime_type
    
    raise ValueError(f"Unknown media type: {media_type}")


def prepare_media_for_llm(media_list: list, provider: str = "openai") -> list:
    """
    Prepare media inputs for specific LLM provider format.
    
    Different providers have different multimodal input formats:
    - OpenAI: {"type": "image_url", "image_url": {"url": "data:..."}}
    - Anthropic: {"type": "image", "source": {"type": "base64", ...}}
    - Google: {"inlineData": {"mimeType": "...", "data": "..."}}
    """
    prepared = []
    
    for media in media_list:
        data, mime_type = load_media_as_base64(media)
        
        if provider == "openai":
            prepared.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime_type};base64,{data}"
                }
            })
        elif provider == "anthropic":
            prepared.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": data
                }
            })
        elif provider == "google":
            prepared.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": data
                }
            })
        else:
            # Generic format
            prepared.append({
                "type": "base64",
                "media_type": mime_type,
                "data": data
            })
    
    return prepared


def get_modalities_config(module: dict) -> dict:
    """Get modalities configuration from module."""
    return module.get("modalities", {
        "input": ["text"],
        "output": ["text"]
    })


def supports_multimodal_input(module: dict) -> bool:
    """Check if module supports multimodal input."""
    modalities = get_modalities_config(module)
    input_modalities = modalities.get("input", ["text"])
    return any(m in input_modalities for m in ["image", "audio", "video"])


def supports_multimodal_output(module: dict) -> bool:
    """Check if module supports multimodal output."""
    modalities = get_modalities_config(module)
    output_modalities = modalities.get("output", ["text"])
    return any(m in output_modalities for m in ["image", "audio", "video"])


def validate_multimodal_input(input_data: dict, module: dict) -> tuple[bool, list[str]]:
    """
    Validate multimodal input against module configuration.
    
    Returns:
        Tuple of (is_valid, list of errors)
    """
    errors = []
    modalities = get_modalities_config(module)
    input_modalities = set(modalities.get("input", ["text"]))
    constraints = modalities.get("constraints", {})
    
    # Check images
    images = input_data.get("images", [])
    if images:
        if "image" not in input_modalities:
            errors.append("Module does not support image input")
        else:
            max_images = constraints.get("max_images", 10)
            if len(images) > max_images:
                errors.append(f"Too many images ({len(images)} > {max_images})")
            
            for i, img in enumerate(images):
                valid, err = validate_media_input(img, constraints)
                if not valid:
                    errors.append(f"Image {i}: {err}")
    
    # Check audio
    audio = input_data.get("audio", [])
    if audio:
        if "audio" not in input_modalities:
            errors.append("Module does not support audio input")
    
    # Check video
    video = input_data.get("video", [])
    if video:
        if "video" not in input_modalities:
            errors.append("Module does not support video input")
    
    return len(errors) == 0, errors


# =============================================================================
# v2.5 Runtime Capabilities
# =============================================================================

def get_runtime_capabilities() -> dict:
    """Get runtime capabilities for v2.5."""
    return {
        "runtime": "cognitive-runtime-python",
        "version": "2.5.0",
        "spec_version": "2.5",
        "capabilities": {
            "streaming": True,
            "multimodal": {
                "input": ["image"],  # Basic image support
                "output": []  # No generation yet
            },
            "max_media_size_mb": 20,
            "supported_transports": ["ndjson"],  # SSE requires async server
            "conformance_level": 4
        }
    }
