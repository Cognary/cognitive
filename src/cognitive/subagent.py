"""
Subagent - Orchestrate module calls with isolated execution contexts.

Supports:
- @call:module-name - Call another module
- @call:module-name(args) - Call with arguments
- context: fork - Isolated execution (no shared state)
- context: main - Shared execution (default)
"""

import re
import json
import copy
from pathlib import Path
from typing import Optional, Any
from dataclasses import dataclass, field


@dataclass
class SubagentContext:
    """Execution context for a module run."""
    parent_id: Optional[str] = None
    depth: int = 0
    max_depth: int = 5
    results: dict = field(default_factory=dict)
    isolated: bool = False
    
    def fork(self, module_name: str) -> "SubagentContext":
        """Create a child context (isolated)."""
        return SubagentContext(
            parent_id=module_name,
            depth=self.depth + 1,
            max_depth=self.max_depth,
            results={},  # Isolated - no inherited results
            isolated=True,
        )
    
    def extend(self, module_name: str) -> "SubagentContext":
        """Create a child context (shared)."""
        return SubagentContext(
            parent_id=module_name,
            depth=self.depth + 1,
            max_depth=self.max_depth,
            results=copy.copy(self.results),  # Shared results
            isolated=False,
        )


# Pattern to match @call:module-name or @call:module-name(args)
CALL_PATTERN = re.compile(r'@call:([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?')


def parse_calls(text: str) -> list[dict]:
    """
    Parse @call directives from text.
    
    Returns list of:
        {"module": "name", "args": "optional args", "match": "full match string"}
    """
    calls = []
    for match in CALL_PATTERN.finditer(text):
        calls.append({
            "module": match.group(1),
            "args": match.group(2) or "",
            "match": match.group(0),
        })
    return calls


def substitute_call_results(text: str, call_results: dict) -> str:
    """
    Replace @call directives with their results.
    
    call_results: {"@call:module-name": result_dict, ...}
    """
    for call_str, result in call_results.items():
        if isinstance(result, dict):
            # Inject as JSON
            result_str = json.dumps(result, indent=2, ensure_ascii=False)
        else:
            result_str = str(result)
        text = text.replace(call_str, f"[Result from {call_str}]:\n{result_str}")
    return text


class SubagentOrchestrator:
    """
    Orchestrates module execution with subagent support.
    
    Usage:
        orchestrator = SubagentOrchestrator()
        result = orchestrator.run("parent-module", input_data)
    """
    
    def __init__(self, model: Optional[str] = None):
        self.model = model
        self._running = set()  # Prevent circular calls
    
    def run(
        self,
        module_name: str,
        input_data: dict,
        context: Optional[SubagentContext] = None,
        validate_input: bool = True,
        validate_output: bool = True,
    ) -> dict:
        """
        Run a module with subagent support.
        
        Recursively resolves @call directives before final execution.
        """
        from .registry import find_module
        from .loader import load_module
        from .runner import (
            validate_data,
            substitute_arguments,
            build_prompt,
            parse_llm_response,
        )
        from .providers import call_llm
        
        # Initialize context
        if context is None:
            context = SubagentContext()
        
        # Check depth limit
        if context.depth > context.max_depth:
            raise RecursionError(
                f"Max subagent depth ({context.max_depth}) exceeded. "
                f"Check for circular calls."
            )
        
        # Prevent circular calls
        if module_name in self._running:
            raise RecursionError(f"Circular call detected: {module_name}")
        
        self._running.add(module_name)
        
        try:
            # Find and load module
            path = Path(module_name)
            if path.exists() and path.is_dir():
                module_path = path
            else:
                module_path = find_module(module_name)
                if not module_path:
                    raise FileNotFoundError(f"Module not found: {module_name}")
            
            module = load_module(module_path)
            
            # Check if this module wants isolated execution
            module_context_mode = module.get("metadata", {}).get("context", "main")
            
            # Validate input
            if validate_input and module["input_schema"]:
                errors = validate_data(input_data, module["input_schema"], "Input")
                if errors:
                    raise ValueError(f"Input validation failed: {errors}")
            
            # Get prompt and substitute arguments
            prompt = substitute_arguments(module["prompt"], input_data)
            
            # Parse and resolve @call directives
            calls = parse_calls(prompt)
            call_results = {}
            
            for call in calls:
                child_module = call["module"]
                child_args = call["args"]
                
                # Prepare child input
                if child_args:
                    child_input = {"$ARGUMENTS": child_args, "query": child_args}
                else:
                    # Pass through parent input
                    child_input = input_data
                
                # Determine child context based on module's context setting
                if module_context_mode == "fork":
                    child_context = context.fork(module_name)
                else:
                    child_context = context.extend(module_name)
                
                # Recursively run child module
                child_result = self.run(
                    child_module,
                    child_input,
                    context=child_context,
                    validate_input=False,  # Skip validation for @call args
                    validate_output=validate_output,
                )
                
                call_results[call["match"]] = child_result
            
            # Substitute call results into prompt
            if call_results:
                prompt = substitute_call_results(prompt, call_results)
                # Rebuild full prompt with substituted content
                module["prompt"] = prompt
            
            # Build final prompt and call LLM
            full_prompt = build_prompt(module, input_data)
            
            # Add context info if there are subagent results
            if call_results:
                full_prompt += "\n\n## Subagent Results Available\n"
                full_prompt += "The @call results have been injected above. Use them in your response.\n"
            
            response = call_llm(full_prompt, model=self.model)
            
            # Parse response
            output_data = parse_llm_response(response)
            
            # Validate output
            if validate_output and module["output_schema"]:
                errors = validate_data(output_data, module["output_schema"], "Output")
                if errors:
                    raise ValueError(f"Output validation failed: {errors}")
            
            # Store result in context
            context.results[module_name] = output_data
            
            return output_data
            
        finally:
            self._running.discard(module_name)


def run_with_subagents(
    module_name: str,
    input_data: dict,
    model: Optional[str] = None,
    validate_input: bool = True,
    validate_output: bool = True,
) -> dict:
    """
    Convenience function to run a module with subagent support.
    """
    orchestrator = SubagentOrchestrator(model=model)
    return orchestrator.run(
        module_name,
        input_data,
        validate_input=validate_input,
        validate_output=validate_output,
    )
