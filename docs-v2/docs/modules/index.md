---
sidebar_position: 1
sidebar_label: Overview
---

# Module Library

This repository includes several example modules. You can install them via GitHub and run them with `npx cogn@2.2.13 ...`.

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
npx cogn@2.2.13 add Cognary/cognitive -m code-reviewer
npx cogn@2.2.13 add Cognary/cognitive -m code-simplifier
```

## Quick Usage

```bash
npx cogn@2.2.13 run code-reviewer --args "your code" --pretty
npx cogn@2.2.13 run task-prioritizer --args "fix bug, write docs" --pretty
```
