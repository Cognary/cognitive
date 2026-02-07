---
sidebar_position: 1
---

# Installation (Node.js)

Cognitive Modules 2.2 is distributed via npm. The CLI command is `cog`.

## 5-Minute Quick Start

If you just want to try Cognitive, you do not need to think about registry, conformance, or certification.

```bash
# Zero-install (recommended)
npx cogn@2.2.7 --help

# Install a module from this repo
npx cogn@2.2.7 add Cognary/cognitive -m code-reviewer

# Run it (returns a v2.2 envelope)
npx cogn@2.2.7 run code-reviewer --args "def login(u,p): pass" --pretty
```

## Install

```bash
# Zero-install quick start
npx cogn@2.2.7 --help

# Global installation
npm install -g cogn@2.2.7
# or: npm install -g cognitive-modules-cli@2.2.7
```

## Verify Installation

```bash
cog --version
# Output: Cognitive Runtime v2.2.7

cog doctor
```

`cog doctor` shows provider configuration status.

## Installing Modules

```bash
# Install module from GitHub (recommended)
cog add Cognary/cognitive -m code-simplifier

# Install specific version
cog add Cognary/cognitive -m code-reviewer --tag v1.0.0

# List installed modules
cog list
```

## Progressive Complexity (Optional)

Only enable the pieces you need:

- Need **verifiable outputs**: write or tighten `schema.json` and run `cog validate --all`.
- Need **auditability**: require `meta.explain` and `data.rationale`, and store envelope results/events.
- Need **distribution**: publish registry indexes and GitHub Release tarballs, then install via `cog add <url>`.
- Need **ecosystem trust**: add conformance tests and certification signals.

## Version Management

```bash
# Update module to latest version
cog update code-simplifier

# Update to specific version
cog update code-simplifier --tag v2.0.0

# List available versions
cog versions Cognary/cognitive

# Remove module
cog remove code-simplifier
```

## Module Locations

Modules are loaded from these locations in priority order:

1. `./cognitive/modules/` (project local)
2. `~/.cognitive/modules/` (user global, installed by `cog add`)
