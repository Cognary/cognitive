---
sidebar_position: 1
---

# Release Notes

This section tracks runtime and package changes for Cognitive 2.2.x.

## Latest

- [v2.2.7](./v2.2.7)

## Notes

For strict cross-interface output consistency, default outputs follow envelope format.
`compose --trace` is a debug wrapper output and is not a pure envelope output mode.

## Versioning Across Registries

Version numbers are kept identical across npm, PyPI, and registry tarballs for this release line.

- npm (primary runtime): `cognitive-modules-cli@2.2.7` and `cogn@2.2.7`
- PyPI: `cognitive-modules@2.2.7`

Rationale: consistent versioning keeps docs, tooling, and distribution assets easy to reason about.
