"""
Module Loader - Load cognitive modules in both old and new formats.

Old format (6 files):
  - module.md (YAML frontmatter)
  - input.schema.json
  - output.schema.json
  - constraints.yaml
  - prompt.txt
  - examples/

New format (2 files):
  - MODULE.md (YAML frontmatter + prompt)
  - schema.json (input + output combined)
"""

import json
from pathlib import Path
from typing import Optional

import yaml


def detect_format(module_path: Path) -> str:
    """Detect module format: 'new' or 'old'."""
    if (module_path / "MODULE.md").exists():
        return "new"
    elif (module_path / "module.md").exists():
        return "old"
    else:
        raise FileNotFoundError(f"No MODULE.md or module.md found in {module_path}")


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown content."""
    if not content.startswith('---'):
        return {}, content
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content
    
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


def load_new_format(module_path: Path) -> dict:
    """Load module in new format (MODULE.md + schema.json)."""
    # Load MODULE.md
    with open(module_path / "MODULE.md", 'r', encoding='utf-8') as f:
        content = f.read()
    
    metadata, prompt = parse_frontmatter(content)
    
    # Extract constraints from metadata
    constraints = {
        "operational": {
            "no_external_network": metadata.get("constraints", {}).get("no_network", True),
            "no_side_effects": metadata.get("constraints", {}).get("no_side_effects", True),
            "no_inventing_data": metadata.get("constraints", {}).get("no_inventing_data", True),
        },
        "output_quality": {
            "require_confidence": metadata.get("constraints", {}).get("require_confidence", True),
            "require_rationale": metadata.get("constraints", {}).get("require_rationale", True),
        }
    }
    
    # Load schema.json
    schema_path = module_path / "schema.json"
    if schema_path.exists():
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        input_schema = schema.get("input", {})
        output_schema = schema.get("output", {})
    else:
        input_schema = {}
        output_schema = {}
    
    return {
        "name": metadata.get("name", module_path.name),
        "path": module_path,
        "format": "new",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "constraints": constraints,
        "prompt": prompt,
    }


def load_old_format(module_path: Path) -> dict:
    """Load module in old format (6 files)."""
    # Load module.md
    with open(module_path / "module.md", 'r', encoding='utf-8') as f:
        content = f.read()
    
    metadata, _ = parse_frontmatter(content)
    
    # Load schemas
    with open(module_path / "input.schema.json", 'r', encoding='utf-8') as f:
        input_schema = json.load(f)
    
    with open(module_path / "output.schema.json", 'r', encoding='utf-8') as f:
        output_schema = json.load(f)
    
    # Load constraints
    with open(module_path / "constraints.yaml", 'r', encoding='utf-8') as f:
        constraints = yaml.safe_load(f)
    
    # Load prompt
    with open(module_path / "prompt.txt", 'r', encoding='utf-8') as f:
        prompt = f.read()
    
    return {
        "name": metadata.get("name", module_path.name),
        "path": module_path,
        "format": "old",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "constraints": constraints,
        "prompt": prompt,
    }


def load_module(module_path: Path) -> dict:
    """Load a module, auto-detecting format."""
    fmt = detect_format(module_path)
    if fmt == "new":
        return load_new_format(module_path)
    else:
        return load_old_format(module_path)
