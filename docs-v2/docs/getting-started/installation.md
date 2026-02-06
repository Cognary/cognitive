---
sidebar_position: 1
---

# Installation (Node.js)

Cognitive Modules 2.2 is distributed via npm. The CLI command is `cog`.

## Install

```bash
# Zero-install quick start
npx cogn@2.2.5 --help

# Global installation
npm install -g cogn@2.2.5
# or: npm install -g cognitive-modules-cli@2.2.5
```

## Verify Installation

```bash
cog --version
# Output: Cognitive Runtime v2.2.5

cog doctor
```

`cog doctor` shows provider configuration status.

## Installing Modules

```bash
# Install module from GitHub (recommended)
cog add ziel-io/cognitive-modules -m code-simplifier

# Install specific version
cog add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# List installed modules
cog list
```

## Version Management

```bash
# Update module to latest version
cog update code-simplifier

# Update to specific version
cog update code-simplifier --tag v2.0.0

# List available versions
cog versions ziel-io/cognitive-modules

# Remove module
cog remove code-simplifier
```

## Module Locations

Modules are loaded from these locations in priority order:

1. `./cognitive/modules/` (project local)
2. `~/.cognitive/modules/` (user global, installed by `cog add`)
