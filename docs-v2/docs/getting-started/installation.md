---
sidebar_position: 1
---

# Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Python (pip)

```bash
# Basic installation
pip install cognitive-modules

# With OpenAI support
pip install cognitive-modules[openai]

# With Anthropic support
pip install cognitive-modules[anthropic]

# All LLM support
pip install cognitive-modules[all]
```

## Node.js (npm)

```bash
# Global installation
npm install -g cogn

# Or use npx for zero-install (recommended)
npx cogn --help
```

## Command Reference

| Platform | Package | Command |
|----------|---------|---------|
| pip | `cognitive-modules` | `cogn` |
| npm | `cogn` | `cog` |

## Verify Installation

<Tabs>
<TabItem value="npm" label="Node.js (cog) - Recommended" default>

```bash
cog --version
# Output: Cognitive Runtime v1.3.0

cog doctor
```

</TabItem>
<TabItem value="pip" label="Python (cogn)">

```bash
cogn --version
# Output: cog version 0.5.1

cogn doctor
```

</TabItem>
</Tabs>

`cogn doctor` / `cog doctor` displays environment status:

```
Cognitive Modules - Environment Check

            LLM Providers             
┏━━━━━━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━┓
┃ Provider  ┃ Installed ┃ Configured ┃
┡━━━━━━━━━━━╇━━━━━━━━━━━╇━━━━━━━━━━━━┩
│ openai    │ ✓         │ ✓          │
│ anthropic │ ✗         │ –          │
│ minimax   │ ✓         │ –          │
│ ollama    │ ✗         │ –          │
└───────────┴───────────┴────────────┘

Installed Modules: 5
```

## Installing Modules

After installing the CLI, you can add modules from GitHub:

<Tabs>
<TabItem value="pip" label="Python (cogn)">

```bash
# Install module from GitHub (recommended)
cogn add ziel-io/cognitive-modules -m code-simplifier

# Install specific version
cogn add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# List installed modules
cogn list
```

</TabItem>
<TabItem value="npm" label="Node.js (cog)">

```bash
# Install module from GitHub (recommended)
cog add ziel-io/cognitive-modules -m code-simplifier

# Install specific version
cog add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# List installed modules
cog list
```

</TabItem>
<TabItem value="npx" label="npx (zero-install)">

```bash
# No installation needed, use directly
npx cogn add ziel-io/cognitive-modules -m code-simplifier
```

</TabItem>
</Tabs>

### Version Management

```bash
# Update module to latest version
cogn update code-simplifier  # or cog update

# Update to specific version
cogn update code-simplifier --tag v2.0.0

# List available versions
cogn versions ziel-io/cognitive-modules

# Remove module
cogn remove code-simplifier
```

### Module Locations

Modules are loaded from these locations in priority order:

1. `./cognitive/modules/` - Project local
2. `~/.cognitive/modules/` - User global (`cogn add` / `cog add` installation location)
3. Built-in package modules

### Other Installation Methods

```bash
# Git repository
cogn install github:user/repo/path/to/module

# Public registry
cogn install registry:module-name

# Local path
cogn install ./path/to/module
```

## Install from Source

```bash
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# Install dev dependencies
pip install ".[dev]"

# Run tests
pytest tests/ -v
```

## Next Steps

- [Configure LLM](./llm-config) - Configure AI backend
- [First Module](./first-module) - Create your first module
