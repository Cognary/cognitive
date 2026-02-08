---
sidebar_position: 1
---

# Release Notes

This section tracks runtime and package changes for Cognitive 2.2.x.

## Latest

- [v2.2.12](./v2.2.12)

## Notes

For strict cross-interface output consistency, default outputs follow envelope format.
`compose --trace` is a debug wrapper output and is not a pure envelope output mode.

## Distribution

The public distribution channels for Cognitive 2.2.x are:

- npm (primary runtime): `cognitive-modules-cli` and `cogn`
- Registry tarballs (GitHub Release assets): `*.tar.gz` + `cognitive-registry.v2.json`

Versioning policy:

- npm versions and registry asset versions are kept **the same** (tag `vX.Y.Z` matches `packages/*/package.json` and the registry asset filenames).
