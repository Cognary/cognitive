# Releasing Cognitive Modules (npm + Registry Assets)

This repo publishes:

- Node runtime (npm): `cognitive-modules-cli` and `cogn`
- Registry distribution (GitHub Release assets): module tarballs referenced by `cognitive-registry.v2.json`

## Versioning

- **Single version per release**: use the same semver across:
  - npm packages (`packages/cli-node/package.json`, `packages/cogn/package.json`)
  - module versions (`cognitive/modules/*/module.yaml`)
  - GitHub Release tag (`vX.Y.Z`)

This avoids confusing mismatches like “Release v2.2.6 ships `*-2.2.5.tar.gz`”.

## Registry v2 (tarballs + checksums)

The Node CLI installs registry modules via:

- `cognitive-registry.v2.json` (v2 index)
- `distribution.tarball` (GitHub Release asset)
- `distribution.checksum` (sha256)

Tarball layout is strict:

- Exactly one root directory: `<module-name>/...`
- No symlinks/hardlinks

## Release Checklist (GitHub Release Assets)

1. Bump versions (npm + modules)

```bash
node scripts/release/set-version.js --version X.Y.Z
```

2. Regenerate the default registry index tracked in `main`

This repo keeps a “default” `cognitive-registry.v2.json` for development and test vectors.
It intentionally uses the **latest** download strategy:

- `https://github.com/Cognary/cognitive/releases/latest/download/<module>-<version>.tar.gz`

Regenerate it after version bumps:

```bash
node scripts/release/regen-registry.js
```

3. Run local release checks (npm)

```bash
cd packages/cli-node
npm ci
npm run release:check

cd ../cogn
npm run release:check
```

4. Commit and tag

```bash
git add -A
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

5. Create a GitHub Release

Publishing a GitHub Release triggers `.github/workflows/release-assets.yml` which will:

- rebuild the CLI
- build registry tarballs + a release-pinned `cognitive-registry.v2.json`
- upload tarballs + index as Release assets

Important: the workflow runs `node scripts/release/check-release.js --tag vX.Y.Z` and will fail fast if any versions drift.

6. Publish to npm

```bash
cd packages/cli-node
npm publish --access public

cd ../cogn
npm publish --access public
```
