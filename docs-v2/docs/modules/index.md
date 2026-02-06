---
sidebar_position: 1
sidebar_label: Overview
---

# Module Library

This repository includes several example modules. You can install them via GitHub and run with `cog`.

## Modules in This Repo

- code-reviewer
- code-simplifier
- task-prioritizer
- api-designer
- ui-spec-generator
- ui-component-generator
- product-analyzer

## Install From GitHub

```bash
cog add ziel-io/cognitive-modules -m code-reviewer
cog add ziel-io/cognitive-modules -m code-simplifier
```

## Quick Usage

```bash
cog run code-reviewer --args "your code" --pretty
cog run task-prioritizer --args "fix bug, write docs" --pretty
```
