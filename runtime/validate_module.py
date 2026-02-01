#!/usr/bin/env python3
"""
Cognitive Module Validator

Validates that a cognitive module is properly structured and its
example input/output files conform to the defined schemas.

Usage:
    python validate_module.py <module_name>
    python validate_module.py --all

Example:
    python validate_module.py ui-spec-generator
"""

import argparse
import json
import sys
from pathlib import Path

import jsonschema
import yaml


def validate_module(module_name: str) -> tuple[bool, list]:
    """
    Validate a cognitive module's structure and examples.
    
    Returns:
        Tuple of (is_valid, list of error messages)
    """
    errors = []
    warnings = []
    
    module_path = Path(__file__).parent.parent / "cognitive" / "modules" / module_name
    
    if not module_path.exists():
        return False, [f"Module directory not found: {module_path}"]
    
    print(f"\n{'='*60}")
    print(f"Validating module: {module_name}")
    print(f"{'='*60}")
    
    # Check required files exist
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
        else:
            print(f"  ✓ {filename}")
    
    # Check examples directory
    examples_path = module_path / "examples"
    if not examples_path.exists():
        errors.append("Missing examples directory")
    else:
        example_input = examples_path / "input.json"
        example_output = examples_path / "output.json"
        
        if not example_input.exists():
            errors.append("Missing examples/input.json")
        else:
            print(f"  ✓ examples/input.json")
            
        if not example_output.exists():
            errors.append("Missing examples/output.json")
        else:
            print(f"  ✓ examples/output.json")
    
    if errors:
        return False, errors
    
    # Load and validate module.md frontmatter
    print("\n  Checking module.md frontmatter...")
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
                    else:
                        print(f"    ✓ {field}: present")
                
                if 'excludes' in frontmatter:
                    if not isinstance(frontmatter['excludes'], list):
                        errors.append("'excludes' must be a list")
                    elif len(frontmatter['excludes']) == 0:
                        warnings.append("'excludes' list is empty")
                        
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in module.md: {e}")
    
    # Load schemas
    print("\n  Loading schemas...")
    try:
        with open(module_path / "input.schema.json", 'r', encoding='utf-8') as f:
            input_schema = json.load(f)
        print("    ✓ input.schema.json is valid JSON")
        
        # Check schema has additionalProperties: false
        if input_schema.get('additionalProperties') != False:
            warnings.append("input.schema.json should have additionalProperties: false at root")
            
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in input.schema.json: {e}")
        input_schema = None
    
    try:
        with open(module_path / "output.schema.json", 'r', encoding='utf-8') as f:
            output_schema = json.load(f)
        print("    ✓ output.schema.json is valid JSON")
        
        # Check required output fields
        required_output_fields = ['confidence', 'rationale']
        if 'required' in output_schema:
            for field in required_output_fields:
                if field not in output_schema['required']:
                    warnings.append(f"output.schema.json should require '{field}'")
                    
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in output.schema.json: {e}")
        output_schema = None
    
    # Load and validate constraints
    print("\n  Checking constraints.yaml...")
    try:
        with open(module_path / "constraints.yaml", 'r', encoding='utf-8') as f:
            constraints = yaml.safe_load(f)
        
        required_constraints = ['no_external_network', 'no_side_effects', 'no_inventing_data']
        if 'operational' in constraints:
            for constraint in required_constraints:
                if constraint in constraints['operational']:
                    if constraints['operational'][constraint]:
                        print(f"    ✓ {constraint}: enforced")
                    else:
                        warnings.append(f"Constraint '{constraint}' is set to false")
                else:
                    warnings.append(f"Missing operational constraint: {constraint}")
        else:
            warnings.append("Missing 'operational' section in constraints")
            
    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML in constraints.yaml: {e}")
        constraints = None
    
    # Check prompt.txt
    print("\n  Checking prompt.txt...")
    with open(module_path / "prompt.txt", 'r', encoding='utf-8') as f:
        prompt = f.read()
    
    if len(prompt) < 100:
        warnings.append("prompt.txt seems too short (< 100 chars)")
    else:
        print(f"    ✓ prompt.txt: {len(prompt)} characters")
    
    # Validate example input against schema
    if input_schema:
        print("\n  Validating examples/input.json against schema...")
        try:
            with open(examples_path / "input.json", 'r', encoding='utf-8') as f:
                example_input = json.load(f)
            
            jsonschema.validate(instance=example_input, schema=input_schema)
            print("    ✓ Example input validates against schema")
            
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in examples/input.json: {e}")
        except jsonschema.ValidationError as e:
            errors.append(f"Example input fails schema validation: {e.message}")
    
    # Validate example output against schema
    if output_schema:
        print("\n  Validating examples/output.json against schema...")
        try:
            with open(examples_path / "output.json", 'r', encoding='utf-8') as f:
                example_output = json.load(f)
            
            jsonschema.validate(instance=example_output, schema=output_schema)
            print("    ✓ Example output validates against schema")
            
            # Check confidence value
            if 'confidence' in example_output:
                conf = example_output['confidence']
                if 0 <= conf <= 1:
                    print(f"    ✓ Confidence value: {conf}")
                else:
                    errors.append(f"Confidence must be between 0 and 1, got: {conf}")
            
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in examples/output.json: {e}")
        except jsonschema.ValidationError as e:
            errors.append(f"Example output fails schema validation: {e.message}")
    
    # Print warnings
    if warnings:
        print(f"\n  ⚠ Warnings ({len(warnings)}):")
        for warning in warnings:
            print(f"    - {warning}")
    
    # Summary
    print(f"\n{'='*60}")
    if errors:
        print(f"✗ FAILED: {len(errors)} error(s)")
        for err in errors:
            print(f"  - {err}")
        return False, errors
    else:
        print(f"✓ PASSED: Module '{module_name}' is valid")
        return True, []


def list_modules() -> list:
    """List all available modules."""
    modules_path = Path(__file__).parent.parent / "cognitive" / "modules"
    if not modules_path.exists():
        return []
    return [d.name for d in modules_path.iterdir() if d.is_dir()]


def main():
    parser = argparse.ArgumentParser(
        description="Validate Cognitive Module structure and examples"
    )
    parser.add_argument("module", nargs="?", help="Name of the module to validate")
    parser.add_argument("--all", action="store_true", help="Validate all modules")
    parser.add_argument("--list", action="store_true", help="List available modules")
    
    args = parser.parse_args()
    
    if args.list:
        modules = list_modules()
        print("Available modules:")
        for m in modules:
            print(f"  - {m}")
        return
    
    if args.all:
        modules = list_modules()
        if not modules:
            print("No modules found")
            sys.exit(1)
        
        results = {}
        for module in modules:
            is_valid, errors = validate_module(module)
            results[module] = is_valid
        
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        print(f"Passed: {passed}/{total}")
        
        for module, is_valid in results.items():
            status = "✓" if is_valid else "✗"
            print(f"  {status} {module}")
        
        sys.exit(0 if passed == total else 1)
    
    if not args.module:
        parser.print_help()
        sys.exit(1)
    
    is_valid, errors = validate_module(args.module)
    sys.exit(0 if is_valid else 1)


if __name__ == "__main__":
    main()
