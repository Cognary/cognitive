---
sidebar_position: 1
sidebar_label: Overview
---

# Module Library

Cognitive Modules provides multiple built-in modules, ready to use out of the box.

## Built-in Modules

| Module | Function | Format | Category |
|--------|----------|:------:|----------|
| [code-reviewer](./code-reviewer) | Code review | v1 | Code Quality |
| [code-simplifier](./code-simplifier) | Code simplification (behavior-preserving) | **v2** | Code Quality |
| [task-prioritizer](./task-prioritizer) | Task prioritization | v1 | Project Management |
| [api-designer](./api-designer) | REST API design | v1 | Design Specs |
| [ui-spec-generator](./ui-spec-generator) | UI specification generation | v1 | Design Specs |
| product-analyzer | Product analysis (sub-agent example) | v1 | Orchestration Example |

## Quick Usage

```bash
# Code review
cog run code-reviewer --args "your code" --pretty

# Task prioritization
cog run task-prioritizer --args "fix bug, write docs, optimize performance" --pretty

# API design
cog run api-designer --args "order system CRUD" --pretty

# UI specification
cog run ui-spec-generator --args "e-commerce homepage" --pretty
```

## Install More Modules

### From Registry

```bash
cog search "keyword"
cog install registry:module-name
```

### From GitHub

```bash
cog install github:user/repo/path/to/module
```

### From Local

```bash
cog install ./path/to/module
```

## View Module Details

```bash
cog info code-reviewer
```

Output:

```
code-reviewer v1.0.0
Format: new

Responsibility:
  Review code and provide structured improvement suggestions

Excludes:
  - Rewriting entire code
  - Executing code

Constraints:
  ✓ no_network
  ✓ no_side_effects
  ✓ no_inventing_data

Path: /path/to/cognitive/modules/code-reviewer
Prompt size: 1234 chars
```
