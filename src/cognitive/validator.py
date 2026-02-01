"""
Module Validator - Validate cognitive module structure and examples.
Supports v0, v1, v2.1, and v2.2 module formats.
"""

import json
from pathlib import Path
from typing import Optional, Literal

import jsonschema
import yaml

from .registry import find_module


# =============================================================================
# Main Validation Entry Point
# =============================================================================

def validate_module(
    name_or_path: str,
    v22: bool = False
) -> tuple[bool, list[str], list[str]]:
    """
    Validate a cognitive module's structure and examples.
    Supports all formats.
    
    Args:
        name_or_path: Module name or path
        v22: If True, validate v2.2 specific requirements
    
    Returns:
        Tuple of (is_valid, errors, warnings)
    """
    errors = []
    warnings = []
    
    # Find module
    path = Path(name_or_path)
    if path.exists() and path.is_dir():
        module_path = path
    else:
        module_path = find_module(name_or_path)
        if not module_path:
            return False, [f"Module not found: {name_or_path}"], []
    
    # Detect format
    has_module_yaml = (module_path / "module.yaml").exists()
    has_module_md = (module_path / "MODULE.md").exists()
    has_old_module_md = (module_path / "module.md").exists()
    
    if has_module_yaml:
        # v2.x format
        if v22:
            return _validate_v22_format(module_path)
        else:
            return _validate_v2_format(module_path)
    elif has_module_md:
        # v1 format
        if v22:
            errors.append("Module is v1 format. Use 'cogn migrate' to upgrade to v2.2")
            return False, errors, warnings
        return _validate_new_format(module_path)
    elif has_old_module_md:
        # v0 format
        if v22:
            errors.append("Module is v0 format. Use 'cogn migrate' to upgrade to v2.2")
            return False, errors, warnings
        return _validate_old_format(module_path)
    else:
        return False, ["Missing module.yaml, MODULE.md, or module.md"], []


# =============================================================================
# v2.2 Validation
# =============================================================================

def _validate_v22_format(module_path: Path) -> tuple[bool, list[str], list[str]]:
    """Validate v2.2 format (module.yaml + prompt.md + schema.json with meta)."""
    errors = []
    warnings = []
    
    # Check module.yaml
    module_yaml = module_path / "module.yaml"
    try:
        with open(module_yaml, 'r', encoding='utf-8') as f:
            manifest = yaml.safe_load(f)
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in module.yaml: {e}")
        return False, errors, warnings
    
    # Check v2.2 required fields
    v22_required_fields = ['name', 'version', 'responsibility']
    for field in v22_required_fields:
        if field not in manifest:
            errors.append(f"module.yaml missing required field: {field}")
    
    # Check tier (v2.2 specific)
    tier = manifest.get('tier')
    if tier is None:
        warnings.append("module.yaml missing 'tier' (recommended: exec | decision | exploration)")
    elif tier not in ['exec', 'decision', 'exploration']:
        errors.append(f"Invalid tier: {tier}. Must be exec | decision | exploration")
    
    # Check schema_strictness
    schema_strictness = manifest.get('schema_strictness')
    if schema_strictness and schema_strictness not in ['high', 'medium', 'low']:
        errors.append(f"Invalid schema_strictness: {schema_strictness}. Must be high | medium | low")
    
    # Check overflow config
    overflow = manifest.get('overflow', {})
    if overflow.get('enabled'):
        if overflow.get('require_suggested_mapping') is None:
            warnings.append("overflow.require_suggested_mapping not set (recommended for recoverable insights)")
    
    # Check enums config
    enums = manifest.get('enums', {})
    strategy = enums.get('strategy')
    if strategy and strategy not in ['strict', 'extensible']:
        errors.append(f"Invalid enums.strategy: {strategy}. Must be strict | extensible")
    
    # Check compat config
    compat = manifest.get('compat', {})
    if not compat:
        warnings.append("module.yaml missing 'compat' section (recommended for migration)")
    
    # Check excludes
    excludes = manifest.get('excludes', [])
    if not excludes:
        warnings.append("'excludes' list is empty (should list what module won't do)")
    
    # Check prompt.md
    prompt_path = module_path / "prompt.md"
    if not prompt_path.exists():
        errors.append("Missing prompt.md (required for v2.2)")
    else:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt = f.read()
        
        # Check for v2.2 envelope format instructions
        if 'meta' not in prompt.lower() and 'envelope' not in prompt.lower():
            warnings.append("prompt.md should mention v2.2 envelope format with meta/data separation")
        
        if len(prompt) < 100:
            warnings.append("prompt.md seems too short (< 100 chars)")
    
    # Check schema.json
    schema_path = module_path / "schema.json"
    if not schema_path.exists():
        errors.append("Missing schema.json (required for v2.2)")
    else:
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            # Check for meta schema (v2.2 required)
            if 'meta' not in schema:
                errors.append("schema.json missing 'meta' schema (required for v2.2)")
            else:
                meta_schema = schema['meta']
                meta_required = meta_schema.get('required', [])
                
                if 'confidence' not in meta_required:
                    errors.append("meta schema must require 'confidence'")
                if 'risk' not in meta_required:
                    errors.append("meta schema must require 'risk'")
                if 'explain' not in meta_required:
                    errors.append("meta schema must require 'explain'")
                
                # Check explain maxLength
                explain_props = meta_schema.get('properties', {}).get('explain', {})
                if explain_props.get('maxLength', 999) > 280:
                    warnings.append("meta.explain should have maxLength <= 280")
            
            # Check for input schema
            if 'input' not in schema:
                warnings.append("schema.json missing 'input' definition")
            
            # Check for data schema (v2.2 uses 'data' instead of 'output')
            if 'data' not in schema and 'output' not in schema:
                errors.append("schema.json missing 'data' (or 'output') definition")
            elif 'data' in schema:
                data_schema = schema['data']
                data_required = data_schema.get('required', [])
                
                if 'rationale' not in data_required:
                    warnings.append("data schema should require 'rationale' for audit")
            
            # Check for error schema
            if 'error' not in schema:
                warnings.append("schema.json missing 'error' definition")
            
            # Check for $defs/extensions (v2.2 overflow)
            if overflow.get('enabled'):
                defs = schema.get('$defs', {})
                if 'extensions' not in defs:
                    warnings.append("schema.json missing '$defs.extensions' (needed for overflow)")
                    
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in schema.json: {e}")
    
    # Check tests directory
    tests_path = module_path / "tests"
    if not tests_path.exists():
        warnings.append("Missing tests directory (recommended)")
    else:
        # Check for v2.2 format in expected files
        expected_files = list(tests_path.glob("*.expected.json"))
        for expected_file in expected_files:
            try:
                with open(expected_file, 'r', encoding='utf-8') as f:
                    expected = json.load(f)
                
                # Check if example uses v2.2 format
                example = expected.get('$example', {})
                if example.get('ok') is True and 'meta' not in example:
                    warnings.append(f"{expected_file.name}: $example missing 'meta' (v2.2 format)")
                    
            except json.JSONDecodeError:
                pass
    
    return len(errors) == 0, errors, warnings


# =============================================================================
# v2.x (non-strict) Validation
# =============================================================================

def _validate_v2_format(module_path: Path) -> tuple[bool, list[str], list[str]]:
    """Validate v2.x format without strict v2.2 requirements."""
    errors = []
    warnings = []
    
    # Check module.yaml
    module_yaml = module_path / "module.yaml"
    try:
        with open(module_yaml, 'r', encoding='utf-8') as f:
            manifest = yaml.safe_load(f)
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in module.yaml: {e}")
        return False, errors, warnings
    
    # Check required fields
    required_fields = ['name', 'version', 'responsibility']
    for field in required_fields:
        if field not in manifest:
            errors.append(f"module.yaml missing required field: {field}")
    
    # Check excludes
    excludes = manifest.get('excludes', [])
    if not excludes:
        warnings.append("'excludes' list is empty")
    
    # Check prompt.md or prompt existence in MODULE.md
    prompt_path = module_path / "prompt.md"
    module_md_path = module_path / "MODULE.md"
    
    if not prompt_path.exists() and not module_md_path.exists():
        errors.append("Missing prompt.md or MODULE.md")
    elif prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            prompt = f.read()
        if len(prompt) < 50:
            warnings.append("prompt.md seems too short (< 50 chars)")
    
    # Check schema.json
    schema_path = module_path / "schema.json"
    if not schema_path.exists():
        warnings.append("Missing schema.json (recommended)")
    else:
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            if 'input' not in schema:
                warnings.append("schema.json missing 'input' definition")
            
            # Accept both 'data' and 'output'
            if 'data' not in schema and 'output' not in schema:
                warnings.append("schema.json missing 'data' or 'output' definition")
                
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in schema.json: {e}")
    
    # Check for v2.2 features and suggest upgrade
    if manifest.get('tier') is None:
        warnings.append("Consider adding 'tier' for v2.2 (use 'cogn validate --v22' for full check)")
    
    return len(errors) == 0, errors, warnings


# =============================================================================
# v1 Format Validation (MODULE.md + schema.json)
# =============================================================================

def _validate_new_format(module_path: Path) -> tuple[bool, list[str], list[str]]:
    """Validate v1 format (MODULE.md + schema.json)."""
    errors = []
    warnings = []
    
    # Check MODULE.md
    module_md = module_path / "MODULE.md"
    if module_md.stat().st_size == 0:
        errors.append("MODULE.md is empty")
        return False, errors, warnings
    
    # Parse frontmatter
    try:
        with open(module_md, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if not content.startswith('---'):
            errors.append("MODULE.md must start with YAML frontmatter (---)")
        else:
            parts = content.split('---', 2)
            if len(parts) < 3:
                errors.append("MODULE.md frontmatter not properly closed")
            else:
                frontmatter = yaml.safe_load(parts[1])
                body = parts[2].strip()
                
                # Check required fields
                required_fields = ['name', 'version', 'responsibility', 'excludes']
                for field in required_fields:
                    if field not in frontmatter:
                        errors.append(f"MODULE.md missing required field: {field}")
                
                if 'excludes' in frontmatter:
                    if not isinstance(frontmatter['excludes'], list):
                        errors.append("'excludes' must be a list")
                    elif len(frontmatter['excludes']) == 0:
                        warnings.append("'excludes' list is empty")
                
                # Check body has content
                if len(body) < 50:
                    warnings.append("MODULE.md body seems too short (< 50 chars)")
                    
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in MODULE.md: {e}")
    
    # Check schema.json
    schema_path = module_path / "schema.json"
    if not schema_path.exists():
        warnings.append("Missing schema.json (recommended for validation)")
    else:
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            if "input" not in schema:
                warnings.append("schema.json missing 'input' definition")
            if "output" not in schema:
                warnings.append("schema.json missing 'output' definition")
            
            # Check output has required fields
            output = schema.get("output", {})
            required = output.get("required", [])
            if "confidence" not in required:
                warnings.append("output schema should require 'confidence'")
            if "rationale" not in required:
                warnings.append("output schema should require 'rationale'")
                
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in schema.json: {e}")
    
    # Check examples
    examples_path = module_path / "examples"
    if not examples_path.exists():
        warnings.append("Missing examples directory (recommended)")
    else:
        _validate_examples(examples_path, schema_path, errors, warnings)
    
    # Suggest v2.2 upgrade
    warnings.append("Consider upgrading to v2.2 format for better Control/Data separation")
    
    return len(errors) == 0, errors, warnings


# =============================================================================
# v0 Format Validation (6-file format)
# =============================================================================

def _validate_old_format(module_path: Path) -> tuple[bool, list[str], list[str]]:
    """Validate v0 format (6 files)."""
    errors = []
    warnings = []
    
    # Check required files
    required_files = [
        "module.md",
        "input.schema.json",
        "output.schema.json",
        "constraints.yaml",
        "prompt.txt",
    ]
    
    for filename in required_files:
        filepath = module_path / filename
        if not filepath.exists():
            errors.append(f"Missing required file: {filename}")
        elif filepath.stat().st_size == 0:
            errors.append(f"File is empty: {filename}")
    
    # Check examples directory
    examples_path = module_path / "examples"
    if not examples_path.exists():
        errors.append("Missing examples directory")
    else:
        if not (examples_path / "input.json").exists():
            errors.append("Missing examples/input.json")
        if not (examples_path / "output.json").exists():
            errors.append("Missing examples/output.json")
    
    if errors:
        return False, errors, warnings
    
    # Validate module.md frontmatter
    try:
        with open(module_path / "module.md", 'r', encoding='utf-8') as f:
            content = f.read()
        
        if not content.startswith('---'):
            errors.append("module.md must start with YAML frontmatter (---)")
        else:
            parts = content.split('---', 2)
            if len(parts) < 3:
                errors.append("module.md frontmatter not properly closed")
            else:
                frontmatter = yaml.safe_load(parts[1])
                required_fields = ['name', 'version', 'responsibility', 'excludes']
                for field in required_fields:
                    if field not in frontmatter:
                        errors.append(f"module.md missing required field: {field}")
                
                if 'excludes' in frontmatter:
                    if not isinstance(frontmatter['excludes'], list):
                        errors.append("'excludes' must be a list")
                    elif len(frontmatter['excludes']) == 0:
                        warnings.append("'excludes' list is empty")
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in module.md: {e}")
    
    # Suggest v2.2 upgrade
    warnings.append("v0 format is deprecated. Consider upgrading to v2.2")
    
    return len(errors) == 0, errors, warnings


# =============================================================================
# Helper Functions
# =============================================================================

def _validate_examples(
    examples_path: Path,
    schema_path: Path,
    errors: list[str],
    warnings: list[str]
) -> None:
    """Validate example files against schema."""
    if not (examples_path / "input.json").exists():
        warnings.append("Missing examples/input.json")
    if not (examples_path / "output.json").exists():
        warnings.append("Missing examples/output.json")
    
    # Validate examples against schema if both exist
    if schema_path.exists():
        try:
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            # Validate input example
            input_example_path = examples_path / "input.json"
            if input_example_path.exists() and "input" in schema:
                with open(input_example_path, 'r', encoding='utf-8') as f:
                    input_example = json.load(f)
                try:
                    jsonschema.validate(instance=input_example, schema=schema["input"])
                except jsonschema.ValidationError as e:
                    errors.append(f"Example input fails schema: {e.message}")
            
            # Validate output example
            output_example_path = examples_path / "output.json"
            output_schema = schema.get("output", schema.get("data"))
            if output_example_path.exists() and output_schema:
                with open(output_example_path, 'r', encoding='utf-8') as f:
                    output_example = json.load(f)
                try:
                    jsonschema.validate(instance=output_example, schema=output_schema)
                except jsonschema.ValidationError as e:
                    errors.append(f"Example output fails schema: {e.message}")
                
                # Check confidence
                if "confidence" in output_example:
                    conf = output_example["confidence"]
                    if not (0 <= conf <= 1):
                        errors.append(f"Confidence must be 0-1, got: {conf}")
                        
        except (json.JSONDecodeError, KeyError):
            pass


def validate_v22_envelope(response: dict) -> tuple[bool, list[str]]:
    """
    Validate a response against v2.2 envelope format.
    
    Args:
        response: The response dict to validate
        
    Returns:
        Tuple of (is_valid, errors)
    """
    errors = []
    
    # Check ok field
    if 'ok' not in response:
        errors.append("Missing 'ok' field")
        return False, errors
    
    # Check meta
    if 'meta' not in response:
        errors.append("Missing 'meta' field (required for v2.2)")
    else:
        meta = response['meta']
        
        if 'confidence' not in meta:
            errors.append("meta missing 'confidence'")
        elif not isinstance(meta['confidence'], (int, float)):
            errors.append("meta.confidence must be a number")
        elif not (0 <= meta['confidence'] <= 1):
            errors.append("meta.confidence must be between 0 and 1")
        
        if 'risk' not in meta:
            errors.append("meta missing 'risk'")
        elif meta['risk'] not in ['none', 'low', 'medium', 'high']:
            errors.append(f"meta.risk must be none|low|medium|high, got: {meta['risk']}")
        
        if 'explain' not in meta:
            errors.append("meta missing 'explain'")
        elif len(meta.get('explain', '')) > 280:
            errors.append(f"meta.explain exceeds 280 chars ({len(meta['explain'])} chars)")
    
    # Check data or error
    if response['ok']:
        if 'data' not in response:
            errors.append("Success response missing 'data' field")
        else:
            data = response['data']
            if 'rationale' not in data:
                errors.append("data missing 'rationale' (recommended for audit)")
    else:
        if 'error' not in response:
            errors.append("Error response missing 'error' field")
        else:
            error = response['error']
            if 'code' not in error:
                errors.append("error missing 'code'")
            if 'message' not in error:
                errors.append("error missing 'message'")
    
    return len(errors) == 0, errors
