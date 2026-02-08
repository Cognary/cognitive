---
sidebar_position: 7
---

# Publishable Artifacts (Portable + Releasable)

To make Cognitive "protocol-like" (OpenAPI / OpenTelemetry style), you need more than code.
You need **portable artifacts** that can be published, verified, mirrored, and consumed by tools.

This page defines the minimum artifact set for "migratable and releasable" CEP ecosystems.

## Artifact Types

### 1) Module Pack

A module in v2 format is a directory with:

- `module.yaml` (manifest)
- `prompt.md` (prompt body)
- `schema.json` (input/data/meta/error schemas)

Optional but recommended:

- `README.md`
- conformance examples / test vectors

### 2) Registry Index

A registry is not necessarily a server. The minimal approach is:

- A static JSON index (served from GitHub Pages, S3, etc.)
- Entries list module name, version, and download URL(s)
- Entries include integrity metadata: `sha256`, `size`, `created_at`

Minimum recommended fields per entry:

- `name` (string)
- `version` (string, semver)
- `format` (string, e.g. `v2`)
- `url` (string, tarball download URL)
- `sha256` (string)
- `size` (number, bytes)
- `created_at` (string, ISO-8601)

Example index:

```json
{
  "registry_version": "1",
  "generated_at": "2026-02-07T00:00:00Z",
  "entries": [
    {
      "name": "code-reviewer",
      "version": "2.2.7",
      "format": "v2",
      "url": "https://github.com/Cognary/cognitive/releases/download/v2.2.7/code-reviewer-2.2.7.tar.gz",
      "sha256": "…",
      "size": 12345,
      "created_at": "2026-02-07T00:00:00Z"
    }
  ]
}
```

### 3) Release Asset Tarballs (Carrier)

GitHub Release assets can carry immutable module tarballs.

Recommended naming:

- `<module-name>-<version>.tar.gz`

Recommended contents:

- `module.yaml`
- `prompt.md`
- `schema.json`
- `LICENSE` (if needed for redistribution)

Recommended metadata alongside the tarball:

- `sha256` checksum (in the registry index)
- optional signatures (cosign / minisign)

## Why Tarballs Should Be Versioned

If you publish a Release `v2.2.7` but upload tarballs named `*-2.2.5.tar.gz`,
users will assume the artifact is stale or mismatched.

Rule: **release tag, registry index version, and tarball filenames must agree** unless explicitly documented.

## Minimum "Protocol-Grade" Publish Checklist

- A stable CEP spec version (e.g. v2.2) referenced by the runtime and docs.
- A reproducible build process for registry tarballs.
- An index format with integrity fields.
- Conformance tests (`npx cogn@2.2.13 test`) that can be run by third parties.

Optional but strong upgrades:

- Signed registry assets (cosign/minisign) and signature verification in clients.
- A public conformance dashboard that links results to exact commits/tags.
