---
sidebar_position: 1
---

# Release Notes

This section tracks runtime and package changes for Cognitive 2.2.x.

## Latest

- [v2.2.8](./v2.2.8)

## Notes

For strict cross-interface output consistency, default outputs follow envelope format.
`compose --trace` is a debug wrapper output and is not a pure envelope output mode.

## Versioning Across Registries

Version numbers are intentionally **not** identical across all registries for the 2.2.x line.

- npm (primary runtime): `cognitive-modules-cli@2.2.8` and `cogn@2.2.8`
- Registry tarballs (GitHub Release assets): `*-2.2.8.tar.gz`
- PyPI (legacy, frozen): `cognitive-modules@2.2.3`

Rationale: the Node.js runtime and registry assets are actively maintained; the Python package is legacy and not currently released in lockstep.
