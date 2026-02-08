#!/usr/bin/env python3
"""
Test Vector Validator for Runtime Implementations

Run this script to validate your runtime implementation against
the official Cognitive Modules test vectors.

Usage:
    python validate.py
    python validate.py --verbose
    python validate.py --level 2
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple

try:
    import jsonschema
except ImportError:
    print("Error: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)


def find_spec_dir() -> Path:
    """Find the spec directory containing test vectors."""
    # Try relative paths from template location
    candidates = [
        Path(__file__).parent.parent.parent / "spec",  # When in templates/runtime-starter/
        Path(__file__).parent / "spec",                 # When copied standalone
        Path.cwd() / "spec",                            # Current directory
        Path.cwd().parent / "spec",                     # Parent directory
    ]
    
    for candidate in candidates:
        if candidate.exists() and (candidate / "test-vectors").exists():
            return candidate
    
    # Try to find by looking for cognitive-demo
    for parent in Path(__file__).parents:
        spec = parent / "spec"
        if spec.exists() and (spec / "test-vectors").exists():
            return spec
    
    return None


class EnvelopeValidator:
    """Validates envelopes against the response-envelope.schema.json."""
    
    def __init__(self, schema: dict):
        self.schema = schema
    
    def validate(self, envelope: dict) -> Tuple[bool, str]:
        try:
            jsonschema.validate(envelope, self.schema)
            return True, ""
        except jsonschema.ValidationError as e:
            return False, str(e.message)


def run_tests(spec_dir: Path, max_level: int = 3, verbose: bool = False) -> bool:
    """Run all test vectors and report results."""
    
    # Load envelope schema
    schema_path = spec_dir / "response-envelope.schema.json"
    if not schema_path.exists():
        print(f"Error: Schema not found: {schema_path}")
        return False
    
    with open(schema_path) as f:
        schema = json.load(f)
    
    validator = EnvelopeValidator(schema)
    
    # Find test vectors
    test_vectors_dir = spec_dir / "test-vectors"
    results: List[Dict[str, Any]] = []
    
    for test_file in sorted(test_vectors_dir.glob("**/*.json")):
        if test_file.name.endswith(".md"):
            continue
        
        with open(test_file) as f:
            test_data = json.load(f)
        
        test_meta = test_data.get("$test", {})
        envelope = test_data.get("envelope", {})
        
        level = test_meta.get("conformance_level", 1)
        if level > max_level:
            continue
        
        expects = test_meta.get("expects", "accept")
        is_valid, error = validator.validate(envelope)
        
        # Test passes if: (expects accept AND is valid) OR (expects reject AND is invalid)
        passed = (expects == "accept") == is_valid
        
        results.append({
            "file": test_file.name,
            "name": test_meta.get("name", test_file.stem),
            "expects": expects,
            "passed": passed,
            "is_valid": is_valid,
            "error": error
        })
    
    # Print results
    print("\n" + "=" * 60)
    print("Cognitive Modules Test Vector Validation")
    print("=" * 60)
    
    valid_tests = [r for r in results if "valid" in r["file"].lower() and "invalid" not in r["file"].lower()]
    invalid_tests = [r for r in results if "invalid" in r["file"].lower()]
    
    def print_group(tests: List[Dict], title: str):
        print(f"\n{title}")
        print("-" * 40)
        for result in tests:
            status = "✅ PASS" if result["passed"] else "❌ FAIL"
            print(f"  {status}: {result['name']}")
            if verbose and not result["passed"]:
                print(f"         Expected: {result['expects']}")
                print(f"         Valid: {result['is_valid']}")
                if result["error"]:
                    print(f"         Error: {result['error'][:80]}...")
    
    print_group(valid_tests, "Valid Envelopes (should be accepted)")
    print_group(invalid_tests, "Invalid Envelopes (should be rejected)")
    
    # Summary
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    
    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} passed, {failed} failed")
    
    if failed == 0:
        print("\n🎉 All tests passed! Your implementation is conformant.")
    else:
        print("\n⚠️  Some tests failed. Review the errors above.")
    
    print("=" * 60 + "\n")
    
    return failed == 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate against test vectors")
    parser.add_argument("--level", "-l", type=int, default=3,
                       help="Maximum conformance level (1-3)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Show detailed errors")
    parser.add_argument("--spec-dir", type=Path, default=None,
                       help="Path to spec directory")
    args = parser.parse_args()
    
    spec_dir = args.spec_dir or find_spec_dir()
    
    if not spec_dir:
        print("Error: Could not find spec directory with test vectors.")
        print("Make sure you're running from the cognitive-modules directory,")
        print("or specify --spec-dir /path/to/spec")
        sys.exit(1)
    
    print(f"Using spec directory: {spec_dir}")
    
    success = run_tests(spec_dir, max_level=args.level, verbose=args.verbose)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
