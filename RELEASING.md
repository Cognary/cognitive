# Releasing Cognitive Modules (npm + Registry Assets)

This repo publishes:

- Node runtime (npm): `cognitive-modules-cli` and `cogn`
- Registry distribution (GitHub Release assets): module tarballs referenced by `cognitive-registry.v2.json`

## Versioning

- npm: `2.2.7`
- registry module versions: aligned to the repo release tag (recommended)

## Registry v2 (tarballs + checksums)

The Node CLI installs registry modules via:

- `cognitive-registry.v2.json` (v2 index)
- `distribution.tarball` (GitHub Release asset)
- `distribution.checksum` (sha256)

Tarball layout is strict:

- Exactly one root directory: `<module-name>/...`
- No symlinks/hardlinks

## Release Checklist (GitHub Release Assets)

1. Bump versions
- npm package versions already live in:
  - `packages/cli-node/package.json`
  - `packages/cogn/package.json`
- module versions live in:
  - `cognitive/modules/*/module.yaml`

2. Regenerate registry v2 + tarballs locally

```bash
cog registry build \
  --tag v2.2.7 \
  --timestamp 2026-02-06T00:00:00Z \
  --tarball-base-url https://github.com/Cognary/cognitive/releases/download/v2.2.7 \
  --out-dir dist/registry-assets \
  --registry-out cognitive-registry.v2.json
```

Outputs:

- `cognitive-registry.v2.json`
- `dist/registry-assets/*.tar.gz` (ignored by git)

3. Validate conformance vectors (local)

```bash
npm install ajv ajv-formats tsx
npx tsx scripts/validate-test-vectors.ts --level 3 --verbose
```

In CI, the TypeScript validators also run:

- `scripts/validate-test-vectors.ts`
- `scripts/validate-stream-vectors.ts`
- `scripts/validate-registry-vectors.ts`

4. Commit and tag

- Commit the updated `cognitive-registry.v2.json` and any module/version changes.
- Create a tag like `v2.2.7` and publish a GitHub Release.

5. Upload registry tarballs to the GitHub Release

Upload the files from `dist/registry-assets/` as release assets:

- `<module>-<version>.tar.gz`

The registry tarball URLs follow:

```
https://github.com/Cognary/cognitive/releases/download/v2.2.7/<module>-<version>.tar.gz
```
