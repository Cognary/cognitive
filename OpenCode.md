# OpenCode

This file contains useful information about the codebase, including build/test/lint commands and code style guidelines.

## Commands

```bash
# Node runtime (authoritative)
cd packages/cli-node
npm ci
npm test
npm run build
npm run pack:check

# Release guards (versions / assets)
cd ../..
node scripts/release/check-release.js --tag vX.Y.Z
```

## Code Style Guidelines

- TypeScript: keep public types stable; prefer explicit, narrow types at boundaries.
- Keep CLI behavior backwards compatible unless the release notes call it out.
- Use descriptive variable names
- Handle errors with actionable messages (what failed + how to fix).

## Legacy Python

The legacy Python runtime has been moved under `experimental/python/` and is not part of the supported surface area.
