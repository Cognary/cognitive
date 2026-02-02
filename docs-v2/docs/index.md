---
sidebar_position: 1
---

# Cognitive Modules

> **Verifiable Structured AI Task Specifications**

Cognitive Modules is an AI task definition specification designed for generation tasks that require **strong constraints, verifiability, and auditability**.

---

## ✨ v2.2 New Features

| Feature | Description |
|---------|-------------|
| **Control/Data Separation** | `meta` control plane + `data` data plane, middleware doesn't need to parse business logic |
| **Module Tiers** | `exec` / `decision` / `exploration` with different strictness levels |
| **Recoverable Overflow** | `extensions.insights` preserves LLM's additional insights |
| **Extensible Enums** | Allows custom types without sacrificing type safety |
| **Repair Pass** | Auto-fixes format issues, reduces validation failures |

---

## 🚀 Quick Start

### Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="npm" label="Node.js (npm) - Recommended" default>

```bash
# Zero-install quick start
npx cogn run code-reviewer --args "your code" --pretty

# Global installation
npm install -g cogn
```

</TabItem>
<TabItem value="pip" label="Python (pip)">

```bash
pip install cognitive-modules
```

</TabItem>
</Tabs>

### Run Your First Module

```bash
# Configure LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# Run code review (npm)
npx cogn run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# Or use globally installed cog command
cog run code-reviewer --args "..."

# Start HTTP server
cog serve --port 8000

# Start MCP server (Claude Code / Cursor integration)
cog mcp
```

---

## ✨ Core Features

- **Strong Type Contracts** - JSON Schema bidirectional validation for inputs and outputs
- **Explainable Output** - Mandatory `confidence` + `rationale` output
- **Control/Data Separation** - `meta.explain` for quick routing + `data.rationale` for detailed auditing
- **Module Tiers** - exec / decision / exploration with different constraint levels
- **Sub-agent Orchestration** - `@call:module` supports inter-module calls
- **Argument Passing** - `$ARGUMENTS` runtime replacement
- **Multi-LLM Support** - OpenAI / Anthropic / MiniMax / Ollama
- **Public Registry** - `cogn install registry:module-name`

---

## 🔄 v2.2 Response Format

All modules now return a unified v2.2 envelope format:

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

### Control vs Data Plane

| Layer | Field | Purpose |
|-------|-------|---------|
| **Control Plane** | `meta.confidence` | Routing/degradation decisions |
| **Control Plane** | `meta.risk` | Human review trigger |
| **Control Plane** | `meta.explain` | Logs/card UI |
| **Data Plane** | `data.rationale` | Detailed audit |
| **Data Plane** | `data.extensions` | Recoverable insights |

---

## 📦 Built-in Modules

| Module | Tier | Function | Example |
|--------|------|----------|---------|
| `code-reviewer` | decision | Code review | `cogn run code-reviewer --args "your code"` |
| `code-simplifier` | decision | Code simplification | `cogn run code-simplifier --args "complex code"` |
| `task-prioritizer` | decision | Task prioritization | `cogn run task-prioritizer --args "task1,task2"` |
| `api-designer` | decision | REST API design | `cogn run api-designer --args "order system"` |
| `ui-spec-generator` | exploration | UI spec generation | `cogn run ui-spec-generator --args "e-commerce homepage"` |

---

## 🔄 Comparison with Skills

| Feature | Cognitive Modules | Skills |
|---------|-------------------|--------|
| **Validation** | JSON Schema bidirectional validation | No mandatory validation |
| **Confidence** | Mandatory confidence output | Optional |
| **Audit** | rationale + explain separation | Single description |
| **Tiers** | Tier determines strictness | No tiers |
| **Overflow** | extensions.insights recoverable | No overflow mechanism |

---

## 📚 Next Steps

- 📖 [Installation Guide](./getting-started/installation) - Install and configure
- 🎯 [First Module](./getting-started/first-module) - Create your first module
- 📋 [Module Format](./guide/module-format) - Learn about v2.2 format
- 🔧 [CLI Reference](./cli/overview) - Command line tool usage
- 📐 [Specification](./spec) - Complete specification document
- 🔌 [Integration Guide](./integration/ai-tools) - Integrate with AI tools

---

## 💡 Why Choose Cognitive Modules?

### Benefits for Developers

- ✅ **Deterministic** - Know exactly what structure the AI will return
- ✅ **Reusable** - Modules can be shared, installed, and version-managed
- ✅ **Trustworthy** - Has confidence and risk indicators
- ✅ **Testable** - Modules have contracts, can write golden tests

### Benefits for AI IDEs

- ✅ **Structured Output** - User says "review with code-reviewer module", outputs directly to schema
- ✅ **Testable** - Modules have contracts, can write golden tests
- ✅ **Auditable** - Each output has confidence + rationale
- ✅ **Orchestratable** - Modules can be safely composed (sub-agents)
- ✅ **Zero Config** - Users only need a module directory, no extra API calls

---

## 📄 License

Cognitive Modules is released under the **MIT License**.

```text
MIT License

Copyright (c) 2024-present Ziel.io

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### What This Means

| Permission | Description |
|------------|-------------|
| ✅ Commercial Use | Use in commercial projects |
| ✅ Modification | Modify the source code |
| ✅ Distribution | Distribute copies |
| ✅ Private Use | Use privately |
| ✅ Sublicense | Grant sublicenses |

### Conditions

- Include the original license and copyright notice in any copy of the software

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

- 🐛 **Report Bugs** - Open an issue describing the problem
- 💡 **Suggest Features** - Share your ideas in discussions
- 📖 **Improve Docs** - Fix typos or clarify explanations
- 🔧 **Submit PRs** - Code contributions are always appreciated

See our [GitHub repository](https://github.com/ziel-io/cognitive-modules) to get started.

---

## 🙏 Acknowledgments

Special thanks to:

- The open-source community for inspiration and feedback
- All contributors who have helped improve this project
- Users who have reported issues and suggested features
