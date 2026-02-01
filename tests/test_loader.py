"""Tests for module loader."""

import json
import tempfile
from pathlib import Path

import pytest

from cognitive.loader import (
    detect_format,
    parse_frontmatter,
    load_module,
    load_new_format,
)


class TestParseFrontmatter:
    """Test YAML frontmatter parsing."""

    def test_parse_with_frontmatter(self):
        content = """---
name: test-module
version: 1.0.0
---

# Content here
"""
        meta, body = parse_frontmatter(content)
        assert meta["name"] == "test-module"
        assert meta["version"] == "1.0.0"
        assert "# Content here" in body

    def test_parse_without_frontmatter(self):
        content = "# Just markdown"
        meta, body = parse_frontmatter(content)
        assert meta == {}
        assert body == content

    def test_parse_empty_frontmatter(self):
        content = """---
---

# Content
"""
        meta, body = parse_frontmatter(content)
        assert meta == {}
        assert "# Content" in body


class TestDetectFormat:
    """Test format detection."""

    def test_detect_new_format(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("---\nname: test\n---\n")
        assert detect_format(tmp_path) == "new"

    def test_detect_old_format(self, tmp_path):
        # On macOS (case-insensitive), module.md and MODULE.md are same
        # So we skip this test on case-insensitive filesystems
        import sys
        if sys.platform == "darwin":
            pytest.skip("macOS is case-insensitive, module.md == MODULE.md")
        
        (tmp_path / "module.md").write_text("---\nname: test\n---\n")
        assert detect_format(tmp_path) == "old"

    def test_detect_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            detect_format(tmp_path)


class TestLoadNewFormat:
    """Test loading new format modules."""

    def test_load_minimal_module(self, tmp_path):
        # Create MODULE.md
        (tmp_path / "MODULE.md").write_text("""---
name: test-module
version: 1.0.0
responsibility: Test module
---

# Test Module

Instructions here.
""")
        
        # Create schema.json
        schema = {
            "input": {"type": "object"},
            "output": {"type": "object"}
        }
        (tmp_path / "schema.json").write_text(json.dumps(schema))
        
        module = load_new_format(tmp_path)
        
        assert module["name"] == "test-module"
        assert module["format"] == "new"
        assert "Instructions here" in module["prompt"]
        assert module["input_schema"]["type"] == "object"

    def test_load_with_constraints(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("""---
name: constrained-module
version: 1.0.0
constraints:
  no_network: true
  no_side_effects: true
---

# Module
""")
        (tmp_path / "schema.json").write_text("{}")
        
        module = load_new_format(tmp_path)
        
        assert module["constraints"]["operational"]["no_external_network"] is True
        assert module["constraints"]["operational"]["no_side_effects"] is True


class TestLoadModule:
    """Test unified module loading."""

    def test_load_auto_detects_new_format(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("---\nname: auto-test\n---\nContent")
        (tmp_path / "schema.json").write_text("{}")
        
        module = load_module(tmp_path)
        assert module["format"] == "new"
        assert module["name"] == "auto-test"
