"""
Module Loader - Load cognitive modules in all formats.

Format v2.2 (latest):
  - module.yaml (machine-readable manifest with tier, overflow, enums, compat)
  - prompt.md (human-readable prompt)
  - schema.json (meta + input + data + error)
  - tests/ (golden tests)

Format v2/v2.1 (supported):
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
from typing import Optional, Literal

import yaml


# =============================================================================
# Type Definitions (v2.2)
# =============================================================================

ModuleTier = Literal["exec", "decision", "exploration"]
SchemaStrictness = Literal["high", "medium", "low"]
EnumStrategy = Literal["strict", "extensible"]


# =============================================================================
# Format Detection
# =============================================================================

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


def detect_v2_version(manifest: dict) -> str:
    """Detect v2.x version from manifest content."""
    # v2.2 indicators
    if manifest.get("tier") or manifest.get("overflow") or manifest.get("enums"):
        return "v2.2"
    # v2.1 indicators
    if manifest.get("policies") or manifest.get("failure"):
        return "v2.1"
    # Default v2.0
    return "v2.0"


# =============================================================================
# Frontmatter Parsing
# =============================================================================

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


# =============================================================================
# v2.2 Loader
# =============================================================================

def load_v2_format(module_path: Path) -> dict:
    """Load module in v2.x format (module.yaml + prompt.md + schema.json)."""
    # Load module.yaml
    with open(module_path / "module.yaml", 'r', encoding='utf-8') as f:
        manifest = yaml.safe_load(f)
    
    # Detect version
    version_str = detect_v2_version(manifest)
    
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
        
        # Support both "data" (v2.2) and "output" (v2.1) aliases
        compat = manifest.get("compat", {})
        if compat.get("schema_output_alias") == "data" or "data" in schema:
            data_schema = schema.get("data", schema.get("output", {}))
            output_schema = data_schema  # Keep for backward compat
        else:
            output_schema = schema.get("output", {})
            data_schema = output_schema
        
        error_schema = schema.get("error", {})
        meta_schema = schema.get("meta", {})
        defs = schema.get("$defs", {})
    else:
        input_schema = {}
        output_schema = {}
        data_schema = {}
        error_schema = {}
        meta_schema = {}
        defs = {}
    
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
    
    # Extract v2.1 fields
    policies = manifest.get("policies", {})
    tools = manifest.get("tools", {})
    output_contract = manifest.get("output", {})
    failure_contract = manifest.get("failure", {})
    runtime_requirements = manifest.get("runtime_requirements", {})
    
    # Extract v2.2 fields
    tier: Optional[ModuleTier] = manifest.get("tier")
    schema_strictness: SchemaStrictness = manifest.get("schema_strictness", "medium")
    
    # Determine default max_items based on strictness (SPEC-v2.2)
    # high=0 (disabled), medium=5, low=20
    strictness_max_items = {
        "high": 0,
        "medium": 5,
        "low": 20
    }
    default_max_items = strictness_max_items.get(schema_strictness, 5)
    default_enabled = schema_strictness != "high"
    
    overflow_raw = manifest.get("overflow", {})
    overflow = {
        "enabled": overflow_raw.get("enabled", default_enabled),
        "recoverable": overflow_raw.get("recoverable", True),
        "max_items": overflow_raw.get("max_items", default_max_items),
        "require_suggested_mapping": overflow_raw.get("require_suggested_mapping", True)
    }
    
    # Merge enums with defaults (ensure defaults are applied even if partial config exists)
    enums_defaults = {
        "strategy": "extensible" if tier in ("decision", "exploration") else "strict",
        "unknown_tag": "custom"
    }
    enums = {**enums_defaults, **manifest.get("enums", {})}
    
    # Merge compat with defaults (ensure defaults are applied even if partial config exists)
    compat_defaults = {
        "accepts_v21_payload": True,
        "runtime_auto_wrap": True,
        "schema_output_alias": "data"
    }
    compat = {**compat_defaults, **manifest.get("compat", {})}
    
    io_config = manifest.get("io", {})
    tests = manifest.get("tests", [])
    
    return {
        # Core identity
        "name": manifest.get("name", module_path.name),
        "version": manifest.get("version", "1.0.0"),
        "responsibility": manifest.get("responsibility", ""),
        "excludes": manifest.get("excludes", []),
        
        # Path and format info
        "path": module_path,
        "format": "v2",
        "format_version": version_str,
        
        # Raw manifest
        "metadata": manifest,
        
        # Schemas
        "input_schema": input_schema,
        "output_schema": output_schema,  # v2.1 compat
        "data_schema": data_schema,       # v2.2
        "error_schema": error_schema,
        "meta_schema": meta_schema,       # v2.2
        "schema_defs": defs,
        
        # Constraints and policies
        "constraints": constraints,
        "policies": policies,
        "tools": tools,
        
        # Contracts
        "output_contract": output_contract,
        "failure_contract": failure_contract,
        
        # Runtime
        "runtime_requirements": runtime_requirements,
        
        # v2.2 specific
        "tier": tier,
        "schema_strictness": schema_strictness,
        "overflow": overflow,
        "enums": enums,
        "compat": compat,
        "io": io_config,
        "tests": tests,
        
        # Prompt
        "prompt": prompt,
    }


# =============================================================================
# v1 Loader (Legacy)
# =============================================================================

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
        "format_version": "v1.0",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "data_schema": output_schema,  # Alias for v2.2 compat
        "constraints": constraints,
        "prompt": prompt,
        # v2.2 defaults for v1 modules
        "tier": None,
        "schema_strictness": "medium",
        "overflow": {"enabled": False},
        "enums": {"strategy": "strict"},
        "compat": {"accepts_v21_payload": True, "runtime_auto_wrap": True},
    }


# =============================================================================
# v0 Loader (Deprecated)
# =============================================================================

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
        "format_version": "v0.0",
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "data_schema": output_schema,  # Alias
        "constraints": constraints,
        "prompt": prompt,
        # v2.2 defaults
        "tier": None,
        "schema_strictness": "medium",
        "overflow": {"enabled": False},
        "enums": {"strategy": "strict"},
        "compat": {"accepts_v21_payload": True, "runtime_auto_wrap": True},
    }


# =============================================================================
# Main Loader
# =============================================================================

def load_module(module_path: Path) -> dict:
    """Load a module, auto-detecting format."""
    fmt = detect_format(module_path)
    if fmt == "v2":
        return load_v2_format(module_path)
    elif fmt == "v1":
        return load_v1_format(module_path)
    else:
        return load_v0_format(module_path)


# =============================================================================
# Module Discovery
# =============================================================================

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


# =============================================================================
# Utility Functions
# =============================================================================

def get_module_tier(module: dict) -> Optional[ModuleTier]:
    """Get module tier (exec, decision, exploration)."""
    return module.get("tier")


def get_schema_strictness(module: dict) -> SchemaStrictness:
    """Get schema strictness level."""
    return module.get("schema_strictness", "medium")


def is_overflow_enabled(module: dict) -> bool:
    """Check if overflow (extensions.insights) is enabled."""
    overflow = module.get("overflow", {})
    return overflow.get("enabled", False)


def get_enum_strategy(module: dict) -> EnumStrategy:
    """Get enum extension strategy."""
    enums = module.get("enums", {})
    return enums.get("strategy", "strict")


def should_auto_wrap(module: dict) -> bool:
    """Check if runtime should auto-wrap v2.1 to v2.2."""
    compat = module.get("compat", {})
    return compat.get("runtime_auto_wrap", True)
