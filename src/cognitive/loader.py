"""
Module Loader - Load cognitive modules in all formats.

Format v2 (recommended):
  - module.yaml (machine-readable manifest)
  - prompt.md (human-readable prompt)
  - schema.json (input + output + error)
  - tests/ (golden tests)

Format v1 (legacy, still supported):
  - MODULE.md (YAML frontmatter + prompt)
  - schema.json (input + output)

Format v0 (old, deprecated):
  - module.md (YAML frontmatter)
  - input.schema.json
  - output.schema.json
  - constraints.yaml
  - prompt.txt
"""

import json
from pathlib import Path
from typing import Optional

import yaml


def detect_format(module_path: Path) -> str:
    """Detect module format: 'v2', 'v1', or 'v0'."""
    if (module_path / "module.yaml").exists():
        return "v2"
    elif (module_path / "MODULE.md").exists():
        return "v1"
    elif (module_path / "module.md").exists():
        return "v0"
    else:
        raise FileNotFoundError(f"No module.yaml, MODULE.md, or module.md found in {module_path}")


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


def load_v2_format(module_path: Path) -> dict:
    """Load module in v2 format (module.yaml + prompt.md + schema.json)."""
    # Load module.yaml
    with open(module_path / "module.yaml", 'r', encoding='utf-8') as f:
        manifest = yaml.safe_load(f)
    
    # Load prompt.md
    prompt_path = module_path / "prompt.md"
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt = f.read()
    else:
        prompt = ""
    
    # Load schema.json
    schema_path = module_path / "schema.json"
    if schema_path.exists():
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        input_schema = schema.get("input", {})
        output_schema = schema.get("output", {})
        error_schema = schema.get("error", {})
    else:
        input_schema = {}
        output_schema = {}
        error_schema = {}
    
    # Extract constraints (supports both old and new format)
    constraints_raw = manifest.get("constraints", {})
    policies_raw = manifest.get("policies", {})
    
    constraints = {
        "operational": {
            "no_external_network": constraints_raw.get("no_network", True) or policies_raw.get("network") == "deny",
            "no_side_effects": constraints_raw.get("no_side_effects", True) or policies_raw.get("side_effects") == "deny",
            "no_file_write": constraints_raw.get("no_file_write", True) or policies_raw.get("filesystem_write") == "deny",
            "no_inventing_data": constraints_raw.get("no_inventing_data", True),
        },
        "output_quality": {
            "require_confidence": manifest.get("output", {}).get("require_confidence", True),
            "require_rationale": manifest.get("output", {}).get("require_rationale", True),
            "require_behavior_equivalence": manifest.get("output", {}).get("require_behavior_equivalence", False),
        },
        "behavior_equivalence_false_max_confidence": constraints_raw.get("behavior_equivalence_false_max_confidence", 0.7),
    }
    
    # Extract policies (v2.1)
    policies = manifest.get("policies", {})
    
    # Extract tools policy
    tools = manifest.get("tools", {})
    
    # Extract output contract
    output_contract = manifest.get("output", {})
    
    # Extract failure contract
    failure_contract = manifest.get("failure", {})
    
    # Extract runtime requirements
    runtime_requirements = manifest.get("runtime_requirements", {})
    
    return {
        "name": manifest.get("name", module_path.name),
        "version": manifest.get("version", "1.0.0"),
        "responsibility": manifest.get("responsibility", ""),
        "excludes": manifest.get("excludes", []),
        "path": module_path,
        "format": "v2",
        "metadata": manifest,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "error_schema": error_schema,
        "constraints": constraints,
        "policies": policies,
        "tools": tools,
        "output_contract": output_contract,
        "failure_contract": failure_contract,
        "runtime_requirements": runtime_requirements,
        "prompt": prompt,
    }


def load_v1_format(module_path: Path) -> dict:
    """Load module in v1 format (MODULE.md + schema.json)."""
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
        "version": metadata.get("version", "1.0.0"),
        "responsibility": metadata.get("responsibility", ""),
        "excludes": metadata.get("excludes", []),
        "path": module_path,
        "format": "v1",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "constraints": constraints,
        "prompt": prompt,
    }


def load_v0_format(module_path: Path) -> dict:
    """Load module in v0 format (old 6-file format)."""
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
        "version": metadata.get("version", "1.0.0"),
        "responsibility": metadata.get("responsibility", ""),
        "excludes": [],
        "path": module_path,
        "format": "v0",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "constraints": constraints,
        "prompt": prompt,
    }


def load_module(module_path: Path) -> dict:
    """Load a module, auto-detecting format."""
    fmt = detect_format(module_path)
    if fmt == "v2":
        return load_v2_format(module_path)
    elif fmt == "v1":
        return load_v1_format(module_path)
    else:
        return load_v0_format(module_path)


def find_module(name: str, search_paths: list[Path]) -> Optional[dict]:
    """Find and load a module by name from search paths."""
    for base_path in search_paths:
        module_path = base_path / name
        if module_path.exists():
            try:
                return load_module(module_path)
            except FileNotFoundError:
                continue
    return None


def list_modules(search_paths: list[Path]) -> list[dict]:
    """List all modules in search paths."""
    modules = []
    for base_path in search_paths:
        if not base_path.exists():
            continue
        for module_dir in base_path.iterdir():
            if module_dir.is_dir():
                try:
                    module = load_module(module_dir)
                    modules.append(module)
                except FileNotFoundError:
                    continue
    return modules
