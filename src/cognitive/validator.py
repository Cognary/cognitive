"""
Module Validator - Validate cognitive module structure and examples.
"""

import json
from pathlib import Path
from typing import Optional

import jsonschema
import yaml

from .registry import find_module


def validate_module(name_or_path: str) -> tuple[bool, list[str], list[str]]:
    """
    Validate a cognitive module's structure and examples.
    
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
    
    # Load and validate schemas
    input_schema = None
    output_schema = None
    
    try:
        with open(module_path / "input.schema.json", 'r', encoding='utf-8') as f:
            input_schema = json.load(f)
        if input_schema.get('additionalProperties') != False:
            warnings.append("input.schema.json should have additionalProperties: false")
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in input.schema.json: {e}")
    
    try:
        with open(module_path / "output.schema.json", 'r', encoding='utf-8') as f:
            output_schema = json.load(f)
        required_output_fields = ['confidence', 'rationale']
        if 'required' in output_schema:
            for field in required_output_fields:
                if field not in output_schema['required']:
                    warnings.append(f"output.schema.json should require '{field}'")
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in output.schema.json: {e}")
    
    # Validate constraints
    try:
        with open(module_path / "constraints.yaml", 'r', encoding='utf-8') as f:
            constraints = yaml.safe_load(f)
        
        required_constraints = ['no_external_network', 'no_side_effects', 'no_inventing_data']
        if 'operational' in constraints:
            for constraint in required_constraints:
                if constraint not in constraints['operational']:
                    warnings.append(f"Missing operational constraint: {constraint}")
                elif not constraints['operational'][constraint]:
                    warnings.append(f"Constraint '{constraint}' is set to false")
        else:
            warnings.append("Missing 'operational' section in constraints")
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in constraints.yaml: {e}")
    
    # Check prompt.txt
    with open(module_path / "prompt.txt", 'r', encoding='utf-8') as f:
        prompt = f.read()
    if len(prompt) < 100:
        warnings.append("prompt.txt seems too short (< 100 chars)")
    
    # Validate example input against schema
    if input_schema:
        try:
            with open(examples_path / "input.json", 'r', encoding='utf-8') as f:
                example_input = json.load(f)
            jsonschema.validate(instance=example_input, schema=input_schema)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in examples/input.json: {e}")
        except jsonschema.ValidationError as e:
            errors.append(f"Example input fails schema validation: {e.message}")
    
    # Validate example output against schema
    if output_schema:
        try:
            with open(examples_path / "output.json", 'r', encoding='utf-8') as f:
                example_output = json.load(f)
            jsonschema.validate(instance=example_output, schema=output_schema)
            
            # Check confidence
            if 'confidence' in example_output:
                conf = example_output['confidence']
                if not (0 <= conf <= 1):
                    errors.append(f"Confidence must be between 0 and 1, got: {conf}")
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in examples/output.json: {e}")
        except jsonschema.ValidationError as e:
            errors.append(f"Example output fails schema validation: {e.message}")
    
    return len(errors) == 0, errors, warnings
