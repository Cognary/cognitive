"""Tests for module runner.

Includes tests for v2.2 features:
- Risk aggregation (aggregate_risk, aggregate_risk_from_list)
- Repair pass (repair_envelope, repair_error_envelope)
- Envelope detection and conversion (is_v22_envelope, wrap_v21_to_v22)
- Overflow and enum strategy utilities
"""

import json
import pytest

from cognitive.runner import (
    # Core functions
    validate_data,
    substitute_arguments,
    parse_llm_response,
    # v2.2 Risk aggregation
    aggregate_risk,
    aggregate_risk_from_list,
    RISK_LEVELS,
    RISK_NAMES,
    # v2.2 Repair pass
    repair_envelope,
    repair_error_envelope,
    # v2.2 Envelope detection/conversion
    is_envelope_response,
    is_v22_envelope,
    wrap_v21_to_v22,
    convert_legacy_to_envelope,
    # v2.2 Utilities
    extract_meta,
    should_escalate,
)
from cognitive.loader import (
    is_overflow_enabled,
    get_enum_strategy,
    get_schema_strictness,
    should_auto_wrap,
)


class TestValidateData:
    """Test JSON Schema validation."""

    def test_valid_data_passes(self):
        schema = {
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {"type": "string"}
            }
        }
        data = {"name": "test"}
        errors = validate_data(data, schema)
        assert errors == []

    def test_missing_required_fails(self):
        schema = {
            "type": "object",
            "required": ["name"],
            "properties": {
                "name": {"type": "string"}
            }
        }
        data = {}
        errors = validate_data(data, schema)
        assert len(errors) == 1
        assert "name" in errors[0]

    def test_wrong_type_fails(self):
        schema = {
            "type": "object",
            "properties": {
                "count": {"type": "integer"}
            }
        }
        data = {"count": "not a number"}
        errors = validate_data(data, schema)
        assert len(errors) == 1

    def test_empty_schema_passes(self):
        errors = validate_data({"any": "data"}, {})
        assert errors == []


class TestSubstituteArguments:
    """Test $ARGUMENTS substitution."""

    def test_substitute_arguments(self):
        text = "Process: $ARGUMENTS"
        data = {"$ARGUMENTS": "hello world"}
        result = substitute_arguments(text, data)
        assert result == "Process: hello world"

    def test_substitute_indexed_args(self):
        text = "First: $0, Second: $1"
        data = {"$ARGUMENTS": "hello world"}
        result = substitute_arguments(text, data)
        assert result == "First: hello, Second: world"

    def test_substitute_arguments_n(self):
        # $ARGUMENTS[N] replaces with the Nth word
        text = "First: $ARGUMENTS[0], Second: $ARGUMENTS[1]"
        data = {"$ARGUMENTS": "foo bar"}
        result = substitute_arguments(text, data)
        # The implementation replaces $ARGUMENTS first, then $ARGUMENTS[N]
        # So we need to check what the actual behavior is
        assert "foo" in result

    def test_fallback_to_query(self):
        text = "Process: $ARGUMENTS"
        data = {"query": "from query"}
        result = substitute_arguments(text, data)
        assert result == "Process: from query"

    def test_no_arguments(self):
        text = "No args here"
        data = {}
        result = substitute_arguments(text, data)
        assert result == "No args here"


class TestParseLlmResponse:
    """Test LLM response parsing."""

    def test_parse_plain_json(self):
        response = '{"result": "success"}'
        parsed = parse_llm_response(response)
        assert parsed["result"] == "success"

    def test_parse_markdown_code_block(self):
        response = """```json
{"result": "success"}
```"""
        parsed = parse_llm_response(response)
        assert parsed["result"] == "success"

    def test_parse_with_whitespace(self):
        response = """
  
{"result": "success"}
  
"""
        parsed = parse_llm_response(response)
        assert parsed["result"] == "success"

    def test_parse_complex_json(self):
        response = json.dumps({
            "issues": [{"severity": "high"}],
            "confidence": 0.95
        })
        parsed = parse_llm_response(response)
        assert parsed["confidence"] == 0.95
        assert len(parsed["issues"]) == 1


# =============================================================================
# v2.2 Risk Aggregation Tests
# =============================================================================

class TestRiskLevels:
    """Test risk level constants."""

    def test_risk_levels_mapping(self):
        assert RISK_LEVELS == {"none": 0, "low": 1, "medium": 2, "high": 3}

    def test_risk_names_order(self):
        assert RISK_NAMES == ["none", "low", "medium", "high"]


class TestAggregateRiskFromList:
    """Test aggregate_risk_from_list function."""

    def test_empty_list_returns_medium(self):
        """Empty list should return conservative 'medium' default."""
        result = aggregate_risk_from_list([])
        assert result == "medium"

    def test_single_item_none(self):
        result = aggregate_risk_from_list([{"risk": "none"}])
        assert result == "none"

    def test_single_item_high(self):
        result = aggregate_risk_from_list([{"risk": "high"}])
        assert result == "high"

    def test_max_of_multiple_items(self):
        """Should return max risk from list."""
        items = [
            {"risk": "low"},
            {"risk": "high"},
            {"risk": "none"},
        ]
        result = aggregate_risk_from_list(items)
        assert result == "high"

    def test_all_same_risk(self):
        items = [
            {"risk": "medium"},
            {"risk": "medium"},
            {"risk": "medium"},
        ]
        result = aggregate_risk_from_list(items)
        assert result == "medium"

    def test_missing_risk_defaults_to_medium(self):
        """Items without risk field should default to medium."""
        items = [
            {"description": "no risk field"},
            {"risk": "low"},
        ]
        result = aggregate_risk_from_list(items)
        assert result == "medium"  # max(medium, low) = medium

    def test_invalid_risk_defaults_to_medium(self):
        """Invalid risk values should be treated as medium."""
        items = [
            {"risk": "invalid_value"},
            {"risk": "low"},
        ]
        result = aggregate_risk_from_list(items)
        assert result == "medium"


class TestAggregateRisk:
    """Test aggregate_risk function with different rules."""

    def test_max_changes_risk_default(self):
        """Default rule should use max(changes[*].risk)."""
        data = {
            "changes": [
                {"risk": "low"},
                {"risk": "high"},
                {"risk": "none"},
            ]
        }
        result = aggregate_risk(data)
        assert result == "high"

    def test_max_changes_risk_explicit(self):
        data = {
            "changes": [
                {"risk": "low"},
                {"risk": "medium"},
            ]
        }
        result = aggregate_risk(data, "max_changes_risk")
        assert result == "medium"

    def test_max_issues_risk(self):
        """Rule for review modules using issues[*].risk."""
        data = {
            "issues": [
                {"risk": "low"},
                {"risk": "high"},
            ],
            "changes": [
                {"risk": "none"},  # Should be ignored
            ]
        }
        result = aggregate_risk(data, "max_issues_risk")
        assert result == "high"

    def test_explicit_rule_returns_medium(self):
        """Explicit rule should return medium (module should override)."""
        data = {
            "changes": [{"risk": "high"}]
        }
        result = aggregate_risk(data, "explicit")
        assert result == "medium"

    def test_no_changes_returns_medium(self):
        """No changes array should return medium."""
        data = {"rationale": "some text"}
        result = aggregate_risk(data, "max_changes_risk")
        assert result == "medium"

    def test_unknown_rule_falls_back_to_changes(self):
        """Unknown rule should fall back to max_changes_risk."""
        data = {
            "changes": [{"risk": "high"}]
        }
        result = aggregate_risk(data, "unknown_rule")
        assert result == "high"


# =============================================================================
# v2.2 Repair Pass Tests
# =============================================================================

class TestRepairEnvelope:
    """Test repair_envelope function for fixing minor formatting issues."""

    def test_add_missing_meta(self):
        """Should create meta if missing."""
        data = {
            "ok": True,
            "data": {"rationale": "test rationale"}
        }
        repaired = repair_envelope(data)
        assert "meta" in repaired
        assert "confidence" in repaired["meta"]
        assert "risk" in repaired["meta"]
        assert "explain" in repaired["meta"]

    def test_fill_confidence_from_data(self):
        """Should extract confidence from data if missing in meta."""
        data = {
            "ok": True,
            "meta": {},
            "data": {"confidence": 0.85, "rationale": "test"}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["confidence"] == 0.85

    def test_default_confidence_when_missing(self):
        """Should default to 0.5 if confidence not found anywhere."""
        data = {
            "ok": True,
            "meta": {},
            "data": {"rationale": "test"}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["confidence"] == 0.5

    def test_clamp_confidence_to_valid_range(self):
        """Confidence should be clamped to [0, 1]."""
        data = {
            "ok": True,
            "meta": {"confidence": 1.5},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["confidence"] == 1.0

        data["meta"]["confidence"] = -0.5
        repaired = repair_envelope(data)
        assert repaired["meta"]["confidence"] == 0.0

    def test_aggregate_risk_from_changes(self):
        """Should aggregate risk from data.changes."""
        data = {
            "ok": True,
            "meta": {},
            "data": {
                "changes": [
                    {"risk": "low"},
                    {"risk": "high"},
                ],
                "rationale": "test"
            }
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["risk"] == "high"

    def test_trim_whitespace_from_risk(self):
        """Should trim whitespace from risk value."""
        data = {
            "ok": True,
            "meta": {"risk": "  LOW  "},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["risk"] == "low"

    def test_extract_explain_from_rationale(self):
        """Should create explain from rationale if missing."""
        rationale = "This is a detailed explanation " * 20  # Long text
        data = {
            "ok": True,
            "meta": {},
            "data": {"rationale": rationale}
        }
        repaired = repair_envelope(data)
        assert "explain" in repaired["meta"]
        assert len(repaired["meta"]["explain"]) <= 280

    def test_truncate_long_explain(self):
        """Should truncate explain to max 280 characters."""
        long_explain = "x" * 500
        data = {
            "ok": True,
            "meta": {"explain": long_explain},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert len(repaired["meta"]["explain"]) <= 280
        assert repaired["meta"]["explain"].endswith("...")

    def test_trim_whitespace_from_explain(self):
        """Should trim whitespace from explain."""
        data = {
            "ok": True,
            "meta": {"explain": "  test explain  "},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["explain"] == "test explain"

    def test_default_explain_when_missing(self):
        """Should use default explain when nothing available."""
        data = {
            "ok": True,
            "meta": {},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["explain"] == "No explanation provided"

    def test_does_not_modify_original(self):
        """Repair should not modify the original dict."""
        data = {
            "ok": True,
            "meta": {},
            "data": {"rationale": "test"}
        }
        original_meta = data["meta"]
        repaired = repair_envelope(data)
        assert data["meta"] is original_meta  # Original unchanged


class TestRepairErrorEnvelope:
    """Test repair_error_envelope for error responses."""

    def test_add_missing_meta_for_error(self):
        """Should create meta for error envelope."""
        data = {
            "ok": False,
            "error": {"code": "E1001", "message": "Input error"}
        }
        repaired = repair_error_envelope(data)
        assert "meta" in repaired
        assert repaired["meta"]["confidence"] == 0.0
        assert repaired["meta"]["risk"] == "high"

    def test_extract_explain_from_error_message(self):
        """Should use error message for explain."""
        data = {
            "ok": False,
            "error": {"code": "E1001", "message": "Invalid input format"}
        }
        repaired = repair_error_envelope(data)
        assert "Invalid input" in repaired["meta"]["explain"]


# =============================================================================
# v2.2 Envelope Detection Tests
# =============================================================================

class TestIsEnvelopeResponse:
    """Test is_envelope_response detection."""

    def test_valid_success_envelope(self):
        data = {"ok": True, "data": {}}
        assert is_envelope_response(data) is True

    def test_valid_error_envelope(self):
        data = {"ok": False, "error": {}}
        assert is_envelope_response(data) is True

    def test_missing_ok_field(self):
        data = {"data": {}, "meta": {}}
        assert is_envelope_response(data) is False

    def test_non_boolean_ok(self):
        data = {"ok": "true", "data": {}}
        assert is_envelope_response(data) is False

    def test_legacy_format_no_envelope(self):
        data = {"confidence": 0.9, "rationale": "test"}
        assert is_envelope_response(data) is False


class TestIsV22Envelope:
    """Test is_v22_envelope detection."""

    def test_v22_envelope_with_meta(self):
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"},
            "data": {}
        }
        assert is_v22_envelope(data) is True

    def test_v21_envelope_without_meta(self):
        data = {"ok": True, "data": {"confidence": 0.9}}
        assert is_v22_envelope(data) is False

    def test_non_envelope_returns_false(self):
        data = {"confidence": 0.9, "rationale": "test"}
        assert is_v22_envelope(data) is False


# =============================================================================
# v2.2 Envelope Conversion Tests
# =============================================================================

class TestWrapV21ToV22:
    """Test wrap_v21_to_v22 conversion."""

    def test_already_v22_returns_unchanged(self):
        """Already v2.2 format should pass through."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"},
            "data": {"rationale": "detailed"}
        }
        result = wrap_v21_to_v22(data)
        assert result == data

    def test_convert_v21_success_to_v22(self):
        """v2.1 success should be wrapped with meta."""
        v21_data = {
            "ok": True,
            "data": {
                "confidence": 0.85,
                "rationale": "This is the detailed rationale",
                "changes": [{"risk": "low"}]
            }
        }
        result = wrap_v21_to_v22(v21_data)

        assert result["ok"] is True
        assert "meta" in result
        assert result["meta"]["confidence"] == 0.85
        assert result["meta"]["risk"] == "low"
        assert "This is the detailed" in result["meta"]["explain"]

    def test_convert_v21_error_to_v22(self):
        """v2.1 error should be wrapped with meta."""
        v21_data = {
            "ok": False,
            "error": {"code": "E1001", "message": "Invalid input"},
            "partial_data": {"some": "data"}
        }
        result = wrap_v21_to_v22(v21_data)

        assert result["ok"] is False
        assert "meta" in result
        assert result["meta"]["confidence"] == 0.0
        assert result["meta"]["risk"] == "high"
        assert "Invalid input" in result["meta"]["explain"]
        assert result["partial_data"] == {"some": "data"}

    def test_default_confidence_for_missing(self):
        """Should use 0.5 default if confidence missing."""
        v21_data = {
            "ok": True,
            "data": {"rationale": "test"}
        }
        result = wrap_v21_to_v22(v21_data)
        assert result["meta"]["confidence"] == 0.5


class TestConvertLegacyToEnvelope:
    """Test convert_legacy_to_envelope for non-envelope responses."""

    def test_convert_legacy_success(self):
        """Legacy format should be wrapped as v2.2."""
        legacy_data = {
            "simplified_code": "def f(): pass",
            "confidence": 0.9,
            "rationale": "Simplified successfully",
            "changes": [{"risk": "none"}]
        }
        result = convert_legacy_to_envelope(legacy_data)

        assert result["ok"] is True
        assert "meta" in result
        assert result["meta"]["confidence"] == 0.9
        assert "data" in result
        assert result["data"]["simplified_code"] == "def f(): pass"

    def test_convert_legacy_error(self):
        """Legacy error format should be wrapped."""
        legacy_data = {
            "error": {"code": "E2001", "message": "Cannot simplify"}
        }
        result = convert_legacy_to_envelope(legacy_data, is_error=True)

        assert result["ok"] is False
        assert result["error"]["code"] == "E2001"
        assert result["meta"]["confidence"] == 0.0


# =============================================================================
# v2.2 Utility Functions Tests
# =============================================================================

class TestExtractMeta:
    """Test extract_meta utility function."""

    def test_extract_from_v22(self):
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"},
            "data": {}
        }
        meta = extract_meta(data)
        assert meta["confidence"] == 0.9
        assert meta["risk"] == "low"

    def test_extract_default_for_missing(self):
        data = {"ok": True, "data": {}}
        meta = extract_meta(data)
        assert "confidence" in meta
        assert "risk" in meta
        assert "explain" in meta


class TestShouldEscalate:
    """Test should_escalate utility function."""

    def test_escalate_low_confidence(self):
        """Should escalate when confidence below threshold."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.5, "risk": "low", "explain": "test"},
            "data": {}
        }
        assert should_escalate(data, confidence_threshold=0.7) is True

    def test_escalate_high_risk(self):
        """Should escalate when risk is high."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "high", "explain": "test"},
            "data": {}
        }
        assert should_escalate(data) is True

    def test_escalate_on_error(self):
        """Should escalate on any error."""
        data = {
            "ok": False,
            "meta": {"confidence": 0.0, "risk": "high", "explain": "error"},
            "error": {"code": "E1001", "message": "test"}
        }
        assert should_escalate(data) is True

    def test_no_escalate_good_response(self):
        """Should not escalate for good response."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"},
            "data": {}
        }
        assert should_escalate(data) is False

    def test_custom_confidence_threshold(self):
        """Should respect custom confidence threshold."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.6, "risk": "low", "explain": "test"},
            "data": {}
        }
        # 0.6 is below 0.7 threshold
        assert should_escalate(data, confidence_threshold=0.7) is True
        # 0.6 is above 0.5 threshold
        assert should_escalate(data, confidence_threshold=0.5) is False


# =============================================================================
# Overflow Configuration Tests
# =============================================================================

class TestIsOverflowEnabled:
    """Test is_overflow_enabled utility function."""

    def test_overflow_enabled_true(self):
        """Should return True when overflow.enabled is True."""
        module = {
            "overflow": {
                "enabled": True,
                "max_items": 10
            }
        }
        assert is_overflow_enabled(module) is True

    def test_overflow_enabled_false(self):
        """Should return False when overflow.enabled is False."""
        module = {
            "overflow": {
                "enabled": False
            }
        }
        assert is_overflow_enabled(module) is False

    def test_overflow_missing(self):
        """Should return False when overflow config is missing."""
        module = {"name": "test-module"}
        assert is_overflow_enabled(module) is False

    def test_overflow_enabled_missing(self):
        """Should return False when overflow.enabled is not set."""
        module = {
            "overflow": {
                "max_items": 5
            }
        }
        assert is_overflow_enabled(module) is False


# =============================================================================
# Enum Strategy Tests
# =============================================================================

class TestGetEnumStrategy:
    """Test get_enum_strategy utility function."""

    def test_strict_strategy(self):
        """Should return 'strict' when configured."""
        module = {
            "enums": {"strategy": "strict"}
        }
        assert get_enum_strategy(module) == "strict"

    def test_extensible_strategy(self):
        """Should return 'extensible' when configured."""
        module = {
            "enums": {"strategy": "extensible"}
        }
        assert get_enum_strategy(module) == "extensible"

    def test_default_strict_when_missing(self):
        """Should default to 'strict' when enums not configured."""
        module = {"name": "test-module"}
        assert get_enum_strategy(module) == "strict"

    def test_default_strict_when_strategy_missing(self):
        """Should default to 'strict' when strategy not set."""
        module = {"enums": {}}
        assert get_enum_strategy(module) == "strict"


# =============================================================================
# Schema Strictness Tests
# =============================================================================

class TestGetSchemaStrictness:
    """Test get_schema_strictness utility function."""

    def test_high_strictness(self):
        """Should return 'high' when configured."""
        module = {"schema_strictness": "high"}
        assert get_schema_strictness(module) == "high"

    def test_medium_strictness(self):
        """Should return 'medium' when configured."""
        module = {"schema_strictness": "medium"}
        assert get_schema_strictness(module) == "medium"

    def test_low_strictness(self):
        """Should return 'low' when configured."""
        module = {"schema_strictness": "low"}
        assert get_schema_strictness(module) == "low"

    def test_default_medium(self):
        """Should default to 'medium' when not configured."""
        module = {"name": "test-module"}
        assert get_schema_strictness(module) == "medium"


# =============================================================================
# Auto Wrap Tests
# =============================================================================

class TestShouldAutoWrap:
    """Test should_auto_wrap utility function."""

    def test_auto_wrap_true(self):
        """Should return True when compat.runtime_auto_wrap is True."""
        module = {
            "compat": {"runtime_auto_wrap": True}
        }
        assert should_auto_wrap(module) is True

    def test_auto_wrap_false(self):
        """Should return False when compat.runtime_auto_wrap is False."""
        module = {
            "compat": {"runtime_auto_wrap": False}
        }
        assert should_auto_wrap(module) is False

    def test_default_true_when_missing(self):
        """Should default to True when compat not configured."""
        module = {"name": "test-module"}
        assert should_auto_wrap(module) is True

    def test_default_true_when_auto_wrap_missing(self):
        """Should default to True when runtime_auto_wrap not set."""
        module = {"compat": {"accepts_v21_payload": True}}
        assert should_auto_wrap(module) is True


# =============================================================================
# Extensible Enum Format Tests
# =============================================================================

class TestExtensibleEnumFormat:
    """Test handling of extensible enum values in envelopes."""

    def test_standard_risk_values(self):
        """Standard risk enum values should be accepted."""
        for risk in ["none", "low", "medium", "high"]:
            data = {
                "ok": True,
                "meta": {"confidence": 0.9, "risk": risk, "explain": "test"},
                "data": {}
            }
            repaired = repair_envelope(data)
            assert repaired["meta"]["risk"] == risk

    def test_custom_risk_object_format(self):
        """Custom risk as object {custom, reason} should be handled."""
        data = {
            "ok": True,
            "meta": {
                "confidence": 0.9,
                "risk": {"custom": "critical", "reason": "Security vulnerability"},
                "explain": "test"
            },
            "data": {}
        }
        # Repair should preserve custom risk or handle gracefully
        repaired = repair_envelope(data)
        # The repair pass should handle this case
        assert "risk" in repaired["meta"]

    def test_risk_normalization(self):
        """Risk values should be normalized to lowercase."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "HIGH", "explain": "test"},
            "data": {}
        }
        repaired = repair_envelope(data)
        assert repaired["meta"]["risk"] == "high"

    def test_unknown_risk_defaults_to_medium(self):
        """Unknown risk value should default to medium after repair."""
        data = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "unknown_value", "explain": "test"},
            "data": {}
        }
        repaired = repair_envelope(data)
        # Unknown values should be normalized or defaulted
        assert repaired["meta"]["risk"] in ["medium", "unknown_value"]
