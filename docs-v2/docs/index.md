---
sidebar_position: 1
---

# Cognitive Modules

> **Verifiable Structured AI Task Specifications**

Cognitive Modules is a specification and runtime for **structured, verifiable AI tasks** with strong contracts and auditability.

---

## v2.2 Highlights

| Feature | Description |
|---------|-------------|
| **Control/Data Separation** | `meta` control plane + `data` plane for business payloads |
| **Module Tiers** | `exec` / `decision` / `exploration` with strictness levels |
| **Recoverable Overflow** | `extensions.insights` preserves extra LLM insights |
| **Extensible Enums** | Custom values without sacrificing type safety |
| **Repair Pass** | Auto-fixes common envelope issues |

---

## Quick Start

```bash
# Zero-install quick start
npx cogn@2.2.7 run code-reviewer --args "your code" --pretty

# Global installation
npm install -g cogn@2.2.7
```

Run your first module:

```bash
export OPENAI_API_KEY=sk-xxx

cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# Start HTTP server
cog serve --port 8000

# Start MCP server (Claude Code / Cursor)
cog mcp
```

---

## Core Features

- **Strong type contracts** - JSON Schema validation for inputs/outputs
- **Explainable output** - `meta.explain` + `data.rationale`
- **Module tiers** - `exec | decision | exploration`
- **Subagent orchestration** - `@call:module`
- **Composition** - sequential/parallel/conditional/iterative workflows
- **HTTP API & MCP** - first-class integrations

---

## v2.2 Response Format

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Brief summary for quick routing decisions (≤280 chars)"
  },
  "data": {
    "...business fields...",
    "rationale": "Detailed reasoning process for auditing and human review",
    "extensions": {
      "insights": [
        {
          "text": "Additional insight",
          "suggested_mapping": "Suggested field to add to schema"
        }
      ]
    }
  }
}
```

---

## Built-in Modules (Repository)

| Module | Tier | Function | Example |
|--------|------|----------|---------|
| `code-reviewer` | decision | Code review | `cog run code-reviewer --args "your code"` |
| `code-simplifier` | decision | Code simplification | `cog run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | Task prioritization | `cog run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API design | `cog run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI spec generation | `cog run ui-spec-generator --args "e-commerce homepage"` |
| `ui-component-generator` | exploration | UI component spec | `cog run ui-component-generator --args "button component"` |

---

## Next Steps

- [Installation](./getting-started/installation)
- [First Module](./getting-started/first-module)
- [Module Format](./guide/module-format)
- [CLI Reference](./cli/overview)
- [Conformance Center](./conformance)
- [Registry and Distribution](./registry)
- [Release Notes](./release-notes)
- [Community](./community/contributing)
- [Specification](./spec)
- [Integration](./integration/ai-tools)
