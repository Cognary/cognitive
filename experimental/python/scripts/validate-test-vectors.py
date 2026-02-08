#!/usr/bin/env python3
"""
Cognitive Modules Test Vector Validator

Validates envelopes against the response-envelope.schema.json and runs
all test vectors in spec/test-vectors/ to verify conformance.

Usage:
    python scripts/validate-test-vectors.py
    python scripts/validate-test-vectors.py --level 2
    python scripts/validate-test-vectors.py --verbose
"""

import json
import sys
from pathlib import Path
from typing import Tuple, List, Dict, Any

try:
    import jsonschema
except ImportError:
    print("Error: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)


class TestVectorValidator:
    """Validates test vectors against the envelope schema."""
    
    def __init__(self, spec_dir: Path):
        self.spec_dir = spec_dir
        self.envelope_schema = self._load_schema("response-envelope.schema.json")
        self.results: List[Dict[str, Any]] = []
        
    def _load_schema(self, filename: str) -> dict:
        """Load a JSON schema file."""
        schema_path = self.spec_dir / filename
        if not schema_path.exists():
            raise FileNotFoundError(f"Schema not found: {schema_path}")
        with open(schema_path) as f:
            return json.load(f)
    
    def validate_envelope(self, envelope: dict) -> Tuple[bool, str]:
        """
        Validate an envelope against the schema.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            jsonschema.validate(envelope, self.envelope_schema)
            return True, ""
        except jsonschema.ValidationError as e:
            return False, str(e.message)
        except jsonschema.SchemaError as e:
            return False, f"Schema error: {e.message}"
    
    def run_test_vector(self, test_file: Path) -> Dict[str, Any]:
        """
        Run a single test vector.
        
        Returns:
            Test result dictionary
        """
        with open(test_file) as f:
            test_data = json.load(f)
        
        test_meta = test_data.get("$test", {})
        envelope = test_data.get("envelope", {})
        
        test_name = test_meta.get("name", test_file.stem)
        expects = test_meta.get("expects", "accept")
        level = test_meta.get("conformance_level", 1)
        
        is_valid, error_msg = self.validate_envelope(envelope)
        
        # Determine if test passed
        if expects == "accept":
            passed = is_valid
        else:  # expects == "reject"
            passed = not is_valid
        
        return {
            "file": str(test_file.relative_to(self.spec_dir.parent)),
            "name": test_name,
            "expects": expects,
            "level": level,
            "passed": passed,
            "is_valid": is_valid,
            "error": error_msg if not is_valid else None
        }
    
    def run_all_tests(self, max_level: int = 3) -> Tuple[int, int]:
        """
        Run all test vectors up to the specified conformance level.
        
        Returns:
            Tuple of (passed_count, failed_count)
        """
        test_vectors_dir = self.spec_dir / "test-vectors"
        
        if not test_vectors_dir.exists():
            print(f"Error: Test vectors directory not found: {test_vectors_dir}")
            return 0, 0
        
        passed = 0
        failed = 0
        
        # Find all test vector files
        for test_file in sorted(test_vectors_dir.glob("**/*.json")):
            if test_file.name == "README.md":
                continue
                
            result = self.run_test_vector(test_file)
            
            # Skip tests above the requested level
            if result["level"] > max_level:
                continue
            
            self.results.append(result)
            
            if result["passed"]:
                passed += 1
            else:
                failed += 1
        
        return passed, failed
    
    def print_results(self, verbose: bool = False):
        """Print test results."""
        print("\n" + "=" * 60)
        print("Cognitive Modules Test Vector Validation")
        print("=" * 60 + "\n")
        
        # Group by directory (check for /valid/ not just valid/)
        valid_tests = [r for r in self.results if "/valid/" in r["file"] or r["file"].startswith("valid/")]
        invalid_tests = [r for r in self.results if "/invalid/" in r["file"] or r["file"].startswith("invalid/")]
        
        def print_group(tests: List[Dict], title: str):
            print(f"\n{title}")
            print("-" * 40)
            for result in tests:
                status = "✅ PASS" if result["passed"] else "❌ FAIL"
                print(f"  {status}: {result['name']}")
                if verbose and not result["passed"]:
                    print(f"         Expected: {result['expects']}")
                    print(f"         Got valid: {result['is_valid']}")
                    if result["error"]:
                        print(f"         Error: {result['error'][:100]}...")
        
        print_group(valid_tests, "Valid Envelopes (should be accepted)")
        print_group(invalid_tests, "Invalid Envelopes (should be rejected)")
        
        # Summary
        passed = sum(1 for r in self.results if r["passed"])
        failed = sum(1 for r in self.results if not r["passed"])
        total = len(self.results)
        
        print("\n" + "=" * 60)
        print(f"Results: {passed}/{total} passed, {failed} failed")
        print("=" * 60 + "\n")
        
        return failed == 0


def validate_single_envelope(envelope: dict, spec_dir: Path) -> bool:
    """Validate a single envelope (for use as a library)."""
    validator = TestVectorValidator(spec_dir)
    is_valid, error = validator.validate_envelope(envelope)
    if not is_valid:
        print(f"Validation failed: {error}")
    return is_valid


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Validate Cognitive Modules test vectors"
    )
    parser.add_argument(
        "--level", "-l",
        type=int,
        default=3,
        choices=[1, 2, 3],
        help="Maximum conformance level to test (default: 3)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed error messages"
    )
    parser.add_argument(
        "--spec-dir",
        type=Path,
        default=None,
        help="Path to spec directory"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    
    args = parser.parse_args()
    
    # Find spec directory
    if args.spec_dir:
        spec_dir = args.spec_dir
    else:
        # Try to find it relative to script location
        script_dir = Path(__file__).parent
        spec_dir = script_dir.parent / "spec"
        if not spec_dir.exists():
            spec_dir = Path.cwd() / "spec"
    
    if not spec_dir.exists():
        print(f"Error: Spec directory not found: {spec_dir}")
        sys.exit(1)
    
    # Run validation
    validator = TestVectorValidator(spec_dir)
    passed, failed = validator.run_all_tests(max_level=args.level)
    
    if args.json:
        output = {
            "passed": passed,
            "failed": failed,
            "total": passed + failed,
            "level": args.level,
            "results": validator.results
        }
        print(json.dumps(output, indent=2))
    else:
        success = validator.print_results(verbose=args.verbose)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
