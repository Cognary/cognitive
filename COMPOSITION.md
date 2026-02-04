# Cognitive Modules Composition Specification

> **Version**: 2.2  
> **Status**: Draft  
> **CMEP**: 0002  
> **Last Updated**: 2026-02

This document defines the module composition specification for Cognitive Modules, enabling complex workflows through inter-module orchestration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Composition Patterns](#2-composition-patterns)
3. [Dependency Declaration](#3-dependency-declaration)
4. [Data Flow Specification](#4-data-flow-specification)
5. [Call Directive Syntax](#5-call-directive-syntax)
6. [Execution Semantics](#6-execution-semantics)
7. [Error Handling](#7-error-handling)
8. [Examples](#8-examples)

---

## 1. Overview

### Purpose

Module composition enables:

1. **Reuse** — Build complex workflows from simple, tested modules
2. **Separation of Concerns** — Each module handles one responsibility
3. **Testability** — Test modules independently before composing
4. **Flexibility** — Swap implementations without changing callers

### Composition vs Orchestration

| Concept | Scope | Defined In |
|---------|-------|------------|
| **Composition** | Module-level dependencies and data flow | module.yaml |
| **Orchestration** | Runtime execution and routing | Runtime/Agent |

This specification covers composition. Orchestration is implementation-specific.

---

## 2. Composition Patterns

### 2.1 Sequential Composition

Modules execute one after another, with output flowing to the next input.

```
[Module A] → [Module B] → [Module C]
```

**Use case**: Pipeline processing (analyze → transform → validate)

### 2.2 Parallel Composition

Multiple modules execute simultaneously on the same or different inputs.

```
         ┌─→ [Module B] ─┐
[Input] ─┼─→ [Module C] ─┼─→ [Aggregator]
         └─→ [Module D] ─┘
```

**Use case**: Multi-perspective analysis (security + performance + style review)

### 2.3 Conditional Composition

Module selection based on runtime conditions.

```
[Module A] → (condition) → [Module B] OR [Module C]
```

**Use case**: Tier-based routing (high confidence → exec, low → exploration)

### 2.4 Iterative Composition

Repeated execution until a condition is met.

```
[Module A] → (check) → [Module A] → (check) → Done
```

**Use case**: Refinement loops (simplify until confidence > 0.9)

---

## 3. Dependency Declaration

### 3.1 module.yaml Configuration

```yaml
# module.yaml
composition:
  # Dependency declarations
  requires:
    - name: code-analyzer
      version: ">=1.0.0"
      optional: false
      
    - name: security-scanner
      version: ">=2.0.0"
      optional: true
      fallback: null  # Skip if unavailable
      
    - name: style-checker
      version: "^1.0.0"
      optional: true
      fallback: default-style  # Use alternative module
  
  # Composition pattern
  pattern: sequential  # sequential | parallel | conditional
  
  # Maximum composition depth
  max_depth: 5
  
  # Timeout for composed execution (ms)
  timeout_ms: 60000
```

### 3.2 Dependency Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | MUST | Module name |
| `version` | string | SHOULD | Semver range |
| `optional` | boolean | MAY | Default: false |
| `fallback` | string/null | MAY | Alternative if unavailable |

### 3.3 Version Matching

| Pattern | Meaning | Example |
|---------|---------|---------|
| `1.0.0` | Exact version | Only 1.0.0 |
| `>=1.0.0` | Minimum version | 1.0.0 or higher |
| `^1.0.0` | Compatible | 1.x.x (x >= 0) |
| `~1.0.0` | Patch only | 1.0.x |
| `*` | Any version | Latest available |

---

## 4. Data Flow Specification

### 4.1 Dataflow Configuration

```yaml
# module.yaml
composition:
  dataflow:
    # Input mapping
    - from: input
      to: code-analyzer
      mapping:
        code: "$.source_code"
        language: "$.language"
    
    # Output chaining
    - from: code-analyzer.output
      to: security-scanner
      mapping:
        ast: "$.data.parsed_ast"
        metadata: "$.meta"
      condition: "$.meta.risk != 'none'"
    
    # Aggregation
    - from: 
        - code-analyzer.output
        - security-scanner.output
      to: output
      aggregate: merge  # merge | array | custom
```

### 4.2 Mapping Expressions

Mappings use JSONPath-like expressions:

| Expression | Description | Example |
|------------|-------------|---------|
| `$.field` | Root field access | `$.code` |
| `$.nested.field` | Nested access | `$.data.result` |
| `$.array[0]` | Array index | `$.changes[0]` |
| `$.array[*].field` | Array map | `$.changes[*].risk` |
| `$` | Entire object | `$` (pass through) |

### 4.3 Conditions

Conditions determine whether a dataflow step executes:

```yaml
condition: "$.meta.confidence > 0.7"
condition: "$.meta.risk != 'high'"
condition: "$.data.changes.length > 0"
```

Supported operators:
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Existence: `exists($.field)`

### 4.4 Aggregation Strategies

| Strategy | Behavior |
|----------|----------|
| `merge` | Deep merge objects (later wins on conflict) |
| `array` | Collect outputs into array |
| `first` | Use first non-null result |
| `custom` | Custom aggregation function |

---

## 5. Call Directive Syntax

### 5.1 Basic Syntax

In `prompt.md`, use `@call` to invoke other modules:

```markdown
## Processing Steps

1. First, analyze the code structure:
   @call:code-analyzer($INPUT)

2. Then check for security issues:
   @call:security-scanner($.data.parsed_ast)
```

### 5.2 Full Syntax

```
@call:module-name(arguments)[options]
```

| Component | Description | Example |
|-----------|-------------|---------|
| `module-name` | Target module | `code-analyzer` |
| `arguments` | Input expression | `$INPUT`, `$.data.code` |
| `options` | Execution options | `[async, timeout=30s]` |

### 5.3 Options

| Option | Description | Default |
|--------|-------------|---------|
| `async` | Don't wait for result | false |
| `timeout=Ns` | Timeout in seconds | 30s |
| `optional` | Continue if fails | false |
| `tier=X` | Override tier | module default |

### 5.4 Result Injection

Call results are injected into the prompt context:

```markdown
@call:code-analyzer($INPUT)

Based on the analysis above, the following issues were found:
- Risk level: {{code-analyzer.meta.risk}}
- Confidence: {{code-analyzer.meta.confidence}}

The parsed structure shows:
{{code-analyzer.data.summary}}
```

---

## 6. Execution Semantics

### 6.1 Execution Order

1. **Parse** — Extract all `@call` directives from prompt
2. **Resolve** — Load required modules, verify availability
3. **Validate** — Check for circular dependencies
4. **Execute** — Run modules according to pattern
5. **Inject** — Insert results into prompt context
6. **Complete** — Execute main module with enriched context

### 6.2 Dependency Resolution

```
┌─────────────────────────────────────────┐
│             Resolution Order             │
├─────────────────────────────────────────┤
│ 1. Check local: .cognitive/modules/     │
│ 2. Check user: ~/.cognitive/modules/    │
│ 3. Check registry: cognitive-registry   │
│ 4. Check fallback: composition.fallback │
│ 5. Fail if required and not found       │
└─────────────────────────────────────────┘
```

### 6.3 Circular Dependency Detection

Runtimes MUST detect and reject circular dependencies:

```
A → B → C → A  ❌ Circular dependency detected
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "E4004",
    "message": "Circular dependency detected: A → B → C → A"
  }
}
```

### 6.4 Depth Limiting

Runtimes MUST enforce maximum composition depth:

```yaml
composition:
  max_depth: 5  # Default
```

Error when exceeded:

```json
{
  "ok": false,
  "error": {
    "code": "E4005",
    "message": "Maximum composition depth (5) exceeded"
  }
}
```

---

## 7. Error Handling

### 7.1 Failure Propagation

| Scenario | Behavior |
|----------|----------|
| Required module fails | Propagate error, abort composition |
| Optional module fails | Log warning, continue with null |
| Fallback available | Try fallback module |
| All fallbacks fail | Use null or abort based on config |

### 7.2 Partial Results

When composition partially succeeds:

```json
{
  "ok": false,
  "meta": {
    "confidence": 0.5,
    "risk": "medium",
    "explain": "Security scan failed, code analysis completed"
  },
  "error": {
    "code": "E2002",
    "message": "Composition partially failed"
  },
  "partial_data": {
    "code_analysis": { "...": "..." },
    "security_scan": null
  }
}
```

### 7.3 Timeout Handling

```yaml
composition:
  timeout_ms: 60000  # Total composition timeout
  
  requires:
    - name: slow-analyzer
      timeout_ms: 30000  # Per-module timeout
```

---

## 8. Examples

### 8.1 Code Review Pipeline

```yaml
# code-review-pipeline/module.yaml
name: code-review-pipeline
version: 2.2.0
tier: decision

composition:
  pattern: sequential
  
  requires:
    - name: code-analyzer
      version: ">=2.0.0"
    - name: security-scanner
      version: ">=1.0.0"
    - name: style-checker
      version: ">=1.0.0"
      optional: true
  
  dataflow:
    - from: input
      to: code-analyzer
      mapping:
        code: "$.code"
        language: "$.language"
    
    - from: code-analyzer.output
      to: security-scanner
      mapping:
        parsed: "$.data.ast"
    
    - from: code-analyzer.output
      to: style-checker
      mapping:
        code: "$.code"
      condition: "$.meta.confidence > 0.5"
    
    - from:
        - code-analyzer.output
        - security-scanner.output
        - style-checker.output
      to: output
      aggregate: merge
```

### 8.2 Parallel Analysis

```yaml
# multi-reviewer/module.yaml
name: multi-reviewer
version: 1.0.0
tier: exploration

composition:
  pattern: parallel
  
  requires:
    - name: security-review
    - name: performance-review
    - name: maintainability-review
  
  dataflow:
    - from: input
      to:
        - security-review
        - performance-review
        - maintainability-review
      mapping:
        code: "$.code"
    
    - from:
        - security-review.output
        - performance-review.output
        - maintainability-review.output
      to: output
      aggregate: array
```

### 8.3 Conditional Routing

```yaml
# smart-processor/module.yaml
name: smart-processor
version: 1.0.0
tier: decision

composition:
  pattern: conditional
  
  requires:
    - name: quick-check
    - name: deep-analysis
    - name: exploration-mode
  
  routing:
    - condition: "$.quick-check.meta.confidence > 0.9"
      next: null  # Use quick-check result directly
      
    - condition: "$.quick-check.meta.confidence > 0.5"
      next: deep-analysis
      
    - condition: "$.quick-check.meta.confidence <= 0.5"
      next: exploration-mode
```

---

## Conformance Requirements

### Level 3 Required

To claim Level 3 conformance, implementations MUST:

1. Support `@call:module` syntax in prompts
2. Parse and validate `composition` configuration
3. Resolve dependencies according to the resolution order
4. Detect circular dependencies (E4004)
5. Enforce max_depth limit (E4005)
6. Support sequential composition pattern
7. Implement dataflow mapping expressions

### Level 3 Recommended

Implementations SHOULD:

1. Support parallel composition pattern
2. Support conditional composition pattern
3. Implement timeout handling
4. Support optional dependencies with fallbacks

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2-draft | 2026-02 | Initial composition specification |
