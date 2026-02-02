"""
Module Migration Tool - Migrate v1/v2.1 modules to v2.2 format.

Migration includes:
- Creating module.yaml with tier, overflow, enums, compat
- Updating schema.json with meta schema
- Creating/updating prompt.md with v2.2 envelope instructions
- Preserving MODULE.md for backward compatibility
"""

import json
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime

import yaml

from .registry import find_module, list_modules
from .loader import detect_format, parse_frontmatter


# =============================================================================
# Migration Entry Points
# =============================================================================

def migrate_module(
    name_or_path: str,
    dry_run: bool = False,
    backup: bool = True
) -> tuple[bool, list[str], list[str]]:
    """
    Migrate a single module to v2.2 format.
    
    Args:
        name_or_path: Module name or path
        dry_run: If True, only show what would be done
        backup: If True, create backup before migration
    
    Returns:
        Tuple of (success, changes, warnings)
    """
    changes = []
    warnings = []
    
    # Find module
    path = Path(name_or_path)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(name_or_path)
        if not module_path:
            return False, [], [f"Module not found: {name_or_path}"]
    
    # Detect current format
    try:
        fmt = detect_format(module_path)
    except FileNotFoundError as e:
        return False, [], [str(e)]
    
    # Check if already v2.2
    if fmt == "v2":
        module_yaml_path = module_path / "module.yaml"
        if module_yaml_path.exists():
            with open(module_yaml_path, 'r', encoding='utf-8') as f:
                manifest = yaml.safe_load(f)
            if manifest.get('tier') is not None:
                warnings.append("Module appears to already be v2.2 format")
                return True, [], warnings
    
    # Create backup
    if backup and not dry_run:
        backup_path = _create_backup(module_path)
        changes.append(f"Created backup: {backup_path}")
    
    # Perform migration based on format
    if fmt == "v0":
        return _migrate_from_v0(module_path, dry_run, changes, warnings)
    elif fmt == "v1":
        return _migrate_from_v1(module_path, dry_run, changes, warnings)
    elif fmt == "v2":
        return _migrate_from_v2(module_path, dry_run, changes, warnings)
    else:
        return False, [], [f"Unknown format: {fmt}"]


def migrate_all_modules(
    dry_run: bool = False,
    backup: bool = True
) -> list[tuple[str, bool, list[str], list[str]]]:
    """
    Migrate all installed modules to v2.2 format.
    
    Returns:
        List of (module_name, success, changes, warnings) tuples
    """
    results = []
    modules = list_modules()
    
    for module in modules:
        name = module.get('name', 'unknown')
        path = module.get('path')
        
        if path:
            success, changes, warnings = migrate_module(
                str(path),
                dry_run=dry_run,
                backup=backup
            )
            results.append((name, success, changes, warnings))
    
    return results


# =============================================================================
# Format-Specific Migration
# =============================================================================

def _migrate_from_v0(
    module_path: Path,
    dry_run: bool,
    changes: list[str],
    warnings: list[str]
) -> tuple[bool, list[str], list[str]]:
    """Migrate from v0 (6-file) format."""
    warnings.append("v0 format migration requires manual review")
    
    # Load existing data
    module_md_path = module_path / "module.md"
    with open(module_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    frontmatter, _ = parse_frontmatter(content)
    
    # Load prompt
    prompt_txt_path = module_path / "prompt.txt"
    with open(prompt_txt_path, 'r', encoding='utf-8') as f:
        prompt = f.read()
    
    # Load schemas
    with open(module_path / "input.schema.json", 'r', encoding='utf-8') as f:
        input_schema = json.load(f)
    with open(module_path / "output.schema.json", 'r', encoding='utf-8') as f:
        output_schema = json.load(f)
    
    # Create module.yaml
    manifest = _create_v22_manifest(frontmatter)
    
    # Create combined schema.json
    schema = _create_v22_schema(input_schema, output_schema)
    
    # Create prompt.md
    prompt_md = _create_v22_prompt(frontmatter, prompt)
    
    if dry_run:
        changes.append("[DRY RUN] Would create module.yaml")
        changes.append("[DRY RUN] Would create schema.json (combined)")
        changes.append("[DRY RUN] Would create prompt.md")
    else:
        # Write files
        _write_yaml(module_path / "module.yaml", manifest)
        changes.append("Created module.yaml")
        
        _write_json(module_path / "schema.json", schema)
        changes.append("Created schema.json (combined)")
        
        _write_text(module_path / "prompt.md", prompt_md)
        changes.append("Created prompt.md")
    
    return True, changes, warnings


def _migrate_from_v1(
    module_path: Path,
    dry_run: bool,
    changes: list[str],
    warnings: list[str]
) -> tuple[bool, list[str], list[str]]:
    """Migrate from v1 (MODULE.md + schema.json) format."""
    # Load MODULE.md
    module_md_path = module_path / "MODULE.md"
    with open(module_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    frontmatter, prompt_body = parse_frontmatter(content)
    
    # Load schema.json if exists
    schema_path = module_path / "schema.json"
    if schema_path.exists():
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        input_schema = schema.get('input', {})
        output_schema = schema.get('output', {})
    else:
        input_schema = {}
        output_schema = {}
    
    # Create module.yaml
    manifest = _create_v22_manifest(frontmatter)
    
    # Create/update schema.json with meta
    new_schema = _create_v22_schema(input_schema, output_schema)
    
    # Create prompt.md
    prompt_md = _create_v22_prompt(frontmatter, prompt_body)
    
    if dry_run:
        changes.append("[DRY RUN] Would create module.yaml")
        changes.append("[DRY RUN] Would update schema.json (add meta)")
        changes.append("[DRY RUN] Would create prompt.md")
    else:
        # Write files
        _write_yaml(module_path / "module.yaml", manifest)
        changes.append("Created module.yaml")
        
        _write_json(module_path / "schema.json", new_schema)
        changes.append("Updated schema.json (added meta)")
        
        _write_text(module_path / "prompt.md", prompt_md)
        changes.append("Created prompt.md")
        
        # Keep MODULE.md for compatibility
        changes.append("Preserved MODULE.md (backward compatibility)")
    
    return True, changes, warnings


def _migrate_from_v2(
    module_path: Path,
    dry_run: bool,
    changes: list[str],
    warnings: list[str]
) -> tuple[bool, list[str], list[str]]:
    """Migrate from v2.0/v2.1 to v2.2 format."""
    # Load module.yaml
    module_yaml_path = module_path / "module.yaml"
    with open(module_yaml_path, 'r', encoding='utf-8') as f:
        manifest = yaml.safe_load(f)
    
    # Load schema.json
    schema_path = module_path / "schema.json"
    if schema_path.exists():
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
    else:
        schema = {}
    
    # Load prompt.md
    prompt_path = module_path / "prompt.md"
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt = f.read()
    else:
        prompt = ""
    
    # Upgrade manifest to v2.2
    manifest_changes = []
    
    if 'tier' not in manifest:
        manifest['tier'] = 'decision'  # Safe default
        manifest_changes.append("Added tier: decision")
    
    if 'schema_strictness' not in manifest:
        manifest['schema_strictness'] = 'medium'
        manifest_changes.append("Added schema_strictness: medium")
    
    if 'overflow' not in manifest:
        # Determine default max_items based on schema_strictness (consistent with loader.py)
        schema_strictness = manifest.get('schema_strictness', 'medium')
        strictness_max_items = {'high': 0, 'medium': 5, 'low': 20}
        default_max_items = strictness_max_items.get(schema_strictness, 5)
        default_enabled = schema_strictness != 'high'
        
        manifest['overflow'] = {
            'enabled': default_enabled,
            'recoverable': True,
            'max_items': default_max_items,
            'require_suggested_mapping': True
        }
        manifest_changes.append(f"Added overflow config (max_items={default_max_items} based on schema_strictness={schema_strictness})")
    
    if 'enums' not in manifest:
        manifest['enums'] = {
            'strategy': 'extensible'
        }
        manifest_changes.append("Added enums config")
    
    if 'compat' not in manifest:
        manifest['compat'] = {
            'accepts_v21_payload': True,
            'runtime_auto_wrap': True,
            'schema_output_alias': 'data'
        }
        manifest_changes.append("Added compat config")
    
    # Update IO references
    if 'io' not in manifest:
        manifest['io'] = {
            'input': './schema.json#/input',
            'data': './schema.json#/data',
            'meta': './schema.json#/meta',
            'error': './schema.json#/error'
        }
        manifest_changes.append("Added io references")
    
    # Upgrade schema to v2.2
    schema_changes = []
    
    if 'meta' not in schema:
        schema['meta'] = _create_meta_schema()
        schema_changes.append("Added meta schema")
    
    # Rename output to data if needed
    if 'output' in schema and 'data' not in schema:
        schema['data'] = schema.pop('output')
        schema_changes.append("Renamed output to data")
    
    # Add rationale requirement if missing
    if 'data' in schema:
        data_required = schema['data'].get('required', [])
        if 'rationale' not in data_required:
            data_required.append('rationale')
            schema['data']['required'] = data_required
            schema_changes.append("Added rationale to data.required")
    
    # Add extensions if overflow enabled
    if manifest.get('overflow', {}).get('enabled') and '$defs' not in schema:
        schema['$defs'] = {
            'extensions': _create_extensions_schema()
        }
        schema_changes.append("Added $defs.extensions")
    
    # Update prompt if needed
    prompt_changes = []
    if 'meta' not in prompt.lower() or 'envelope' not in prompt.lower():
        prompt = _add_v22_instructions_to_prompt(prompt, manifest)
        prompt_changes.append("Added v2.2 envelope instructions")
    
    if dry_run:
        if manifest_changes:
            changes.append(f"[DRY RUN] Would update module.yaml: {', '.join(manifest_changes)}")
        if schema_changes:
            changes.append(f"[DRY RUN] Would update schema.json: {', '.join(schema_changes)}")
        if prompt_changes:
            changes.append(f"[DRY RUN] Would update prompt.md: {', '.join(prompt_changes)}")
    else:
        if manifest_changes:
            _write_yaml(module_yaml_path, manifest)
            changes.append(f"Updated module.yaml: {', '.join(manifest_changes)}")
        
        if schema_changes:
            _write_json(schema_path, schema)
            changes.append(f"Updated schema.json: {', '.join(schema_changes)}")
        
        if prompt_changes:
            _write_text(prompt_path, prompt)
            changes.append(f"Updated prompt.md: {', '.join(prompt_changes)}")
    
    return True, changes, warnings


# =============================================================================
# Helper Functions
# =============================================================================

def _create_backup(module_path: Path) -> Path:
    """Create a backup of the module directory."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = module_path.parent / f"{module_path.name}_backup_{timestamp}"
    shutil.copytree(module_path, backup_path)
    return backup_path


def _create_v22_manifest(frontmatter: dict) -> dict:
    """Create v2.2 module.yaml from frontmatter."""
    manifest = {
        'name': frontmatter.get('name', 'unknown'),
        'version': frontmatter.get('version', '2.2.0'),
        'responsibility': frontmatter.get('responsibility', ''),
        'tier': 'decision',
        'schema_strictness': 'medium',
        'excludes': frontmatter.get('excludes', []),
        'policies': {
            'network': 'deny',
            'filesystem_write': 'deny',
            'side_effects': 'deny',
            'code_execution': 'deny'
        },
        'tools': {
            'policy': 'deny_by_default',
            'allowed': [],
            'denied': ['write_file', 'shell', 'network']
        },
        'overflow': {
            'enabled': True,
            'recoverable': True,
            'max_items': 5,
            'require_suggested_mapping': True
        },
        'enums': {
            'strategy': 'extensible'
        },
        'failure': {
            'contract': 'error_union',
            'partial_allowed': True,
            'must_return_error_schema': True
        },
        'runtime_requirements': {
            'structured_output': True,
            'max_input_tokens': 8000,
            'preferred_capabilities': ['json_mode']
        },
        'io': {
            'input': './schema.json#/input',
            'data': './schema.json#/data',
            'meta': './schema.json#/meta',
            'error': './schema.json#/error'
        },
        'compat': {
            'accepts_v21_payload': True,
            'runtime_auto_wrap': True,
            'schema_output_alias': 'data'
        }
    }
    
    # Preserve constraints if present
    constraints = frontmatter.get('constraints', {})
    if constraints:
        manifest['constraints'] = constraints
    
    # Preserve context if present
    if 'context' in frontmatter:
        manifest['context'] = frontmatter['context']
    
    return manifest


def _create_v22_schema(input_schema: dict, output_schema: dict) -> dict:
    """Create v2.2 schema.json from input and output schemas."""
    return {
        '$schema': 'https://ziel-io.github.io/cognitive-modules/schema/v2.2.json',
        'meta': _create_meta_schema(),
        'input': input_schema,
        'data': _add_rationale_to_output(output_schema),
        'error': {
            'type': 'object',
            'required': ['code', 'message'],
            'properties': {
                'code': {'type': 'string'},
                'message': {'type': 'string'}
            }
        },
        '$defs': {
            'extensions': _create_extensions_schema()
        }
    }


def _create_meta_schema() -> dict:
    """Create the standard v2.2 meta schema."""
    return {
        'type': 'object',
        'required': ['confidence', 'risk', 'explain'],
        'properties': {
            'confidence': {
                'type': 'number',
                'minimum': 0,
                'maximum': 1,
                'description': 'Confidence score, unified across all modules'
            },
            'risk': {
                'type': 'string',
                'enum': ['none', 'low', 'medium', 'high'],
                'description': 'Aggregated risk level'
            },
            'explain': {
                'type': 'string',
                'maxLength': 280,
                'description': 'Short explanation for control plane'
            },
            'trace_id': {'type': 'string'},
            'model': {'type': 'string'},
            'latency_ms': {'type': 'number', 'minimum': 0}
        }
    }


def _create_extensions_schema() -> dict:
    """Create the standard extensions schema for overflow."""
    return {
        'type': 'object',
        'properties': {
            'insights': {
                'type': 'array',
                'maxItems': 5,
                'items': {
                    'type': 'object',
                    'required': ['text', 'suggested_mapping'],
                    'properties': {
                        'text': {'type': 'string'},
                        'suggested_mapping': {'type': 'string'},
                        'evidence': {'type': 'string'}
                    }
                }
            }
        }
    }


def _add_rationale_to_output(output_schema: dict) -> dict:
    """Ensure output schema has rationale field."""
    schema = dict(output_schema)
    
    # Ensure required includes rationale
    required = schema.get('required', [])
    if 'rationale' not in required:
        required.append('rationale')
    schema['required'] = required
    
    # Ensure properties includes rationale
    properties = schema.get('properties', {})
    if 'rationale' not in properties:
        properties['rationale'] = {
            'type': 'string',
            'description': 'Detailed explanation for audit and human review'
        }
    
    # Add extensions reference
    if 'extensions' not in properties:
        properties['extensions'] = {'$ref': '#/$defs/extensions'}
    
    schema['properties'] = properties
    
    # Remove confidence from data (moved to meta)
    # But keep for backward compat if exists
    
    return schema


def _create_v22_prompt(frontmatter: dict, prompt_body: str) -> str:
    """Create v2.2 prompt.md with envelope instructions."""
    name = frontmatter.get('name', 'Module')
    
    return f"""# {name.replace('-', ' ').title()}

{prompt_body}

## Response Format (Envelope v2.2)

You MUST wrap your response in the v2.2 envelope format with separate meta and data sections.

### Success Response

```json
{{
  "ok": true,
  "meta": {{
    "confidence": 0.9,
    "risk": "low",
    "explain": "Short summary (max 280 chars) for routing and UI display."
  }},
  "data": {{
    "...your output fields...",
    "rationale": "Detailed explanation for audit and human review..."
  }}
}}
```

### Error Response

```json
{{
  "ok": false,
  "meta": {{
    "confidence": 0.0,
    "risk": "high",
    "explain": "Brief error summary."
  }},
  "error": {{
    "code": "ERROR_CODE",
    "message": "Detailed error description"
  }}
}}
```

## Important

- `meta.explain` is for **quick decisions** (≤280 chars)
- `data.rationale` is for **audit and review** (no limit)
- Both must be present in successful responses
"""


def _add_v22_instructions_to_prompt(prompt: str, manifest: dict) -> str:
    """Add v2.2 envelope instructions to existing prompt."""
    v22_section = """

## Response Format (Envelope v2.2)

You MUST wrap your response in the v2.2 envelope format with separate meta and data sections:

- Success: `{ "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "≤280 chars" }, "data": { ...payload... } }`
- Error: `{ "ok": false, "meta": { ... }, "error": { "code": "...", "message": "..." } }`

Important:
- `meta.explain` is for quick routing (≤280 chars)
- `data.rationale` is for detailed audit (no limit)
"""
    return prompt + v22_section


def _write_yaml(path: Path, data: dict) -> None:
    """Write YAML file with nice formatting."""
    with open(path, 'w', encoding='utf-8') as f:
        # Add header comment
        f.write("# Cognitive Module Manifest v2.2\n")
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def _write_json(path: Path, data: dict) -> None:
    """Write JSON file with nice formatting."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def _write_text(path: Path, content: str) -> None:
    """Write text file."""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
