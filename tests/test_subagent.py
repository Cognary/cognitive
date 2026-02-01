"""Tests for subagent orchestration."""

import pytest

from cognitive.subagent import (
    parse_calls,
    substitute_call_results,
    SubagentContext,
)


class TestParseCalls:
    """Test @call directive parsing."""

    def test_parse_simple_call(self):
        text = "Use @call:my-module to process"
        calls = parse_calls(text)
        
        assert len(calls) == 1
        assert calls[0]["module"] == "my-module"
        assert calls[0]["args"] == ""

    def test_parse_call_with_args(self):
        text = "@call:analyzer(hello world)"
        calls = parse_calls(text)
        
        assert len(calls) == 1
        assert calls[0]["module"] == "analyzer"
        assert calls[0]["args"] == "hello world"

    def test_parse_multiple_calls(self):
        text = """
First: @call:module-a
Second: @call:module-b(with args)
"""
        calls = parse_calls(text)
        
        assert len(calls) == 2
        assert calls[0]["module"] == "module-a"
        assert calls[1]["module"] == "module-b"
        assert calls[1]["args"] == "with args"

    def test_parse_no_calls(self):
        text = "No calls here"
        calls = parse_calls(text)
        assert len(calls) == 0

    def test_parse_hyphenated_module_name(self):
        text = "@call:ui-spec-generator"
        calls = parse_calls(text)
        
        assert calls[0]["module"] == "ui-spec-generator"


class TestSubstituteCallResults:
    """Test result substitution."""

    def test_substitute_dict_result(self):
        text = "Result: @call:test"
        results = {"@call:test": {"value": 42}}
        
        output = substitute_call_results(text, results)
        
        # The original @call:test is replaced with "[Result from @call:test]:"
        assert "42" in output
        assert "Result from" in output

    def test_substitute_multiple_results(self):
        text = "A: @call:a, B: @call:b"
        results = {
            "@call:a": {"a": 1},
            "@call:b": {"b": 2}
        }
        
        output = substitute_call_results(text, results)
        
        # Results are injected with labels
        assert "1" in output
        assert "2" in output


class TestSubagentContext:
    """Test execution context."""

    def test_initial_context(self):
        ctx = SubagentContext()
        
        assert ctx.depth == 0
        assert ctx.parent_id is None
        assert ctx.isolated is False

    def test_fork_creates_isolated_context(self):
        parent = SubagentContext()
        parent.results["parent-module"] = {"data": "value"}
        
        child = parent.fork("parent-module")
        
        assert child.depth == 1
        assert child.parent_id == "parent-module"
        assert child.isolated is True
        assert child.results == {}  # Isolated, no inherited results

    def test_extend_shares_results(self):
        parent = SubagentContext()
        parent.results["parent-module"] = {"data": "value"}
        
        child = parent.extend("parent-module")
        
        assert child.depth == 1
        assert child.isolated is False
        assert "parent-module" in child.results

    def test_max_depth_check(self):
        ctx = SubagentContext(depth=5, max_depth=5)
        
        # Should be at max depth
        assert ctx.depth >= ctx.max_depth
