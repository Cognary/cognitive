---
sidebar_position: 1
---

# Release Notes

This section tracks runtime and package changes for Cognitive 2.2.x.

## Latest

- [v2.2.5](./v2.2.5)

## Notes

For strict cross-interface output consistency, default outputs follow envelope format.
`compose --trace` is a debug wrapper output and is not a pure envelope output mode.

## Versioning Across Registries

Version numbers are intentionally not kept identical across all distribution channels.

- npm (primary runtime): `cognitive-modules-cli@2.2.5` and `cogn@2.2.5`
- PyPI (legacy Python package): `cognitive-modules@2.2.3`

Rationale: the Node.js runtime is the primary, actively maintained runtime for Cognitive 2.2.x.
The Python package is published separately and may lag or follow an independent patch cadence.
