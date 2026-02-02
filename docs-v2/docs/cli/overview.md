---
sidebar_position: 1
---

# CLI Overview

Cognitive Modules provides two command-line tools:

| Platform | Package | Command |
|----------|---------|---------|
| pip | `cognitive-modules` | `cogn` |
| npm | `cognitive-modules-cli` | `cog` |

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Installation

<Tabs>
<TabItem value="pip" label="Python (pip)">

```bash
pip install cognitive-modules
```

</TabItem>
<TabItem value="npm" label="Node.js (npm)">

```bash
npm install -g cognitive-modules-cli
```

</TabItem>
<TabItem value="npx" label="npx (zero-install)">

```bash
npx cognitive-modules-cli <command>
```

</TabItem>
</Tabs>

## Command List

| Command | Description |
|---------|-------------|
| `list` | List installed modules |
| `info <module>` | View module details |
| `run <module>` | Run a module |
| `validate <module>` | Validate a module |
| `init <name>` | Create a new module |
| `add <url>` | Install module from GitHub (recommended) |
| `update <module>` | Update module to latest version |
| `versions <url>` | View available versions |
| `remove <module>` | Remove a module |
| `install <source>` | Install module (compatible method) |
| `uninstall <module>` | Uninstall a module |
| `search <query>` | Search registry |
| `registry` | View registry |
| `doctor` | Environment check |

## Global Options

```bash
cogn --version  # Show version (pip)
cog --version   # Show version (npm)
cogn --help     # Show help
```

## Common Workflows

:::note Command Names
The examples below use `cogn` (pip version). If using the npm version, replace `cogn` with `cog`.
:::

### 1. Use Built-in Modules

```bash
# View available modules
cogn list

# View module details
cogn info code-reviewer

# Run a module
cogn run code-reviewer --args "your code" --pretty
```

### 2. Create Custom Modules

```bash
# Create skeleton
cogn init my-module -d "Module description"

# Edit MODULE.md and schema.json
# ...

# Validate
cogn validate my-module

# Install globally
cogn install ./cognitive/modules/my-module
```

### 3. Install Community Modules

```bash
# Install from GitHub (recommended)
cogn add ziel-io/cognitive-modules -m code-simplifier

# Install specific version
cogn add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# View available versions
cogn versions ziel-io/cognitive-modules

# Search registry
cogn search "code review"

# Install from registry
cogn install registry:code-reviewer
```

### 4. Version Management

```bash
# Update module to latest version
cogn update code-simplifier

# Update to specific version
cogn update code-simplifier --tag v2.0.0

# View module installation info
cogn info code-simplifier

# Remove module
cogn remove code-simplifier
```

### 5. npx Zero-Install Usage

```bash
# No installation needed, use directly
npx cognitive-modules-cli add ziel-io/cognitive-modules -m code-simplifier
npx cognitive-modules-cli run code-simplifier --args "code"
```
