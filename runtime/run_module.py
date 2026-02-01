#!/usr/bin/env python3
"""
Cognitive Module Runner

Usage:
    python run_module.py <module_name> <input_file> [--output <output_file>] [--validate]

Example:
    python run_module.py ui-spec-generator examples/input.json --output result.json --validate
"""

import argparse
import json
import sys
from pathlib import Path

import jsonschema
import yaml

from llm_stub import call_llm


def load_module(module_name: str) -> dict:
    """Load a cognitive module's configuration and schemas."""
    module_path = Path(__file__).parent.parent / "cognitive" / "modules" / module_name
    
    if not module_path.exists():
        raise FileNotFoundError(f"Module not found: {module_name}")
    
    # Load module metadata
    module_md_path = module_path / "module.md"
    with open(module_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # Parse YAML frontmatter
        if content.startswith('---'):
            _, frontmatter, _ = content.split('---', 2)
            metadata = yaml.safe_load(frontmatter)
        else:
            metadata = {}
    
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
        "name": module_name,
        "path": module_path,
        "metadata": metadata,
        "input_schema": input_schema,
        "output_schema": output_schema,
        "constraints": constraints,
        "prompt": prompt,
    }


def validate_input(data: dict, schema: dict) -> list:
    """Validate input data against schema. Returns list of errors."""
    errors = []
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Input validation error: {e.message} at {list(e.absolute_path)}")
    except jsonschema.SchemaError as e:
        errors.append(f"Schema error: {e.message}")
    return errors


def validate_output(data: dict, schema: dict) -> list:
    """Validate output data against schema. Returns list of errors."""
    errors = []
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Output validation error: {e.message} at {list(e.absolute_path)}")
    except jsonschema.SchemaError as e:
        errors.append(f"Schema error: {e.message}")
    return errors


def build_llm_prompt(module: dict, input_data: dict) -> str:
    """Build the complete prompt for the LLM."""
    prompt_parts = [
        module["prompt"],
        "\n\n## Constraints\n",
        yaml.dump(module["constraints"], default_flow_style=False),
        "\n\n## Input\n",
        "```json\n",
        json.dumps(input_data, indent=2),
        "\n```\n",
        "\n## Instructions\n",
        "Analyze the input and generate a complete UI specification.",
        "Return ONLY valid JSON matching the output schema.",
        "Do not include any text before or after the JSON.",
    ]
    return "".join(prompt_parts)


def run_module(module_name: str, input_data: dict, validate: bool = True) -> dict:
    """
    Run a cognitive module with the given input.
    
    Args:
        module_name: Name of the module to run
        input_data: Input data dictionary
        validate: Whether to validate input/output against schemas
    
    Returns:
        The module output as a dictionary
    """
    # Load module
    module = load_module(module_name)
    print(f"✓ Loaded module: {module_name}")
    
    # Validate input
    if validate:
        input_errors = validate_input(input_data, module["input_schema"])
        if input_errors:
            print("✗ Input validation failed:")
            for err in input_errors:
                print(f"  - {err}")
            raise ValueError("Input validation failed")
        print("✓ Input validation passed")
    
    # Build prompt and call LLM
    full_prompt = build_llm_prompt(module, input_data)
    print(f"✓ Built prompt ({len(full_prompt)} chars)")
    
    print("→ Calling LLM...")
    response = call_llm(full_prompt)
    
    # Parse response as JSON
    try:
        # Handle potential markdown code blocks in response
        response_text = response.strip()
        if response_text.startswith("```"):
            # Remove markdown code block
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        output_data = json.loads(response_text)
        print("✓ Parsed LLM response as JSON")
    except json.JSONDecodeError as e:
        print(f"✗ Failed to parse LLM response as JSON: {e}")
        print(f"  Response preview: {response[:200]}...")
        raise
    
    # Validate output
    if validate:
        output_errors = validate_output(output_data, module["output_schema"])
        if output_errors:
            print("✗ Output validation failed:")
            for err in output_errors:
                print(f"  - {err}")
            raise ValueError("Output validation failed")
        print("✓ Output validation passed")
    
    # Check confidence
    if "confidence" in output_data:
        confidence = output_data["confidence"]
        thresholds = module["constraints"].get("confidence_thresholds", {})
        min_viable = thresholds.get("minimum_viable", 0.6)
        
        if confidence < min_viable:
            print(f"⚠ Low confidence: {confidence:.2f} (threshold: {min_viable})")
        else:
            print(f"✓ Confidence: {confidence:.2f}")
    
    return output_data


def main():
    parser = argparse.ArgumentParser(
        description="Run a Cognitive Module",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with example input
  python run_module.py ui-spec-generator ../cognitive/modules/ui-spec-generator/examples/input.json

  # Run and save output
  python run_module.py ui-spec-generator input.json --output result.json

  # Run without validation (for testing)
  python run_module.py ui-spec-generator input.json --no-validate
        """
    )
    parser.add_argument("module", help="Name of the module to run")
    parser.add_argument("input_file", help="Path to input JSON file")
    parser.add_argument("--output", "-o", help="Path to save output JSON")
    parser.add_argument("--no-validate", action="store_true", help="Skip schema validation")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print output JSON")
    
    args = parser.parse_args()
    
    # Load input
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    with open(input_path, 'r', encoding='utf-8') as f:
        input_data = json.load(f)
    
    try:
        # Run module
        output = run_module(
            args.module,
            input_data,
            validate=not args.no_validate
        )
        
        # Output results
        indent = 2 if args.pretty else None
        output_json = json.dumps(output, indent=indent, ensure_ascii=False)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output_json)
            print(f"✓ Output saved to: {args.output}")
        else:
            print("\n" + "=" * 60)
            print("OUTPUT:")
            print("=" * 60)
            print(output_json)
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
