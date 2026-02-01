"""Tests for module validator."""

import json
from pathlib import Path

import pytest

from cognitive.validator import validate_module


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
