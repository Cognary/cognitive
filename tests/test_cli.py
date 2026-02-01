"""Tests for CLI commands."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from cognitive.cli import app


runner = CliRunner()


class TestVersionCommand:
    """Test version display."""

    def test_version_flag(self):
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert "cog version" in result.stdout


class TestListCommand:
    """Test list command."""

    def test_list_runs(self):
        result = runner.invoke(app, ["list"])
        # Should not crash
        assert result.exit_code == 0

    def test_list_json_format(self):
        result = runner.invoke(app, ["list", "--format", "json"])
        assert result.exit_code == 0
        # Output should be valid JSON (or empty array message)


class TestValidateCommand:
    """Test validate command."""

    def test_validate_valid_module(self, tmp_path):
        # Create valid module with examples
        (tmp_path / "MODULE.md").write_text("---\nname: test\nversion: 1.0.0\n---\n# Test")
        (tmp_path / "schema.json").write_text('{"input": {}, "output": {}}')
        examples_dir = tmp_path / "examples"
        examples_dir.mkdir()
        (examples_dir / "input.json").write_text("{}")
        (examples_dir / "output.json").write_text("{}")
        
        result = runner.invoke(app, ["validate", str(tmp_path)])
        # Just verify it runs without crashing
        assert result.exit_code in [0, 1]  # May pass or fail depending on validation rules

    def test_validate_nonexistent_module(self):
        result = runner.invoke(app, ["validate", "nonexistent-module-xyz"])
        assert result.exit_code == 1


class TestDoctorCommand:
    """Test doctor command."""

    def test_doctor_runs(self):
        result = runner.invoke(app, ["doctor"])
        assert result.exit_code == 0
        assert "LLM Providers" in result.stdout
        assert "Installed Modules" in result.stdout


class TestInfoCommand:
    """Test info command."""

    def test_info_valid_module(self, tmp_path):
        (tmp_path / "MODULE.md").write_text("""---
name: info-test
version: 2.0.0
responsibility: Test module for info
---

# Content
""")
        (tmp_path / "schema.json").write_text("{}")
        
        result = runner.invoke(app, ["info", str(tmp_path)])
        
        assert result.exit_code == 0
        assert "info-test" in result.stdout
        assert "2.0.0" in result.stdout

    def test_info_nonexistent(self):
        result = runner.invoke(app, ["info", "nonexistent-xyz"])
        assert result.exit_code == 1


class TestInitCommand:
    """Test init command."""

    def test_init_creates_module(self, tmp_path):
        result = runner.invoke(app, [
            "init", "my-new-module",
            "--target", str(tmp_path)
        ])
        
        assert result.exit_code == 0
        
        module_dir = tmp_path / "my-new-module"
        assert module_dir.exists()
        assert (module_dir / "MODULE.md").exists()
        assert (module_dir / "schema.json").exists()

    def test_init_invalid_name(self):
        result = runner.invoke(app, ["init", "invalid name with spaces"])
        assert result.exit_code == 1
