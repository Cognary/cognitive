---
sidebar_position: 9
---

# Cognitive Modules Implementer's Guide

> **Version**: 2.2  
> **Audience**: Runtime developers building Cognitive Modules support  
> **Last Updated**: 2026-02

This guide helps you implement a Cognitive Modules runtime from scratch. Follow it to achieve conformance with the specification.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Step-by-Step Implementation](#3-step-by-step-implementation)
4. [Validation Pipeline](#4-validation-pipeline)
5. [Error Handling](#5-error-handling)
6. [Testing Your Implementation](#6-testing-your-implementation)
7. [Advanced Features](#7-advanced-features)
8. [Reference Implementations](#8-reference-implementations)

---

## 1. Overview

### What You're Building

A Cognitive Modules runtime is responsible for:

1. **Loading** module definitions (module.yaml, prompt.md, schema.json)
2. **Validating** inputs against the module's input schema
3. **Executing** the module by sending prompts to an LLM
4. **Validating** outputs against the module's data/meta/error schemas
5. **Wrapping** responses in the v2.2 envelope format

### Minimum Viable Implementation

To claim **Level 1 conformance**, your runtime MUST:

- Parse module.yaml, prompt.md, and schema.json
- Validate input against schema.json#/input
- Execute prompt with any LLM backend
- Validate output against v2.2 envelope schema
- Return properly formatted success/failure envelopes

### Technology Choices

The specification is language-agnostic. Reference implementations exist in:

| Language | Package | Repository |
|----------|---------|------------|
| Python | `cognitive-modules` | ziel-io/cognitive-modules |
| TypeScript | `cogn` | ziel-io/cognitive-modules/packages/cli-node |

---

## 2. Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cognitive Modules Runtime                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │    Loader    │───▶│   Executor   │───▶│  Validator   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ module.yaml  │    │ LLM Provider │    │ JSON Schema  │      │
│  │  prompt.md   │    │   Adapter    │    │  Validator   │      │
│  │ schema.json  │    └──────────────┘    └──────────────┘      │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Envelope Builder                        │  │
│  │  • Wraps LLM output in v2.2 envelope                      │  │
│  │  • Applies repair pass for minor issues                   │  │
│  │  • Aggregates risk from data fields                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Input JSON
    │
    ▼
┌─────────────────────┐
│ 1. Load Module      │ ← Read module.yaml, prompt.md, schema.json
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. Validate Input   │ ← JSON Schema validation
└─────────────────────┘
    │ Fail → Return E1001 error envelope
    ▼
┌─────────────────────┐
│ 3. Build Prompt     │ ← Substitute $ARGUMENTS, inject schema
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. Call LLM         │ ← Provider-specific API call
└─────────────────────┘
    │ Fail → Return E4001 error envelope
    ▼
┌─────────────────────┐
│ 5. Parse Response   │ ← Extract JSON from LLM output
└─────────────────────┘
    │ Fail → Return E1000 error envelope
    ▼
┌─────────────────────┐
│ 6. Validate Output  │ ← Envelope + schema validation
└─────────────────────┘
    │ Fail → Attempt repair pass
    ▼
┌─────────────────────┐
│ 7. Repair Pass      │ ← Fix minor formatting issues
└─────────────────────┘
    │ Still fail → Return E3001 with partial_data
    ▼
┌─────────────────────┐
│ 8. Return Envelope  │ ← Final v2.2 response
└─────────────────────┘
```

---

## 3. Step-by-Step Implementation

### Step 1: Module Loader

**Files to read:**

```
module-name/
├── module.yaml     # REQUIRED: Machine-readable config
├── prompt.md       # REQUIRED: LLM instructions
├── schema.json     # REQUIRED: Input/output contracts
└── MODULE.md       # OPTIONAL: Legacy format (v1 compatibility)
```

**Pseudocode:**

```python
class ModuleLoader:
    def load(self, module_path: str) -> Module:
        # 1. Read and parse module.yaml
        manifest = yaml.load(module_path / "module.yaml")
        
        # 2. Read prompt template
        prompt = read_file(module_path / "prompt.md")
        
        # 3. Read and parse schema
        schema = json.load(module_path / "schema.json")
        
        # 4. Validate manifest against module.yaml.schema.json
        validate_schema(manifest, MANIFEST_SCHEMA)
        
        return Module(
            name=manifest["name"],
            version=manifest["version"],
            tier=manifest.get("tier", "decision"),
            prompt=prompt,
            input_schema=schema.get("input"),
            data_schema=schema.get("data"),
            meta_schema=schema.get("meta"),
            error_schema=schema.get("error"),
            config=manifest
        )
```

**Key considerations:**

- Support both v2.2 format (module.yaml) and v1 format (MODULE.md frontmatter)
- Use default values from tier if schema_strictness not specified
- Validate module.yaml against the schema for early error detection

### Step 2: Input Validator

**Pseudocode:**

```python
class InputValidator:
    def validate(self, input_data: dict, module: Module) -> ValidationResult:
        try:
            # Use JSON Schema Draft-07 validator
            jsonschema.validate(input_data, module.input_schema)
            return ValidationResult(valid=True)
        except jsonschema.ValidationError as e:
            return ValidationResult(
                valid=False,
                error_code="E1001",
                message=str(e),
                path=list(e.absolute_path)
            )
```

### Step 3: Prompt Builder

**Template variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | Full user input string | "fix the login bug" |
| `$ARGUMENTS[0]` | First space-separated argument | "fix" |
| `$INPUT` | JSON-serialized input object | `{"code": "..."}` |
| `$SCHEMA` | Output schema for LLM guidance | `{"type": "object", ...}` |

**Pseudocode:**

```python
class PromptBuilder:
    def build(self, module: Module, input_data: dict, args: str = None) -> str:
        prompt = module.prompt
        
        # 1. Substitute $ARGUMENTS
        if args:
            prompt = prompt.replace("$ARGUMENTS", args)
            parts = args.split()
            for i, part in enumerate(parts):
                prompt = prompt.replace(f"$ARGUMENTS[{i}]", part)
        
        # 2. Inject input as JSON
        prompt = prompt.replace("$INPUT", json.dumps(input_data, indent=2))
        
        # 3. Inject output schema for guidance
        prompt = prompt.replace("$SCHEMA", json.dumps(module.data_schema, indent=2))
        
        # 4. Append envelope format instruction
        prompt += self._envelope_instruction(module)
        
        return prompt
    
    def _envelope_instruction(self, module: Module) -> str:
        return """

## Response Format

You MUST respond with a JSON object in this exact format:

```json
{
  "ok": true,
  "meta": {
    "confidence": <0.0-1.0>,
    "risk": "<none|low|medium|high>",
    "explain": "<brief summary, max 280 chars>"
  },
  "data": {
    "rationale": "<detailed reasoning>",
    ...other fields per schema...
  }
}
```

If you cannot complete the task, respond with:

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.0,
    "risk": "high",
    "explain": "<error summary>"
  },
  "error": {
    "code": "<ERROR_CODE>",
    "message": "<description>"
  }
}
```
"""
```

### Step 4: LLM Executor

**Provider abstraction:**

```python
class LLMProvider(ABC):
    @abstractmethod
    def complete(self, prompt: str, config: dict) -> str:
        """Send prompt to LLM and return raw response."""
        pass

class OpenAIProvider(LLMProvider):
    def complete(self, prompt: str, config: dict) -> str:
        response = openai.chat.completions.create(
            model=config.get("model", "gpt-4o"),
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}  # Use JSON mode
        )
        return response.choices[0].message.content
```

**Best practices:**

- Use JSON mode when available (OpenAI, Anthropic)
- Set appropriate temperature (0.0-0.3 for exec tier, 0.5-0.7 for exploration)
- Implement retry logic for transient failures
- Track latency for `meta.latency_ms`

### Step 5: Response Parser

**Extract JSON from LLM output:**

```python
class ResponseParser:
    def parse(self, raw_response: str) -> dict:
        # Try direct JSON parse first
        try:
            return json.loads(raw_response)
        except json.JSONDecodeError:
            pass
        
        # Try extracting from markdown code block
        match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw_response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Failed to parse
        raise ParseError("E1000", "Could not extract valid JSON from response")
```

### Step 6: Envelope Validator

**Validate against response-envelope.schema.json:**

```python
class EnvelopeValidator:
    def __init__(self):
        self.envelope_schema = load_schema("response-envelope.schema.json")
    
    def validate(self, response: dict, module: Module) -> ValidationResult:
        # 1. Validate envelope structure
        try:
            jsonschema.validate(response, self.envelope_schema)
        except jsonschema.ValidationError as e:
            return ValidationResult(valid=False, error_code="E3001", ...)
        
        # 2. Validate meta fields
        meta = response.get("meta", {})
        if not 0 <= meta.get("confidence", -1) <= 1:
            return ValidationResult(valid=False, error_code="E3001", 
                message="confidence must be between 0 and 1")
        
        # 3. Validate data against module's data schema (if success)
        if response.get("ok"):
            data = response.get("data", {})
            try:
                jsonschema.validate(data, module.data_schema)
            except jsonschema.ValidationError as e:
                return ValidationResult(valid=False, error_code="E3001", 
                    message=str(e), partial_data=data)
        
        return ValidationResult(valid=True)
```

### Step 7: Repair Pass

**Fix minor issues without changing semantics:**

```python
class RepairPass:
    def repair(self, response: dict, module: Module) -> dict:
        repaired = copy.deepcopy(response)
        
        # 1. Ensure meta exists
        if "meta" not in repaired:
            repaired["meta"] = {}
        
        meta = repaired["meta"]
        
        # 2. Fill missing confidence with conservative default
        if "confidence" not in meta:
            meta["confidence"] = 0.5
        
        # 3. Clamp confidence to valid range
        meta["confidence"] = max(0, min(1, meta["confidence"]))
        
        # 4. Fill missing risk with default
        if "risk" not in meta:
            meta["risk"] = "medium"
        
        # 5. Truncate over-length explain
        if "explain" in meta and len(meta["explain"]) > 280:
            meta["explain"] = meta["explain"][:277] + "..."
        
        # 6. Fill missing explain from rationale
        if "explain" not in meta:
            data = repaired.get("data", {})
            rationale = data.get("rationale", "")
            meta["explain"] = rationale[:200] if rationale else "No explanation provided"
        
        # 7. Ensure data.rationale exists for success responses
        if repaired.get("ok") and "data" in repaired:
            if "rationale" not in repaired["data"]:
                repaired["data"]["rationale"] = meta.get("explain", "")
        
        return repaired
```

**Rules for repair:**

- ✅ Fill missing optional fields with conservative defaults
- ✅ Truncate over-length strings
- ✅ Trim whitespace
- ❌ Never invent new enum values
- ❌ Never change business semantics
- ❌ Never add fields that don't exist in schema

### Step 8: Risk Aggregation

**Compute meta.risk from data fields:**

```python
class RiskAggregator:
    RISK_LEVELS = {"none": 0, "low": 1, "medium": 2, "high": 3}
    RISK_NAMES = ["none", "low", "medium", "high"]
    
    def aggregate(self, response: dict, module: Module) -> str:
        rule = module.config.get("meta", {}).get("risk_rule", "max_changes_risk")
        
        if rule == "explicit":
            # Module sets risk directly
            return response.get("meta", {}).get("risk", "medium")
        
        elif rule == "max_changes_risk":
            # Default: max of changes[*].risk
            data = response.get("data", {})
            changes = data.get("changes", [])
            if not changes:
                return "medium"
            max_level = max(
                self.RISK_LEVELS.get(c.get("risk", "medium"), 2) 
                for c in changes
            )
            return self.RISK_NAMES[max_level]
        
        elif rule == "max_issues_risk":
            # For review modules: max of issues[*].risk
            data = response.get("data", {})
            issues = data.get("issues", [])
            if not issues:
                return "low"
            max_level = max(
                self.RISK_LEVELS.get(i.get("risk", "medium"), 2) 
                for i in issues
            )
            return self.RISK_NAMES[max_level]
        
        return "medium"
```

---

## 4. Validation Pipeline

### Complete Validation Flow

```python
class ValidationPipeline:
    def validate_response(self, response: dict, module: Module) -> EnvelopeResult:
        # Stage 1: Envelope structure
        if not self.validate_envelope_structure(response):
            return self.build_error("E3001", "Invalid envelope structure")
        
        # Stage 2: Meta field validation
        meta_result = self.validate_meta(response.get("meta", {}))
        if not meta_result.valid:
            return self.build_error("E3001", meta_result.message)
        
        # Stage 3: Success/failure specific validation
        if response.get("ok"):
            data_result = self.validate_data(response.get("data", {}), module)
            if not data_result.valid:
                # Attempt repair
                repaired = self.repair_pass.repair(response, module)
                data_result = self.validate_data(repaired.get("data", {}), module)
                if not data_result.valid:
                    return self.build_error("E3001", data_result.message, 
                        partial_data=response.get("data"))
                return EnvelopeResult(valid=True, response=repaired)
        else:
            error_result = self.validate_error(response.get("error", {}), module)
            if not error_result.valid:
                return self.build_error("E3001", error_result.message)
        
        return EnvelopeResult(valid=True, response=response)
```

---

## 5. Error Handling

### Building Error Envelopes

```python
class ErrorBuilder:
    def build(self, code: str, message: str, 
              recoverable: bool = False,
              suggestion: str = None,
              partial_data: dict = None) -> dict:
        
        envelope = {
            "ok": False,
            "meta": {
                "confidence": 0.0,
                "risk": "high",
                "explain": message[:280]
            },
            "error": {
                "code": code,
                "message": message
            }
        }
        
        if recoverable:
            envelope["error"]["recoverable"] = True
        
        if suggestion:
            envelope["error"]["suggestion"] = suggestion
        
        if partial_data:
            envelope["partial_data"] = partial_data
        
        return envelope
```

### Error Scenarios

| Scenario | Error Code | Recoverable | Example |
|----------|------------|-------------|---------|
| Input validation fails | E1001 | Yes | Missing required field |
| JSON parse fails | E1000 | No | LLM returned invalid JSON |
| Confidence too low | E2001 | Yes | 0.3 < threshold 0.7 |
| LLM timeout | E2002 | Yes | Request took > 60s |
| Output schema violation | E3001 | No | Missing rationale |
| Provider unavailable | E4001 | Yes | OpenAI 503 |
| Rate limited | E4002 | Yes | 429 response |

---

## 6. Testing Your Implementation

### Using Official Test Vectors

```python
import json
from pathlib import Path

def run_test_vectors(runtime, test_dir: Path):
    results = {"pass": 0, "fail": 0}
    
    for test_file in test_dir.glob("**/*.json"):
        with open(test_file) as f:
            test = json.load(f)
        
        test_meta = test["$test"]
        envelope = test["envelope"]
        
        # Validate envelope
        try:
            result = runtime.validate_envelope(envelope)
            is_valid = result.valid
        except Exception:
            is_valid = False
        
        expected_valid = (test_meta["expects"] == "accept")
        
        if is_valid == expected_valid:
            print(f"✅ PASS: {test_file.name}")
            results["pass"] += 1
        else:
            print(f"❌ FAIL: {test_file.name}")
            print(f"   Expected: {test_meta['expects']}, Got: {'accept' if is_valid else 'reject'}")
            results["fail"] += 1
    
    print(f"\nResults: {results['pass']} passed, {results['fail']} failed")
    return results
```

### Test Categories

**Level 1 tests (required for basic conformance):**

```
spec/test-vectors/valid/
├── minimal.json              # Minimal valid envelope
├── full-featured.json        # All optional fields
├── failure-minimal.json      # Basic error response
└── failure-with-partial.json # Error with partial_data

spec/test-vectors/invalid/
├── missing-ok.json           # Missing required field
├── missing-confidence.json   # Missing meta.confidence
├── wrong-type-confidence.json # Type error
└── confidence-out-of-range.json # Constraint violation
```

**Level 2 tests (required for standard conformance):**

```
spec/test-vectors/valid/
└── extensible-enum.json      # Custom enum value

spec/test-vectors/invalid/
└── ... tier-specific tests
```

### Integration Testing

```python
def test_end_to_end():
    runtime = CognitiveRuntime()
    
    # Load a real module
    module = runtime.load_module("code-simplifier")
    
    # Run with test input
    result = runtime.run(module, {
        "code": "def calc(x):\n    result = x * 2\n    return result",
        "language": "python"
    })
    
    # Validate response structure
    assert result["ok"] == True
    assert 0 <= result["meta"]["confidence"] <= 1
    assert result["meta"]["risk"] in ["none", "low", "medium", "high"]
    assert len(result["meta"]["explain"]) <= 280
    assert "rationale" in result["data"]
```

---

## 7. Advanced Features

### Level 2: Tier Enforcement

```python
class TierEnforcer:
    TIER_DEFAULTS = {
        "exec": {
            "schema_strictness": "high",
            "overflow_enabled": False,
            "overflow_max_items": 0,
            "enum_strategy": "strict"
        },
        "decision": {
            "schema_strictness": "medium",
            "overflow_enabled": True,
            "overflow_max_items": 5,
            "enum_strategy": "extensible"
        },
        "exploration": {
            "schema_strictness": "low",
            "overflow_enabled": True,
            "overflow_max_items": 20,
            "enum_strategy": "extensible"
        }
    }
    
    def get_effective_config(self, module: Module) -> dict:
        tier = module.config.get("tier", "decision")
        defaults = self.TIER_DEFAULTS[tier]
        
        # Module config overrides defaults
        config = defaults.copy()
        if "overflow" in module.config:
            config.update({
                "overflow_enabled": module.config["overflow"].get("enabled", defaults["overflow_enabled"]),
                "overflow_max_items": module.config["overflow"].get("max_items", defaults["overflow_max_items"])
            })
        
        return config
```

### Level 2: Extensible Enum Validation

```python
class EnumValidator:
    def validate_extensible_enum(self, value, enum_values: list) -> bool:
        # Standard enum value
        if isinstance(value, str) and value in enum_values:
            return True
        
        # Custom extension: {"custom": "...", "reason": "..."}
        if isinstance(value, dict):
            if "custom" in value and "reason" in value:
                custom = value["custom"]
                if isinstance(custom, str) and 1 <= len(custom) <= 32:
                    return True
        
        return False
```

### Level 3: Subagent Execution

```python
class SubagentExecutor:
    MAX_DEPTH = 5
    
    def execute_with_subagents(self, module: Module, input_data: dict, 
                               depth: int = 0, visited: set = None) -> dict:
        if depth > self.MAX_DEPTH:
            return self.error_builder.build("E4005", "Maximum call depth exceeded")
        
        if visited is None:
            visited = set()
        
        if module.name in visited:
            return self.error_builder.build("E4004", 
                f"Circular dependency detected: {module.name}")
        
        visited.add(module.name)
        
        # Parse @call:module directives from prompt
        calls = self.parse_call_directives(module.prompt)
        
        # Execute each submodule
        subresults = {}
        for call in calls:
            submodule = self.loader.load(call.module_name)
            subresult = self.execute_with_subagents(
                submodule, call.args, depth + 1, visited.copy()
            )
            subresults[call.module_name] = subresult
        
        # Inject subresults into prompt
        prompt = self.inject_subresults(module.prompt, subresults)
        
        # Execute main module
        return self.execute_single(module, input_data, prompt)
```

---

## 8. Reference Implementations

### Python Reference

```python
# Install
pip install cognitive-modules

# Source code
# https://github.com/ziel-io/cognitive-modules/tree/main/src/cognitive

# Key files:
# - loader.py: Module loading
# - runner.py: Execution with v2.2 envelope
# - validator.py: Schema validation
```

### TypeScript Reference

```typescript
// Install
npm install cognitive-modules-cli

// Source code
// https://github.com/ziel-io/cognitive-modules/tree/main/packages/cli-node/src

// Key files:
// - modules/loader.ts: Module loading
// - modules/runner.ts: Execution
// - providers/: LLM adapters
```

### Minimal Implementation Checklist

```
□ Module Loader
  □ Parse module.yaml (YAML)
  □ Read prompt.md
  □ Parse schema.json (JSON Schema Draft-07)
  
□ Input Validation
  □ JSON Schema validation
  □ Return E1001 for invalid input

□ Prompt Builder
  □ $ARGUMENTS substitution
  □ Envelope format instruction

□ LLM Execution
  □ At least one provider (OpenAI recommended)
  □ JSON mode support
  □ Error handling (E4001, E4002)

□ Response Parsing
  □ Direct JSON parse
  □ Markdown code block extraction
  □ Return E1000 for parse failures

□ Envelope Validation
  □ Validate against response-envelope.schema.json
  □ Validate meta.confidence [0, 1]
  □ Validate meta.risk enum
  □ Validate meta.explain maxLength

□ Repair Pass
  □ Fill missing meta fields
  □ Truncate over-length explain
  □ Never change business data

□ Test Vectors
  □ Pass all Level 1 valid tests
  □ Reject all Level 1 invalid tests
```

---

## Questions?

- **Specification**: [SPEC-v2.2.md](./spec-v22)
- **Conformance Levels**: [CONFORMANCE.md](./conformance)
- **Error Codes**: [ERROR-CODES.md](./error-codes)
- **Test Vectors**: [spec/test-vectors/](https://github.com/ziel-io/cognitive-modules/tree/main/spec/test-vectors)

For questions not covered here, open an issue on GitHub.
