# Cognitive Modules Context Protocol

> **Version**: 2.2  
> **Status**: Draft  
> **CMEP**: 0003  
> **Last Updated**: 2026-02

This document defines the context protocol for Cognitive Modules, enabling stateful interactions while maintaining the principle of explicit, verifiable context.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Context Philosophy](#2-context-philosophy)
3. [Context Declaration](#3-context-declaration)
4. [Context Types](#4-context-types)
5. [Context Lifecycle](#5-context-lifecycle)
6. [Context Modes](#6-context-modes)
7. [Implementation Guidelines](#7-implementation-guidelines)
8. [Examples](#8-examples)

---

## 1. Overview

### Purpose

The Context Protocol enables:

1. **Stateful Workflows** — Multi-turn interactions with preserved state
2. **Context Sharing** — Pass information between module invocations
3. **Explicit Context** — All context is declared, typed, and verifiable
4. **Controlled Scope** — Context lifetime and visibility are explicit

### Core Principle

> **Cognitive trades conversational convenience for engineering certainty.**
> 
> All context MUST be explicit in the input schema. Implicit context (hidden state, conversation history, model memory) is NOT allowed.

---

## 2. Context Philosophy

### Explicit vs Implicit Context

| Type | Description | Cognitive Modules |
|------|-------------|-------------------|
| **Implicit** | Conversation history, agent scratchpad, model "memory" | ❌ Prohibited |
| **Explicit** | Structured state snapshots, typed handoffs, event windows | ✅ Allowed |

### Judgment Criterion

**Is the context declared in the input schema?**

- In schema → Verifiable → ✅ Allowed
- Not in schema → Uncontrollable → ❌ Prohibited

### Benefits of Explicit Context

1. **Reproducibility** — Same input + context = same behavior
2. **Testability** — Context is part of test fixtures
3. **Auditability** — Complete trace of what influenced output
4. **Composability** — Modules can be combined without hidden dependencies

---

## 3. Context Declaration

### 3.1 module.yaml Configuration

```yaml
# module.yaml
context:
  # Context this module accepts
  accepts:
    - type: conversation_history
      max_turns: 10
      required: false
      
    - type: user_profile
      fields: [expertise_level, preferences, locale]
      required: false
      
    - type: session_state
      schema: "./context-schemas/session.json"
      required: false
      ttl: 3600  # seconds
      
    - type: previous_result
      from_module: code-analyzer
      required: false
  
  # Context this module produces
  emits:
    - type: analysis_cache
      ttl: 86400
      key_pattern: "${module}:${input_hash}"
      
    - type: session_state
      schema: "./context-schemas/session-out.json"
  
  # Execution mode
  mode: main  # main | fork
```

### 3.2 Context Schema in schema.json

```json
{
  "input": {
    "type": "object",
    "properties": {
      "code": { "type": "string" },
      
      "_context": {
        "type": "object",
        "description": "Explicit context container",
        "properties": {
          "conversation_history": {
            "$ref": "#/$defs/conversation_history"
          },
          "user_profile": {
            "$ref": "#/$defs/user_profile"
          },
          "session_state": {
            "type": "object",
            "additionalProperties": true
          }
        }
      }
    }
  },
  
  "$defs": {
    "conversation_history": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["role", "content"],
        "properties": {
          "role": { "enum": ["user", "assistant", "system"] },
          "content": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    },
    
    "user_profile": {
      "type": "object",
      "properties": {
        "expertise_level": { "enum": ["beginner", "intermediate", "expert"] },
        "preferences": { "type": "object" },
        "locale": { "type": "string" }
      }
    }
  }
}
```

---

## 4. Context Types

### 4.1 Standard Context Types

| Type | Description | Typical TTL |
|------|-------------|-------------|
| `conversation_history` | Recent conversation turns | Session |
| `user_profile` | User preferences and traits | Persistent |
| `session_state` | Ephemeral session data | 1-24 hours |
| `previous_result` | Output from prior module | Request |
| `analysis_cache` | Cached analysis results | 1-7 days |
| `environment` | Runtime environment info | Request |

### 4.2 conversation_history

```json
{
  "_context": {
    "conversation_history": [
      {
        "role": "user",
        "content": "Review this login function",
        "timestamp": "2026-02-01T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "I found 2 security issues...",
        "timestamp": "2026-02-01T10:00:05Z"
      },
      {
        "role": "user",
        "content": "Fix the SQL injection",
        "timestamp": "2026-02-01T10:01:00Z"
      }
    ]
  }
}
```

**Constraints:**

- `max_turns` — Maximum number of turns to include
- Older turns are truncated (FIFO)
- Implementations SHOULD NOT pass raw conversation; use structured summaries when possible

### 4.3 user_profile

```json
{
  "_context": {
    "user_profile": {
      "expertise_level": "expert",
      "preferences": {
        "verbosity": "concise",
        "code_style": "functional",
        "language": "en"
      },
      "locale": "en-US"
    }
  }
}
```

**Use cases:**

- Adjust explanation depth based on expertise
- Respect code style preferences
- Localize output

### 4.4 session_state

```json
{
  "_context": {
    "session_state": {
      "files_analyzed": ["main.py", "utils.py"],
      "issues_found": 5,
      "last_action": "code_review",
      "accumulated_confidence": 0.85
    }
  }
}
```

**Characteristics:**

- Ephemeral, expires with session
- Module can read and emit updated state
- Useful for multi-step workflows

### 4.5 previous_result

```json
{
  "_context": {
    "previous_result": {
      "module": "code-analyzer",
      "meta": {
        "confidence": 0.92,
        "risk": "low"
      },
      "data": {
        "ast": { "...": "..." },
        "complexity": 15
      }
    }
  }
}
```

**Use cases:**

- Chain module outputs
- Avoid re-computation

---

## 5. Context Lifecycle

### 5.1 Lifecycle Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Lifecycle                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Create]      [Inject]      [Use]        [Emit]      [Store]   │
│     │             │            │             │            │      │
│     ▼             ▼            ▼             ▼            ▼      │
│  Context      Runtime      Module       Module       Runtime     │
│  Builder      injects      reads        produces     persists    │
│  prepares     into         context      new          or          │
│  context      input        from         context      discards    │
│               schema       _context                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 TTL (Time-To-Live)

```yaml
context:
  emits:
    - type: analysis_cache
      ttl: 86400  # 24 hours in seconds
```

| TTL Value | Meaning |
|-----------|---------|
| `0` | Request-scoped only |
| `3600` | 1 hour |
| `86400` | 24 hours |
| `-1` | Never expires (persistent) |

### 5.3 Cache Key Pattern

```yaml
context:
  emits:
    - type: analysis_cache
      key_pattern: "${module}:${input_hash}"
```

Variables:
- `${module}` — Module name
- `${input_hash}` — SHA256 of input (excluding context)
- `${user_id}` — Current user identifier
- `${session_id}` — Current session identifier

---

## 6. Context Modes

### 6.1 Main Mode (Default)

```yaml
context:
  mode: main
```

- Submodules share context with parent
- Context updates are visible to parent
- Use for tightly coupled workflows

```
┌────────────────────────────────────────┐
│              Parent Module              │
│  ┌──────────────────────────────────┐  │
│  │           Shared Context          │  │
│  │  ┌─────────┐    ┌─────────┐     │  │
│  │  │ Child A │    │ Child B │     │  │
│  │  └─────────┘    └─────────┘     │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 6.2 Fork Mode

```yaml
context:
  mode: fork
```

- Submodules get a copy of context
- Context updates are isolated
- Use for independent analysis

```
┌────────────────────────────────────────┐
│              Parent Module              │
│         ┌──────────────────┐           │
│         │  Parent Context   │           │
│         └────────┬─────────┘           │
│                  │                      │
│         ┌───────┴───────┐              │
│         ▼               ▼              │
│  ┌─────────────┐ ┌─────────────┐      │
│  │  Child A    │ │  Child B    │      │
│  │  (Copy)     │ │  (Copy)     │      │
│  └─────────────┘ └─────────────┘      │
└────────────────────────────────────────┘
```

---

## 7. Implementation Guidelines

### 7.1 Context Builder Pattern

Implementations SHOULD use a Context Builder to prepare context:

```python
class ContextBuilder:
    """
    Transforms raw data into structured context.
    This layer can be "dirty" - the module receives clean context.
    """
    
    def build(self, 
              raw_conversation: List[Message],
              user_data: UserData,
              session: Session) -> dict:
        return {
            "conversation_history": self._summarize_conversation(
                raw_conversation, max_turns=10
            ),
            "user_profile": {
                "expertise_level": user_data.expertise,
                "preferences": user_data.preferences
            },
            "session_state": session.get_state()
        }
    
    def _summarize_conversation(self, messages, max_turns):
        # Take last N turns
        recent = messages[-max_turns:]
        # Structure them
        return [
            {"role": m.role, "content": m.content, "timestamp": m.ts}
            for m in recent
        ]
```

### 7.2 Context Validation

Implementations MUST validate context against declared schemas:

```python
def validate_context(context: dict, module: Module) -> bool:
    for accepted in module.context.accepts:
        if accepted.required:
            if accepted.type not in context:
                raise ValidationError(f"Missing required context: {accepted.type}")
        
        if accepted.type in context:
            # Validate against schema
            jsonschema.validate(context[accepted.type], accepted.schema)
    
    return True
```

### 7.3 Context Sanitization

Before passing context to LLM:

1. Remove sensitive fields (tokens, passwords)
2. Truncate large values
3. Validate types match schema
4. Log context for audit

```python
def sanitize_context(context: dict) -> dict:
    sanitized = copy.deepcopy(context)
    
    # Remove sensitive patterns
    sensitive_patterns = ["password", "token", "secret", "key"]
    sanitized = redact_fields(sanitized, sensitive_patterns)
    
    # Truncate large strings
    sanitized = truncate_strings(sanitized, max_length=10000)
    
    return sanitized
```

---

## 8. Examples

### 8.1 Multi-Turn Code Review

```yaml
# module.yaml
name: interactive-reviewer
version: 1.0.0
tier: decision

context:
  accepts:
    - type: conversation_history
      max_turns: 5
      required: false
    - type: session_state
      required: false
  
  emits:
    - type: session_state
      ttl: 3600
```

**First request:**

```json
{
  "code": "def login(u, p): ...",
  "_context": {}
}
```

**Response:**

```json
{
  "ok": true,
  "meta": { "...": "..." },
  "data": {
    "issues": ["SQL injection", "No rate limiting"],
    "rationale": "..."
  },
  "_emitted_context": {
    "session_state": {
      "files_reviewed": ["login.py"],
      "issues_found": 2
    }
  }
}
```

**Follow-up request:**

```json
{
  "code": "# Fix the SQL injection",
  "_context": {
    "conversation_history": [
      { "role": "user", "content": "Review login function" },
      { "role": "assistant", "content": "Found SQL injection..." }
    ],
    "session_state": {
      "files_reviewed": ["login.py"],
      "issues_found": 2
    }
  }
}
```

### 8.2 User-Adaptive Explanation

```yaml
# module.yaml
name: adaptive-explainer
version: 1.0.0
tier: exploration

context:
  accepts:
    - type: user_profile
      fields: [expertise_level]
      required: true
```

**Beginner request:**

```json
{
  "code": "async function fetchData() { ... }",
  "_context": {
    "user_profile": {
      "expertise_level": "beginner"
    }
  }
}
```

**Expert request:**

```json
{
  "code": "async function fetchData() { ... }",
  "_context": {
    "user_profile": {
      "expertise_level": "expert"
    }
  }
}
```

The module adjusts explanation depth based on expertise level.

---

## Conformance Requirements

### Level 3 Required

To support context protocol, implementations MUST:

1. Parse `context` configuration in module.yaml
2. Validate `_context` input against declared schemas
3. Support `mode: main` and `mode: fork`
4. Propagate context to submodules appropriately
5. Emit context in `_emitted_context` response field

### Level 3 Recommended

Implementations SHOULD:

1. Implement TTL-based context expiration
2. Support context caching with key patterns
3. Provide Context Builder utilities
4. Log context access for audit

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2-draft | 2026-02 | Initial context protocol specification |
