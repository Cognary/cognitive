"""Tests for module migration tool.

Tests v1/v2.1 to v2.2 migration functionality.
"""

import json
from pathlib import Path

import pytest
import yaml

from cognitive.migrate import (
    migrate_module,
    migrate_all_modules,
    _create_v22_manifest,
    _create_v22_schema,
    _create_meta_schema,
    _create_extensions_schema,
    _add_rationale_to_output,
)


class TestCreateV22Manifest:
    """Test manifest creation helpers."""

    def test_create_manifest_from_frontmatter(self):
        """Should create complete v2.2 manifest from frontmatter."""
        frontmatter = {
            "name": "test-module",
            "version": "1.0.0",
            "responsibility": "Test module",
            "excludes": ["doing bad things"]
        }
        manifest = _create_v22_manifest(frontmatter)

        assert manifest["name"] == "test-module"
        assert manifest["version"] == "1.0.0"
        assert manifest["responsibility"] == "Test module"
        assert manifest["tier"] == "decision"  # default
        assert manifest["schema_strictness"] == "medium"  # default
        assert manifest["excludes"] == ["doing bad things"]

    def test_manifest_has_required_v22_fields(self):
        """Created manifest should have all v2.2 fields."""
        frontmatter = {"name": "test"}
        manifest = _create_v22_manifest(frontmatter)

        # Check v2.2 required fields
        assert "tier" in manifest
        assert "schema_strictness" in manifest
        assert "overflow" in manifest
        assert "enums" in manifest
        assert "compat" in manifest
        assert "io" in manifest
        assert "policies" in manifest
        assert "tools" in manifest
        assert "failure" in manifest
        assert "runtime_requirements" in manifest

    def test_manifest_overflow_defaults(self):
        """Overflow should have correct defaults."""
        manifest = _create_v22_manifest({})
        overflow = manifest["overflow"]

        assert overflow["enabled"] is True
        assert overflow["recoverable"] is True
        assert overflow["max_items"] == 5
        assert overflow["require_suggested_mapping"] is True

    def test_manifest_compat_defaults(self):
        """Compat should have correct defaults."""
        manifest = _create_v22_manifest({})
        compat = manifest["compat"]

        assert compat["accepts_v21_payload"] is True
        assert compat["runtime_auto_wrap"] is True
        assert compat["schema_output_alias"] == "data"

    def test_manifest_preserves_constraints(self):
        """Should preserve existing constraints."""
        frontmatter = {
            "name": "test",
            "constraints": {
                "behavior_equivalence_false_max_confidence": 0.7
            }
        }
        manifest = _create_v22_manifest(frontmatter)

        assert "constraints" in manifest
        assert manifest["constraints"]["behavior_equivalence_false_max_confidence"] == 0.7

    def test_manifest_preserves_context(self):
        """Should preserve context setting."""
        frontmatter = {
            "name": "test",
            "context": "fork"
        }
        manifest = _create_v22_manifest(frontmatter)

        assert manifest["context"] == "fork"


class TestCreateV22Schema:
    """Test schema creation helpers."""

    def test_create_schema_structure(self):
        """Should create proper v2.2 schema structure."""
        input_schema = {"type": "object", "properties": {"code": {"type": "string"}}}
        output_schema = {"type": "object", "properties": {"result": {"type": "string"}}}
        
        schema = _create_v22_schema(input_schema, output_schema)

        assert "$schema" in schema
        assert "meta" in schema
        assert "input" in schema
        assert "data" in schema
        assert "error" in schema
        assert "$defs" in schema

    def test_schema_has_meta(self):
        """Created schema should have valid meta schema."""
        schema = _create_v22_schema({}, {})
        meta = schema["meta"]

        assert meta["type"] == "object"
        assert "confidence" in meta["required"]
        assert "risk" in meta["required"]
        assert "explain" in meta["required"]

    def test_schema_preserves_input(self):
        """Should preserve input schema."""
        input_schema = {"type": "object", "required": ["code"]}
        schema = _create_v22_schema(input_schema, {})

        assert schema["input"] == input_schema

    def test_schema_adds_rationale_to_data(self):
        """Should add rationale to data schema."""
        output_schema = {"type": "object", "properties": {"result": {"type": "string"}}}
        schema = _create_v22_schema({}, output_schema)

        assert "rationale" in schema["data"].get("required", [])
        assert "rationale" in schema["data"].get("properties", {})

    def test_schema_has_extensions_def(self):
        """Should have $defs.extensions for overflow."""
        schema = _create_v22_schema({}, {})

        assert "extensions" in schema["$defs"]
        assert "insights" in schema["$defs"]["extensions"]["properties"]


class TestCreateMetaSchema:
    """Test meta schema creation."""

    def test_meta_schema_structure(self):
        """Meta schema should have correct structure."""
        meta = _create_meta_schema()

        assert meta["type"] == "object"
        assert set(meta["required"]) == {"confidence", "risk", "explain"}

    def test_meta_schema_confidence(self):
        """Confidence should have correct constraints."""
        meta = _create_meta_schema()
        confidence = meta["properties"]["confidence"]

        assert confidence["type"] == "number"
        assert confidence["minimum"] == 0
        assert confidence["maximum"] == 1

    def test_meta_schema_risk(self):
        """Risk should have correct enum."""
        meta = _create_meta_schema()
        risk = meta["properties"]["risk"]

        assert risk["type"] == "string"
        assert set(risk["enum"]) == {"none", "low", "medium", "high"}

    def test_meta_schema_explain(self):
        """Explain should have maxLength."""
        meta = _create_meta_schema()
        explain = meta["properties"]["explain"]

        assert explain["type"] == "string"
        assert explain["maxLength"] == 280

    def test_meta_schema_optional_fields(self):
        """Meta schema should have optional fields."""
        meta = _create_meta_schema()
        props = meta["properties"]

        assert "trace_id" in props
        assert "model" in props
        assert "latency_ms" in props


class TestCreateExtensionsSchema:
    """Test extensions schema creation."""

    def test_extensions_schema_structure(self):
        """Extensions schema should have correct structure."""
        ext = _create_extensions_schema()

        assert ext["type"] == "object"
        assert "insights" in ext["properties"]

    def test_insights_array_structure(self):
        """Insights should be array with correct item schema."""
        ext = _create_extensions_schema()
        insights = ext["properties"]["insights"]

        assert insights["type"] == "array"
        assert insights["maxItems"] == 5

    def test_insight_item_schema(self):
        """Insight items should have required fields."""
        ext = _create_extensions_schema()
        item_schema = ext["properties"]["insights"]["items"]

        assert set(item_schema["required"]) == {"text", "suggested_mapping"}
        assert "text" in item_schema["properties"]
        assert "suggested_mapping" in item_schema["properties"]
        assert "evidence" in item_schema["properties"]


class TestAddRationaleToOutput:
    """Test adding rationale to output schema."""

    def test_adds_rationale_to_required(self):
        """Should add rationale to required fields."""
        output = {"type": "object", "required": ["result"]}
        result = _add_rationale_to_output(output)

        assert "rationale" in result["required"]
        assert "result" in result["required"]

    def test_adds_rationale_property(self):
        """Should add rationale property if missing."""
        output = {"type": "object", "properties": {"result": {"type": "string"}}}
        result = _add_rationale_to_output(output)

        assert "rationale" in result["properties"]
        assert result["properties"]["rationale"]["type"] == "string"

    def test_adds_extensions_reference(self):
        """Should add extensions reference."""
        output = {"type": "object", "properties": {}}
        result = _add_rationale_to_output(output)

        assert "extensions" in result["properties"]
        assert result["properties"]["extensions"]["$ref"] == "#/$defs/extensions"

    def test_does_not_duplicate_rationale(self):
        """Should not duplicate if rationale already exists."""
        output = {
            "type": "object",
            "required": ["rationale"],
            "properties": {"rationale": {"type": "string", "description": "existing"}}
        }
        result = _add_rationale_to_output(output)

        assert result["required"].count("rationale") == 1


class TestMigrateModule:
    """Test module migration functionality."""

    def test_migrate_v1_module(self, tmp_path):
        """Should migrate v1 module to v2.2."""
        # Create v1 module
        (tmp_path / "MODULE.md").write_text("""---
name: v1-module
version: 1.0.0
responsibility: Test v1 module
excludes:
  - bad things
---

# V1 Module Instructions

Do something useful.
""")
        (tmp_path / "schema.json").write_text(json.dumps({
            "input": {"type": "object"},
            "output": {"type": "object", "properties": {"result": {"type": "string"}}}
        }))

        # Run migration
        success, changes, warnings = migrate_module(str(tmp_path), dry_run=False, backup=False)

        assert success is True
        assert len(changes) > 0

        # Check created files
        assert (tmp_path / "module.yaml").exists()
        assert (tmp_path / "prompt.md").exists()

        # Check module.yaml content
        with open(tmp_path / "module.yaml") as f:
            manifest = yaml.safe_load(f)
        
        assert manifest["name"] == "v1-module"
        assert manifest["tier"] == "decision"
        assert "overflow" in manifest
        assert "compat" in manifest

        # Check schema.json was updated
        with open(tmp_path / "schema.json") as f:
            schema = json.load(f)
        
        assert "meta" in schema
        assert "data" in schema or "output" in schema

    def test_migrate_dry_run(self, tmp_path):
        """Dry run should not modify files."""
        # Create v1 module
        (tmp_path / "MODULE.md").write_text("""---
name: test-module
version: 1.0.0
responsibility: Test
excludes: []
---
# Test
""")
        (tmp_path / "schema.json").write_text(json.dumps({"input": {}, "output": {}}))

        # Run dry migration
        success, changes, warnings = migrate_module(str(tmp_path), dry_run=True, backup=False)

        assert success is True
        assert any("[DRY RUN]" in c for c in changes)

        # Files should NOT be created
        assert not (tmp_path / "module.yaml").exists()
        assert not (tmp_path / "prompt.md").exists()

    def test_migrate_already_v22(self, tmp_path):
        """Should handle already v2.2 module gracefully."""
        # Create v2.2 module
        (tmp_path / "module.yaml").write_text("""
name: v22-module
version: 2.2.0
responsibility: Already v2.2
tier: decision
""")
        (tmp_path / "prompt.md").write_text("# V2.2 Module")
        (tmp_path / "schema.json").write_text(json.dumps({
            "meta": {"type": "object", "required": ["confidence", "risk", "explain"]},
            "input": {}, "data": {}
        }))

        success, changes, warnings = migrate_module(str(tmp_path), dry_run=False, backup=False)

        assert success is True
        # Should have warning about already v2.2
        assert any("already" in w.lower() or "v2.2" in w.lower() for w in warnings)

    def test_migrate_nonexistent_module(self):
        """Should fail for nonexistent module."""
        success, changes, warnings = migrate_module("nonexistent-module-xyz")

        assert success is False
        assert any("not found" in w.lower() for w in warnings)

    def test_migrate_creates_backup(self, tmp_path):
        """Should create backup when backup=True."""
        # Create a subdirectory for the module to have a clean parent
        module_dir = tmp_path / "my_module"
        module_dir.mkdir()
        
        # Create v1 module
        (module_dir / "MODULE.md").write_text("""---
name: backup-test
version: 1.0.0
responsibility: Test backup
excludes: []
---
# Test
""")
        (module_dir / "schema.json").write_text(json.dumps({"input": {}, "output": {}}))

        success, changes, warnings = migrate_module(str(module_dir), dry_run=False, backup=True)

        assert success is True
        # Should mention backup in changes
        assert any("backup" in c.lower() for c in changes)

        # Check backup directory was created in the same parent as module_dir
        backup_dirs = [d for d in tmp_path.iterdir() 
                       if d.is_dir() and "backup" in d.name]
        assert len(backup_dirs) == 1

    def test_migrate_v2_to_v22(self, tmp_path):
        """Should upgrade v2.0/v2.1 module to v2.2."""
        # Create v2.1 module (has module.yaml but no tier)
        (tmp_path / "module.yaml").write_text("""
name: v21-module
version: 2.1.0
responsibility: Test v2.1
excludes:
  - nothing
policies:
  network: deny
""")
        (tmp_path / "prompt.md").write_text("# V2.1 Module\n" * 10)
        (tmp_path / "schema.json").write_text(json.dumps({
            "input": {"type": "object"},
            "output": {"type": "object"}  # Uses 'output' not 'data'
        }))

        success, changes, warnings = migrate_module(str(tmp_path), dry_run=False, backup=False)

        assert success is True

        # Check module.yaml was updated
        with open(tmp_path / "module.yaml") as f:
            manifest = yaml.safe_load(f)
        
        assert manifest["tier"] == "decision"
        assert "overflow" in manifest
        assert "enums" in manifest
        assert "compat" in manifest

        # Check schema.json was updated
        with open(tmp_path / "schema.json") as f:
            schema = json.load(f)
        
        assert "meta" in schema
        # output should be renamed to data
        assert "data" in schema


class TestMigrateAllModules:
    """Test batch migration of all modules."""

    def test_migrate_all_empty(self, monkeypatch):
        """Should handle no modules gracefully."""
        # Mock list_modules to return empty
        monkeypatch.setattr("cognitive.migrate.list_modules", lambda: [])
        
        results = migrate_all_modules(dry_run=True)
        
        assert results == []

    def test_migrate_all_with_modules(self, tmp_path, monkeypatch):
        """Should migrate multiple modules."""
        # Create two test modules
        mod1_path = tmp_path / "mod1"
        mod1_path.mkdir()
        (mod1_path / "MODULE.md").write_text("""---
name: mod1
version: 1.0.0
responsibility: Module 1
excludes: []
---
# Module 1
""")
        (mod1_path / "schema.json").write_text(json.dumps({"input": {}, "output": {}}))

        mod2_path = tmp_path / "mod2"
        mod2_path.mkdir()
        (mod2_path / "MODULE.md").write_text("""---
name: mod2
version: 1.0.0
responsibility: Module 2
excludes: []
---
# Module 2
""")
        (mod2_path / "schema.json").write_text(json.dumps({"input": {}, "output": {}}))

        # Mock list_modules
        def mock_list_modules():
            return [
                {"name": "mod1", "path": mod1_path},
                {"name": "mod2", "path": mod2_path}
            ]
        monkeypatch.setattr("cognitive.migrate.list_modules", mock_list_modules)

        results = migrate_all_modules(dry_run=True, backup=False)

        assert len(results) == 2
        # Each result should be (name, success, changes, warnings)
        for name, success, changes, warnings in results:
            assert isinstance(name, str)
            assert isinstance(success, bool)
            assert isinstance(changes, list)
            assert isinstance(warnings, list)
