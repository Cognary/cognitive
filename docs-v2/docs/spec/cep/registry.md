---
title: cep.registry (Draft)
---

This document defines the draft for module discovery and distribution.

`cep.registry` is expected to remain `experimental` longer than the core execution specs because it requires a security and trust model.

## Schemas

- Registry index (v2): `spec/registry.schema.json`
- Registry entry: `spec/registry-entry.schema.json`

Note: the repo currently ships a v1 index file `cognitive-registry.json`. Migration details are tracked in `REGISTRY-PROTOCOL.md`.

## Conformance Vectors

- `spec/registry-vectors/` (validated by `scripts/validate-registry-vectors.ts`)

## Hosting (GitHub Releases)

This repo publishes module tarballs as GitHub Release assets. The default Node CLI registry points to:

- `cognitive-registry.v2.json` (in `main`)

Each entry uses:

- `distribution.tarball`: `https://github.com/<owner>/<repo>/releases/download/<tag>/<module>-<version>.tar.gz`
- `distribution.checksum`: `sha256:<64hex>`

## Non-Negotiables

- Safe-by-default installation (no path traversal, no unsafe archive extraction)
- Clear source attribution (where the module came from)
- Integrity verification (checksums at minimum; signatures recommended)

## Client Requirements (Baseline)

- Fetch timeout: clients SHOULD apply a timeout (Node CLI default: 10s).
- Payload size cap: clients MUST cap registry index size before parsing (Node CLI default: 1MB).
- Integrity: clients MUST verify `sha256:` checksums before install when using tarball distribution.
- Extraction: clients MUST reject symlinks/hardlinks and MUST prevent symlink-traversal writes during extraction (safe tar implementation, not `tar -x`).
- Decompression cap: clients MUST cap the decompressed TAR byte stream before parsing/extracting to mitigate gzip bombs (Node CLI default: 100MB).
- Extraction caps: clients SHOULD cap the number of entries, total extracted bytes, and per-file bytes (Node CLI defaults: 5000 entries, 50MB total, 20MB per file).
- Layout: tarballs MUST contain exactly one module root directory.

## Open Questions

- Whether to run a central registry service or support multiple registries
- Signing format and trust roots
- Compatibility with existing ecosystems (for example OCI artifacts)
