"""
Cognitive Modules Runtime - Minimal Implementation

This is a starter template for building a Cognitive Modules runtime.
Implement the TODO sections to achieve conformance.

Conformance Target: Level 1 (Basic)
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import yaml
import jsonschema


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Module:
    """Represents a loaded Cognitive Module."""
    name: str
    version: str
    tier: str
    prompt: str
    input_schema: dict
    data_schema: dict
    meta_schema: dict
    error_schema: dict
    config: dict


@dataclass
class Envelope:
    """Represents a v2.2 response envelope."""
    ok: bool
    meta: Dict[str, Any]
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    partial_data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> dict:
        result = {"ok": self.ok, "meta": self.meta}
        if self.ok:
            result["data"] = self.data
        else:
            result["error"] = self.error
            if self.partial_data:
                result["partial_data"] = self.partial_data
        return result


# =============================================================================
# Module Loader
# =============================================================================

class ModuleLoader:
    """Loads Cognitive Modules from disk."""
    
    def load(self, module_path: Path) -> Module:
        """
        Load a module from the given path.
        
        Args:
            module_path: Path to module directory
            
        Returns:
            Loaded Module instance
        """
        # Load module.yaml
        manifest_path = module_path / "module.yaml"
        if not manifest_path.exists():
            raise FileNotFoundError(f"module.yaml not found in {module_path}")
        
        with open(manifest_path) as f:
            manifest = yaml.safe_load(f)
        
        # Load prompt.md
        prompt_path = module_path / "prompt.md"
        if not prompt_path.exists():
            raise FileNotFoundError(f"prompt.md not found in {module_path}")
        
        with open(prompt_path) as f:
            prompt = f.read()
        
        # Load schema.json
        schema_path = module_path / "schema.json"
        if not schema_path.exists():
            raise FileNotFoundError(f"schema.json not found in {module_path}")
        
        with open(schema_path) as f:
            schema = json.load(f)
        
        return Module(
            name=manifest.get("name", module_path.name),
            version=manifest.get("version", "0.0.0"),
            tier=manifest.get("tier", "decision"),
            prompt=prompt,
            input_schema=schema.get("input", {}),
            data_schema=schema.get("data", {}),
            meta_schema=schema.get("meta", {}),
            error_schema=schema.get("error", {}),
            config=manifest
        )


# =============================================================================
# Validators
# =============================================================================

class InputValidator:
    """Validates input against module schema."""
    
    def validate(self, input_data: dict, module: Module) -> Tuple[bool, Optional[str]]:
        """
        Validate input against the module's input schema.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            jsonschema.validate(input_data, module.input_schema)
            return True, None
        except jsonschema.ValidationError as e:
            return False, str(e.message)


class EnvelopeValidator:
    """Validates response envelopes."""
    
    def __init__(self, schema_path: Optional[Path] = None):
        if schema_path and schema_path.exists():
            with open(schema_path) as f:
                self.envelope_schema = json.load(f)
        else:
            # Minimal inline schema for basic validation
            self.envelope_schema = self._minimal_schema()
    
    def _minimal_schema(self) -> dict:
        """Minimal envelope schema for basic validation."""
        return {
            "type": "object",
            "required": ["ok", "meta"],
            "properties": {
                "ok": {"type": "boolean"},
                "meta": {
                    "type": "object",
                    "required": ["confidence", "risk", "explain"],
                    "properties": {
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "risk": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                        "explain": {"type": "string", "maxLength": 280}
                    }
                }
            }
        }
    
    def validate(self, envelope: dict) -> Tuple[bool, Optional[str]]:
        """
        Validate an envelope against the schema.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            jsonschema.validate(envelope, self.envelope_schema)
            return True, None
        except jsonschema.ValidationError as e:
            return False, str(e.message)


# =============================================================================
# Prompt Builder
# =============================================================================

class PromptBuilder:
    """Builds prompts from module templates."""
    
    def build(self, module: Module, input_data: dict, args: Optional[str] = None) -> str:
        """
        Build the final prompt to send to the LLM.
        
        Args:
            module: The loaded module
            input_data: Input data for the module
            args: Optional string arguments
            
        Returns:
            Complete prompt string
        """
        prompt = module.prompt
        
        # Substitute $ARGUMENTS
        if args:
            prompt = prompt.replace("$ARGUMENTS", args)
            parts = args.split()
            for i, part in enumerate(parts):
                prompt = prompt.replace(f"$ARGUMENTS[{i}]", part)
        
        # Inject input as JSON
        prompt = prompt.replace("$INPUT", json.dumps(input_data, indent=2))
        
        # Append envelope format instruction
        prompt += self._envelope_instruction()
        
        return prompt
    
    def _envelope_instruction(self) -> str:
        """Returns the envelope format instruction to append to prompts."""
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

If you cannot complete the task, respond with ok: false and include an error object.
"""


# =============================================================================
# Response Parser
# =============================================================================

class ResponseParser:
    """Parses LLM responses into structured envelopes."""
    
    def parse(self, raw_response: str) -> Tuple[Optional[dict], Optional[str]]:
        """
        Parse an LLM response into a dictionary.
        
        Returns:
            Tuple of (parsed_dict, error_message)
        """
        # Try direct JSON parse
        try:
            return json.loads(raw_response), None
        except json.JSONDecodeError:
            pass
        
        # Try extracting from markdown code block
        match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw_response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1)), None
            except json.JSONDecodeError:
                pass
        
        return None, "Could not extract valid JSON from response"


# =============================================================================
# Repair Pass
# =============================================================================

class RepairPass:
    """Attempts to repair minor schema violations."""
    
    def repair(self, envelope: dict) -> dict:
        """
        Attempt to repair minor issues in the envelope.
        
        Note: This MUST NOT change business semantics.
        """
        import copy
        repaired = copy.deepcopy(envelope)
        
        # Ensure meta exists
        if "meta" not in repaired:
            repaired["meta"] = {}
        
        meta = repaired["meta"]
        
        # Fill missing confidence
        if "confidence" not in meta:
            meta["confidence"] = 0.5
        
        # Clamp confidence to valid range
        meta["confidence"] = max(0, min(1, meta["confidence"]))
        
        # Fill missing risk
        if "risk" not in meta:
            meta["risk"] = "medium"
        
        # Truncate over-length explain
        if "explain" in meta and len(meta["explain"]) > 280:
            meta["explain"] = meta["explain"][:277] + "..."
        
        # Fill missing explain
        if "explain" not in meta:
            data = repaired.get("data", {})
            rationale = data.get("rationale", "")
            meta["explain"] = rationale[:200] if rationale else "No explanation provided"
        
        return repaired


# =============================================================================
# LLM Provider (TODO: Implement)
# =============================================================================

class LLMProvider:
    """Base class for LLM providers."""
    
    def complete(self, prompt: str) -> str:
        """
        Send prompt to LLM and return raw response.
        
        TODO: Implement for your chosen provider.
        """
        raise NotImplementedError("Implement this method for your LLM provider")


class OpenAIProvider(LLMProvider):
    """OpenAI provider implementation."""
    
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model
    
    def complete(self, prompt: str) -> str:
        """Send prompt to OpenAI and return response."""
        # TODO: Implement OpenAI API call
        # from openai import OpenAI
        # client = OpenAI(api_key=self.api_key)
        # response = client.chat.completions.create(
        #     model=self.model,
        #     messages=[{"role": "user", "content": prompt}],
        #     response_format={"type": "json_object"}
        # )
        # return response.choices[0].message.content
        raise NotImplementedError("Implement OpenAI API call")


# =============================================================================
# Runtime
# =============================================================================

class CognitiveRuntime:
    """Main runtime for executing Cognitive Modules."""
    
    def __init__(self, llm_provider: LLMProvider, schema_dir: Optional[Path] = None):
        self.loader = ModuleLoader()
        self.input_validator = InputValidator()
        self.prompt_builder = PromptBuilder()
        self.response_parser = ResponseParser()
        self.repair_pass = RepairPass()
        self.llm = llm_provider
        
        # Load envelope schema if available
        envelope_schema_path = schema_dir / "response-envelope.schema.json" if schema_dir else None
        self.envelope_validator = EnvelopeValidator(envelope_schema_path)
    
    def run(self, module_path: Path, input_data: dict, args: Optional[str] = None) -> dict:
        """
        Execute a Cognitive Module.
        
        Args:
            module_path: Path to the module directory
            input_data: Input data for the module
            args: Optional string arguments
            
        Returns:
            Response envelope dictionary
        """
        # 1. Load module
        try:
            module = self.loader.load(module_path)
        except Exception as e:
            return self._error_envelope("E4006", f"Failed to load module: {e}")
        
        # 2. Validate input
        is_valid, error = self.input_validator.validate(input_data, module)
        if not is_valid:
            return self._error_envelope("E1001", f"Input validation failed: {error}")
        
        # 3. Build prompt
        prompt = self.prompt_builder.build(module, input_data, args)
        
        # 4. Execute LLM
        try:
            raw_response = self.llm.complete(prompt)
        except Exception as e:
            return self._error_envelope("E4001", f"LLM execution failed: {e}")
        
        # 5. Parse response
        parsed, error = self.response_parser.parse(raw_response)
        if error:
            return self._error_envelope("E1000", error)
        
        # 6. Validate envelope
        is_valid, error = self.envelope_validator.validate(parsed)
        if not is_valid:
            # 7. Try repair pass
            repaired = self.repair_pass.repair(parsed)
            is_valid, error = self.envelope_validator.validate(repaired)
            if not is_valid:
                return self._error_envelope("E3001", f"Schema validation failed: {error}",
                                           partial_data=parsed)
            return repaired
        
        return parsed
    
    def _error_envelope(self, code: str, message: str, 
                       partial_data: Optional[dict] = None) -> dict:
        """Build an error envelope."""
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
        if partial_data:
            envelope["partial_data"] = partial_data
        return envelope


# =============================================================================
# CLI (for testing)
# =============================================================================

if __name__ == "__main__":
    import sys
    
    print("Cognitive Modules Runtime Starter")
    print("=" * 40)
    print()
    print("This is a template implementation.")
    print("To use it:")
    print("  1. Implement the LLMProvider class")
    print("  2. Run: python validate.py")
    print()
    print("See README.md for full instructions.")
