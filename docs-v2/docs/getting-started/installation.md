---
sidebar_position: 1
---

# Installation (Node.js)

Cognitive Modules 2.2 is distributed via npm.

This page uses the unambiguous entrypoint `npx cogn@2.2.12 ...` to avoid any PATH/binary conflicts on your machine.

## 5-Minute Quick Start

If you just want to try Cognitive, you do not need to think about registry, conformance, or certification.

```bash
# Zero-install (recommended)
npx cogn@2.2.12 --help

# Install a module from this repo
npx cogn@2.2.12 add Cognary/cognitive -m code-reviewer

# Run it (returns a v2.2 envelope)
npx cogn@2.2.12 run code-reviewer --args "def login(u,p): pass" --pretty
```

### One-File Module (Ad-hoc)

You can also run a module defined in a single Markdown file (optional YAML frontmatter + prompt body).

If you have `core` available, the most minimal path is:

```bash
cat <<'EOF' | npx cogn@2.2.12 core run --stdin --args "hello" --pretty
Return a valid v2.2 envelope with meta and data. Put your answer in data.result.
EOF
```

Or create a file template:

```bash
npx cogn@2.2.12 core new demo.md
npx cogn@2.2.12 core run demo.md --args "hello" --pretty
```

Then promote it into a portable v2 module directory:

```bash
npx cogn@2.2.12 core promote demo.md
```

If you do not have `core` yet, the file-based method below works everywhere:

```bash
cat > demo-single-file.md <<'EOF'
---
name: demo-single-file
version: 0.1.0
responsibility: Demo single-file module
tier: decision
---

Return a valid v2.2 envelope JSON with meta and data.
EOF

npx cogn@2.2.12 run ./demo-single-file.md --args "hello" --pretty
```

## Install

```bash
# Zero-install quick start
npx cogn@2.2.12 --help

# Global installation
npm install -g cogn@2.2.12
# or: npm install -g cognitive-modules-cli@2.2.12
```

## Verify Installation

```bash
npx cogn@2.2.12 --version
# Output: Cognitive Runtime v2.2.12

npx cogn@2.2.12 doctor
```

`npx cogn@2.2.12 doctor` shows provider configuration status.

## Installing Modules

```bash
# Install module from GitHub (recommended)
npx cogn@2.2.12 add Cognary/cognitive -m code-simplifier

# Install specific version
npx cogn@2.2.12 add Cognary/cognitive -m code-reviewer --tag v1.0.0

# List installed modules
npx cogn@2.2.12 list
```

## Progressive Complexity (Optional)

Only enable the pieces you need. Cognitive 2.2 is designed for a "5-minute happy path" and a "protocol-grade path"
without forcing everyone to adopt the full stack on day one.

Read next: [Progressive Complexity](./progressive-complexity)

## Version Management

```bash
# Update module to latest version
npx cogn@2.2.12 update code-simplifier

# Update to specific version
npx cogn@2.2.12 update code-simplifier --tag v2.0.0

# List available versions
npx cogn@2.2.12 versions Cognary/cognitive

# Remove module
npx cogn@2.2.12 remove code-simplifier
```

## Module Locations

Modules are loaded from these locations in priority order:

1. `./cognitive/modules/` (project local)
2. `~/.cognitive/modules/` (user global, installed by `npx cogn@2.2.12 add`)
