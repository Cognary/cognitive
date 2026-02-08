---
sidebar_position: 4
---

# Publishable Artifacts (Registry Tarballs)

This page is the practical checklist for making Cognitive modules portable and publishable.
The goal is deterministic installs and verifiable provenance, not "best effort" Git pulls.

## Artifacts

A publishable registry consists of:

- Registry index: `cognitive-registry.v2.json`
- Release assets: one tarball per module, named `<module>-<version>.tar.gz`
- Integrity metadata per module:
  - `checksum` (recommended: `sha256:<hex>`)
  - `size_bytes`

The tarball is the distribution unit.
The index is the discovery unit.

## Build

Build tarballs and regenerate the v2 index:

```bash
npx cogn@2.2.12 registry build --tag vX.Y.Z
```

Typical output:

- `dist/registry-assets/`: tarballs and manifests
- `cognitive-registry.v2.json`: regenerated index with updated `distribution` fields

## Verify (Local)

Verify that local tarballs match the index:

```bash
npx cogn@2.2.12 registry verify --index cognitive-registry.v2.json --assets-dir dist/registry-assets
```

What is checked:

- sha256 checksum
- size limit and actual size
- safe extraction and file list expectations

## Verify (Remote)

Verify a remote registry index and all referenced tarballs:

```bash
npx cogn@2.2.12 registry verify --remote --index https://github.com/<org>/<repo>/releases/latest/download/cognitive-registry.v2.json
```

For reproducible verification, pin a tag:

```bash
npx cogn@2.2.12 registry verify --remote --index https://github.com/<org>/<repo>/releases/download/vX.Y.Z/cognitive-registry.v2.json
```

Remote verification is guarded by:

- fetch timeouts
- index payload max bytes
- tarball max bytes
- safe extraction rules

Tune limits:

```bash
npx cogn@2.2.12 registry verify --remote \
  --fetch-timeout-ms 20000 \
  --max-index-bytes 2097152 \
  --max-tarball-bytes 26214400 \
  --concurrency 2
```

## Failure Diagnostics

When verification fails, the command returns a JSON result with a `failures[]` array.

Notes:
- `failures[]` is intentionally extensible. Treat unknown keys as optional.
- For remote verification, you may see both `tarball_ref` (as written in the index) and `tarball_resolved` (the resolved absolute URL).
- `phase` helps pinpoint where verification failed (for example: `download`, `checksum`, `extract`).

## "Latest" Strategy

The default registry URL prefers GitHub Releases "latest" assets:

- Pros: index and tarballs are tied to a published release
- Cons: there can be a short window where `latest` exists but assets are still uploading

Cognitive hardens this by allowing a safe fallback to the repo-tracked index when `latest` is temporarily missing.
For strict reproducibility, pin a release tag in CI and production installs.
