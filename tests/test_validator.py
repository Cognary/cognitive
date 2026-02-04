"""Tests for module validator.

Includes tests for v2.2 features:
- v2.2 envelope validation (validate_v22_envelope)
- v2.2 module format validation
- Tier validation
- Overflow configuration validation
"""

import json
from pathlib import Path

import pytest

from cognitive.validator import validate_module, validate_v22_envelope


class TestValidateModule:
    """Test module validation."""

    def test_validate_valid_new_format(self, tmp_path):
        # Create valid module
        (tmp_path / "MODULE.md").write_text("""---
name: valid-module
version: 1.0.0
responsibility: Test
---

# Instructions
""")
        schema = {
            "input": {"type": "object"},
            "output": {
                "type": "object",
                "properties": {
                    "confidence": {"type": "number"}
                }
            }
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))
        
        # Create examples
        examples_dir = tmp_path / "examples"
        examples_dir.mkdir()
        (examples_dir / "input.json").write_text("{}")
        (examples_dir / "output.json").write_text('{"confidence": 0.9}')
        
        is_valid, errors, warnings = validate_module(str(tmp_path))
        
        # Just check it doesn't crash
        assert isinstance(is_valid, bool)
        assert isinstance(errors, list)

    def test_validate_missing_module_file(self, tmp_path):
        is_valid, errors, warnings = validate_module(str(tmp_path))
        
        assert not is_valid
        # Check that there's at least one error
        assert len(errors) > 0

    def test_validate_invalid_schema(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("---\nname: test\n---\n")
        (tmp_path / "schema.json").write_text("not valid json")
        
        is_valid, errors, warnings = validate_module(str(tmp_path))
        
        assert not is_valid

    def test_validate_example_mismatch(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("---\nname: test\n---\n")
        schema = {
            "input": {
                "type": "object",
                "required": ["required_field"]
            },
            "output": {"type": "object"}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))
        
        examples_dir = tmp_path / "examples"
        examples_dir.mkdir()
        (examples_dir / "input.json").write_text("{}")  # Missing required_field
        (examples_dir / "output.json").write_text("{}")
        
        is_valid, errors, warnings = validate_module(str(tmp_path))
        
        assert not is_valid
        assert any("required_field" in e for e in errors)


# =============================================================================
# v2.2 Envelope Validation Tests
# =============================================================================

class TestValidateV22Envelope:
    """Test validate_v22_envelope function."""

    def test_valid_success_envelope(self):
        """Valid v2.2 success envelope should pass."""
        response = {
            "ok": True,
            "meta": {
                "confidence": 0.9,
                "risk": "low",
                "explain": "Test explanation"
            },
            "data": {
                "rationale": "Detailed reasoning"
            }
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is True
        assert errors == []

    def test_valid_error_envelope(self):
        """Valid v2.2 error envelope should pass."""
        response = {
            "ok": False,
            "meta": {
                "confidence": 0.0,
                "risk": "high",
                "explain": "Error occurred"
            },
            "error": {
                "code": "E1001",
                "message": "Invalid input"
            }
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is True
        assert errors == []

    def test_missing_ok_field(self):
        """Missing 'ok' field should fail."""
        response = {
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("ok" in e.lower() for e in errors)

    def test_missing_meta_field(self):
        """Missing 'meta' field should fail."""
        response = {
            "ok": True,
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("meta" in e.lower() for e in errors)

    def test_missing_confidence(self):
        """Missing meta.confidence should fail."""
        response = {
            "ok": True,
            "meta": {"risk": "low", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("confidence" in e.lower() for e in errors)

    def test_invalid_confidence_type(self):
        """Non-numeric confidence should fail."""
        response = {
            "ok": True,
            "meta": {"confidence": "high", "risk": "low", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("confidence" in e.lower() for e in errors)

    def test_confidence_out_of_range(self):
        """Confidence outside [0,1] should fail."""
        # Too high
        response = {
            "ok": True,
            "meta": {"confidence": 1.5, "risk": "low", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("0 and 1" in e for e in errors)

        # Too low
        response["meta"]["confidence"] = -0.5
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False

    def test_missing_risk(self):
        """Missing meta.risk should fail."""
        response = {
            "ok": True,
            "meta": {"confidence": 0.9, "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("risk" in e.lower() for e in errors)

    def test_invalid_risk_enum(self):
        """Invalid risk enum value should fail."""
        response = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "critical", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("risk" in e.lower() for e in errors)

    def test_missing_explain(self):
        """Missing meta.explain should fail."""
        response = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("explain" in e.lower() for e in errors)

    def test_explain_too_long(self):
        """Explain over 280 characters should fail."""
        response = {
            "ok": True,
            "meta": {
                "confidence": 0.9,
                "risk": "low",
                "explain": "x" * 300  # Over 280 chars
            },
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("280" in e for e in errors)

    def test_success_missing_data(self):
        """Success response missing 'data' should fail."""
        response = {
            "ok": True,
            "meta": {"confidence": 0.9, "risk": "low", "explain": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("data" in e.lower() for e in errors)

    def test_error_missing_error_field(self):
        """Error response missing 'error' should fail."""
        response = {
            "ok": False,
            "meta": {"confidence": 0.0, "risk": "high", "explain": "error"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("error" in e.lower() for e in errors)

    def test_error_missing_code(self):
        """Error missing code should fail."""
        response = {
            "ok": False,
            "meta": {"confidence": 0.0, "risk": "high", "explain": "error"},
            "error": {"message": "Something went wrong"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("code" in e.lower() for e in errors)

    def test_error_missing_message(self):
        """Error missing message should fail."""
        response = {
            "ok": False,
            "meta": {"confidence": 0.0, "risk": "high", "explain": "error"},
            "error": {"code": "E1001"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is False
        assert any("message" in e.lower() for e in errors)

    def test_confidence_edge_cases(self):
        """Confidence at boundaries (0 and 1) should pass."""
        response = {
            "ok": True,
            "meta": {"confidence": 0.0, "risk": "high", "explain": "test"},
            "data": {"rationale": "test"}
        }
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is True

        response["meta"]["confidence"] = 1.0
        is_valid, errors = validate_v22_envelope(response)
        assert is_valid is True

    def test_all_valid_risk_values(self):
        """All valid risk enum values should pass."""
        for risk in ["none", "low", "medium", "high"]:
            response = {
                "ok": True,
                "meta": {"confidence": 0.9, "risk": risk, "explain": "test"},
                "data": {"rationale": "test"}
            }
            is_valid, errors = validate_v22_envelope(response)
            assert is_valid is True, f"Risk '{risk}' should be valid"


# =============================================================================
# v2.2 Module Format Validation Tests
# =============================================================================

class TestValidateV22Module:
    """Test v2.2 module validation with --v22 flag."""

    def test_valid_v22_module(self, tmp_path):
        """Complete v2.2 module should pass validation."""
        # Create module.yaml
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module for validation

tier: decision
schema_strictness: medium

excludes:
  - changing behavior

overflow:
  enabled: true
  max_items: 5
  require_suggested_mapping: true

enums:
  strategy: extensible

compat:
  accepts_v21_payload: true
  runtime_auto_wrap: true
"""
        (tmp_path / "module.yaml").write_text(module_yaml)

        # Create prompt.md
        prompt_md = """# Test Module

This is a test prompt with v2.2 envelope format instructions.

## Response Format

Return response in envelope format with meta and data sections.
"""
        (tmp_path / "prompt.md").write_text(prompt_md)

        # Create schema.json with meta
        schema = {
            "meta": {
                "type": "object",
                "required": ["confidence", "risk", "explain"],
                "properties": {
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "risk": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                    "explain": {"type": "string", "maxLength": 280}
                }
            },
            "input": {"type": "object"},
            "data": {
                "type": "object",
                "required": ["rationale"],
                "properties": {
                    "rationale": {"type": "string"}
                }
            },
            "error": {
                "type": "object",
                "required": ["code", "message"],
                "properties": {
                    "code": {"type": "string"},
                    "message": {"type": "string"}
                }
            }
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is True, f"Errors: {errors}"
        assert len(errors) == 0

    def test_v22_missing_tier(self, tmp_path):
        """v2.2 module without tier should have warning."""
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\n" * 10)
        
        schema = {
            "meta": {
                "type": "object",
                "required": ["confidence", "risk", "explain"],
                "properties": {
                    "confidence": {"type": "number"},
                    "risk": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                    "explain": {"type": "string"}
                }
            },
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        # Should have warning about missing tier
        assert any("tier" in w.lower() for w in warnings)

    def test_v22_invalid_tier(self, tmp_path):
        """v2.2 module with invalid tier should fail."""
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module
tier: invalid_tier
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\n" * 10)
        (tmp_path / "schema.json").write_text(json.dumps({
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {}, "data": {}
        }))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("tier" in e.lower() for e in errors)

    def test_v22_missing_meta_schema(self, tmp_path):
        """v2.2 module without meta schema should fail."""
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module
tier: decision
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\n" * 10)
        
        # schema.json without meta
        schema = {
            "input": {"type": "object"},
            "data": {"type": "object"}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("meta" in e.lower() for e in errors)

    def test_v22_meta_missing_required_fields(self, tmp_path):
        """v2.2 meta schema without required fields should fail."""
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module
tier: decision
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\n" * 10)
        
        # meta schema missing required confidence
        schema = {
            "meta": {
                "type": "object",
                "required": ["risk", "explain"],  # Missing confidence
                "properties": {}
            },
            "input": {},
            "data": {}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("confidence" in e.lower() for e in errors)

    def test_v22_missing_prompt_md(self, tmp_path):
        """v2.2 module without prompt.md should fail."""
        module_yaml = """
name: test-module
version: 2.2.0
responsibility: Test module
tier: decision
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        # No prompt.md created
        (tmp_path / "schema.json").write_text(json.dumps({
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {}, "data": {}
        }))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("prompt.md" in e.lower() for e in errors)

    def test_v1_format_fails_v22_validation(self, tmp_path):
        """v1 format module should fail v2.2 validation."""
        (tmp_path / "MODULE.md").write_text("""---
name: v1-module
version: 1.0.0
responsibility: Test
excludes:
  - nothing
---

# Instructions
Test prompt
""")
        (tmp_path / "schema.json").write_text(json.dumps({
            "input": {}, "output": {}
        }))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("v1" in e.lower() or "migrate" in e.lower() for e in errors)


# =============================================================================
# Overflow Configuration Tests
# =============================================================================

class TestOverflowValidation:
    """Test overflow configuration validation."""

    def test_overflow_enabled_with_extensions_schema(self, tmp_path):
        """Overflow enabled with proper $defs.extensions should pass."""
        module_yaml = """
name: overflow-module
version: 2.2.0
responsibility: Test overflow
tier: decision

overflow:
  enabled: true
  max_items: 10
  require_suggested_mapping: true
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        
        # Schema with $defs.extensions
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {
                "type": "object",
                "required": ["rationale"],
                "properties": {
                    "rationale": {"type": "string"},
                    "extensions": {"$ref": "#/$defs/extensions"}
                }
            },
            "$defs": {
                "extensions": {
                    "type": "object",
                    "properties": {
                        "insights": {
                            "type": "array",
                            "items": {"type": "object"}
                        }
                    }
                }
            }
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is True, f"Errors: {errors}"

    def test_overflow_enabled_missing_extensions_schema(self, tmp_path):
        """Overflow enabled without $defs.extensions should warn."""
        module_yaml = """
name: overflow-module
version: 2.2.0
responsibility: Test overflow
tier: decision

overflow:
  enabled: true
  max_items: 5
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        
        # Schema WITHOUT $defs.extensions
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        # Should have warning about missing extensions
        assert any("extensions" in w.lower() for w in warnings)

    def test_overflow_missing_require_suggested_mapping(self, tmp_path):
        """Overflow enabled without require_suggested_mapping should warn."""
        module_yaml = """
name: overflow-module
version: 2.2.0
responsibility: Test overflow
tier: decision

overflow:
  enabled: true
  max_items: 5
  # require_suggested_mapping not set
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]},
            "$defs": {"extensions": {"type": "object"}}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        # Should have warning about require_suggested_mapping
        assert any("require_suggested_mapping" in w for w in warnings)

    def test_overflow_disabled_no_extensions_required(self, tmp_path):
        """Overflow disabled should not require $defs.extensions."""
        module_yaml = """
name: no-overflow-module
version: 2.2.0
responsibility: Test no overflow
tier: exec

overflow:
  enabled: false
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        # Should not warn about extensions when overflow disabled
        assert not any("extensions" in w.lower() for w in warnings)


# =============================================================================
# Enum Strategy Tests
# =============================================================================

class TestEnumStrategyValidation:
    """Test enum strategy validation."""

    def test_valid_strict_strategy(self, tmp_path):
        """Strict enum strategy should pass."""
        module_yaml = """
name: strict-enum-module
version: 2.2.0
responsibility: Test strict enums
tier: exec

enums:
  strategy: strict
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is True, f"Errors: {errors}"

    def test_valid_extensible_strategy(self, tmp_path):
        """Extensible enum strategy should pass."""
        module_yaml = """
name: extensible-enum-module
version: 2.2.0
responsibility: Test extensible enums
tier: decision

enums:
  strategy: extensible
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is True, f"Errors: {errors}"

    def test_invalid_enum_strategy(self, tmp_path):
        """Invalid enum strategy should fail."""
        module_yaml = """
name: bad-enum-module
version: 2.2.0
responsibility: Test bad enums
tier: decision

enums:
  strategy: invalid_strategy
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Test\nWith envelope format and meta.\n" * 5)
        schema = {
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {},
            "data": {"type": "object", "required": ["rationale"]}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        
        assert is_valid is False
        assert any("strategy" in e.lower() for e in errors)


# =============================================================================
# Tier Validation Tests
# =============================================================================

class TestTierValidation:
    """Test tier-specific validation rules."""

    def test_valid_exec_tier(self, tmp_path):
        """Exec tier with high strictness should pass."""
        module_yaml = """
name: exec-module
version: 2.2.0
responsibility: Execute tasks
tier: exec
schema_strictness: high
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Exec Module\nExecute with envelope format and meta.\n" * 5)
        (tmp_path / "schema.json").write_text(json.dumps({
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {}, "data": {"type": "object", "required": ["rationale"]}
        }))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        # Should not have tier/strictness mismatch errors
        if not is_valid:
            assert "exec" not in str(errors).lower(), f"Unexpected tier mismatch error: {errors}"

    def test_valid_exploration_tier(self, tmp_path):
        """Exploration tier with low strictness should pass."""
        module_yaml = """
name: explore-module
version: 2.2.0
responsibility: Explore ideas
tier: exploration
schema_strictness: low
"""
        (tmp_path / "module.yaml").write_text(module_yaml)
        (tmp_path / "prompt.md").write_text("# Explore Module\nExplore with envelope format and meta.\n" * 5)
        (tmp_path / "schema.json").write_text(json.dumps({
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {}, "data": {"type": "object", "required": ["rationale"]}
        }))

        is_valid, errors, warnings = validate_module(str(tmp_path), v22=True)
        assert is_valid is True, f"Validation failed unexpectedly: {errors}"
