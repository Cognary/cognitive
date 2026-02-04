# Cognitive Modules Registry Protocol

> **Version**: 1.0  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines the registry protocol for publishing, discovering, and installing Cognitive Modules.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Registry Entry Schema](#2-registry-entry-schema)
3. [Registry Index Schema](#3-registry-index-schema)
4. [Distribution Formats](#4-distribution-formats)
5. [Quality Signals](#5-quality-signals)
6. [Namespaces](#6-namespaces)
7. [Versioning](#7-versioning)
8. [API Endpoints](#8-api-endpoints)
9. [Security](#9-security)

---

## 1. Overview

### Purpose

The Cognitive Modules Registry provides:

1. **Discovery** — Find modules by name, tags, or functionality
2. **Distribution** — Download and install modules
3. **Quality Assurance** — Verify module conformance and trustworthiness
4. **Versioning** — Manage multiple versions of modules

### Registry Types

| Type | Description | Example |
|------|-------------|---------|
| **Official** | Maintained by Cognitive Modules project | `registry.cognitive-modules.dev` |
| **Community** | Community-maintained modules | GitHub repositories |
| **Private** | Organization-specific | Self-hosted registry |

---

## 2. Registry Entry Schema

Each module in the registry MUST have an entry conforming to this schema:

```json
{
  "$schema": "https://cognitive-modules.dev/schema/registry-entry-v1.json",
  
  "identity": {
    "name": "code-reviewer",
    "namespace": "official",
    "version": "2.2.0",
    "spec_version": "2.2"
  },
  
  "metadata": {
    "description": "Review code and provide structured improvement suggestions",
    "description_zh": "审查代码并提供结构化的改进建议",
    "author": "ziel-io",
    "license": "MIT",
    "repository": "https://github.com/ziel-io/cognitive-modules",
    "documentation": "https://cognitive-modules.dev/modules/code-reviewer",
    "homepage": "https://cognitive-modules.dev",
    "keywords": ["code", "review", "security", "quality"],
    "tier": "decision"
  },
  
  "quality": {
    "conformance_level": 2,
    "test_coverage": 0.85,
    "test_vector_pass": true,
    "verified": true,
    "verified_by": "cognitive-modules-foundation",
    "verified_at": "2026-01-15T00:00:00Z",
    "downloads_30d": 1250,
    "stars": 45
  },
  
  "dependencies": {
    "runtime_min": "0.5.0",
    "modules": []
  },
  
  "distribution": {
    "tarball": "https://registry.cognitive-modules.dev/packages/code-reviewer-2.2.0.tar.gz",
    "checksum": "sha256:a1b2c3d4e5f6...",
    "size_bytes": 15360,
    "files": [
      "module.yaml",
      "prompt.md", 
      "schema.json",
      "tests/"
    ]
  },
  
  "timestamps": {
    "created_at": "2024-06-01T00:00:00Z",
    "updated_at": "2026-02-01T00:00:00Z",
    "deprecated_at": null
  }
}
```

### Field Requirements

#### identity (REQUIRED)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | MUST | Module name, lowercase with hyphens |
| `namespace` | string | MUST | One of: `official`, `community`, `<org-name>` |
| `version` | string | MUST | Semantic version (e.g., "2.2.0") |
| `spec_version` | string | MUST | Cognitive Modules spec version (e.g., "2.2") |

#### metadata (REQUIRED)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | MUST | English description |
| `description_zh` | string | MAY | Chinese description |
| `author` | string | MUST | Author or organization |
| `license` | string | SHOULD | SPDX license identifier |
| `repository` | string | SHOULD | Source repository URL |
| `keywords` | array | SHOULD | Search keywords |
| `tier` | string | MUST | Module tier: exec/decision/exploration |

#### quality (RECOMMENDED)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conformance_level` | number | SHOULD | 1, 2, or 3 per CONFORMANCE.md |
| `test_coverage` | number | MAY | Test coverage ratio (0-1) |
| `test_vector_pass` | boolean | SHOULD | Passes official test vectors |
| `verified` | boolean | MAY | Verified by trusted party |
| `verified_by` | string | MAY | Verifying organization |

#### dependencies (REQUIRED)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runtime_min` | string | MUST | Minimum runtime version |
| `modules` | array | MUST | Required module dependencies |

#### distribution (REQUIRED)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tarball` | string | MUST | Download URL |
| `checksum` | string | MUST | SHA256 checksum with prefix |
| `size_bytes` | number | SHOULD | Package size |

---

## 3. Registry Index Schema

A registry index aggregates multiple module entries:

```json
{
  "$schema": "https://cognitive-modules.dev/schema/registry-v2.json",
  "version": "2.0.0",
  "updated": "2026-02-01T00:00:00Z",
  
  "modules": {
    "code-reviewer": { /* registry entry */ },
    "code-simplifier": { /* registry entry */ }
  },
  
  "categories": {
    "code-quality": {
      "name": "Code Quality",
      "name_zh": "代码质量",
      "description": "Code review and quality assurance modules",
      "modules": ["code-reviewer", "code-simplifier"]
    }
  },
  
  "featured": ["code-reviewer", "task-prioritizer"],
  
  "stats": {
    "total_modules": 25,
    "total_downloads": 50000,
    "last_updated": "2026-02-01T00:00:00Z"
  }
}
```

---

## 4. Distribution Formats

### Tarball Structure

Modules MUST be distributed as gzipped tarballs with this structure:

```
code-reviewer-2.2.0.tar.gz
└── code-reviewer/
    ├── module.yaml       # REQUIRED
    ├── prompt.md         # REQUIRED
    ├── schema.json       # REQUIRED
    ├── MODULE.md         # OPTIONAL (v1 compat)
    └── tests/            # RECOMMENDED
        ├── case1.input.json
        └── case1.expected.json
```

### GitHub Source

For GitHub-hosted modules, the source format is:

```
github:<owner>/<repo>[/<path>][@<ref>]
```

Examples:
- `github:ziel-io/cognitive-modules/cognitive/modules/code-reviewer`
- `github:ziel-io/cognitive-modules/cognitive/modules/code-reviewer@v2.2.0`
- `github:myorg/my-modules/modules/custom-module@main`

### Checksum Verification

Clients MUST verify checksums before installation:

```python
import hashlib

def verify_checksum(file_path: str, expected: str) -> bool:
    algo, expected_hash = expected.split(":")
    with open(file_path, "rb") as f:
        actual_hash = hashlib.new(algo, f.read()).hexdigest()
    return actual_hash == expected_hash
```

---

## 5. Quality Signals

### Conformance Level

Modules SHOULD declare their conformance level:

| Level | Badge | Requirements |
|-------|-------|--------------|
| 1 | `[Level 1]` | Basic envelope validation |
| 2 | `[Level 2]` | Full tier + error codes |
| 3 | `[Level 3]` | Composition + context |

### Verification Status

| Status | Description |
|--------|-------------|
| `unverified` | No external verification |
| `community_verified` | Reviewed by community members |
| `official_verified` | Verified by Cognitive Modules Foundation |

### Trust Indicators

```json
{
  "quality": {
    "badges": [
      "conformance-level-2",
      "test-vectors-pass",
      "security-audit-2026-01"
    ],
    "warnings": [],
    "deprecated": false,
    "successor": null
  }
}
```

---

## 6. Namespaces

### Reserved Namespaces

| Namespace | Owner | Description |
|-----------|-------|-------------|
| `official` | Cognitive Modules Project | Core modules |
| `community` | Open registration | Community modules |
| `verified` | Verified publishers | Verified organizations |

### Organization Namespaces

Organizations MAY register namespaces:

```json
{
  "namespace": "acme-corp",
  "owner": "Acme Corporation",
  "verified": true,
  "modules": ["acme-corp/internal-reviewer"]
}
```

### Name Collision Prevention

1. Names within a namespace MUST be unique
2. Names SHOULD follow `[a-z][a-z0-9-]*` pattern
3. Names MUST NOT exceed 64 characters
4. Reserved prefixes: `cognitive-`, `cm-`, `core-`

---

## 7. Versioning

### Version Format

Modules MUST use semantic versioning:

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

Examples:
- `2.2.0` — Stable release
- `2.3.0-beta.1` — Pre-release
- `2.2.1+build.123` — Build metadata

### Version Resolution

When installing, clients SHOULD support version ranges:

| Range | Meaning |
|-------|---------|
| `2.2.0` | Exact version |
| `^2.2.0` | Compatible (2.x.x, x >= 2) |
| `~2.2.0` | Patch only (2.2.x) |
| `>=2.0.0` | Minimum version |
| `*` or `latest` | Latest stable |

### Deprecation

Deprecated modules MUST include:

```json
{
  "timestamps": {
    "deprecated_at": "2026-01-01T00:00:00Z"
  },
  "quality": {
    "deprecated": true,
    "successor": "new-module-name@2.0.0",
    "deprecation_reason": "Replaced by new-module with improved features"
  }
}
```

---

## 8. API Endpoints

### Registry API (Recommended)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/modules` | List all modules |
| GET | `/v1/modules/{name}` | Get module entry |
| GET | `/v1/modules/{name}/versions` | List versions |
| GET | `/v1/modules/{name}/{version}` | Get specific version |
| GET | `/v1/search?q={query}` | Search modules |
| GET | `/v1/categories` | List categories |

### Example Responses

**GET /v1/modules/code-reviewer**

```json
{
  "name": "code-reviewer",
  "latest": "2.2.0",
  "versions": ["2.2.0", "2.1.0", "1.0.0"],
  "entry": { /* full registry entry */ }
}
```

**GET /v1/search?q=code+review**

```json
{
  "query": "code review",
  "total": 3,
  "results": [
    {
      "name": "code-reviewer",
      "description": "...",
      "score": 0.95
    }
  ]
}
```

---

## 9. Security

### Package Signing (Future)

Packages MAY be signed using GPG or Sigstore:

```json
{
  "distribution": {
    "tarball": "...",
    "checksum": "sha256:...",
    "signature": "https://registry.../code-reviewer-2.2.0.sig",
    "signing_key": "https://registry.../keys/ziel-io.pub"
  }
}
```

### Malware Prevention

Registries SHOULD:

1. Scan packages for known malware patterns
2. Reject modules that request dangerous permissions
3. Require verified publisher for `official` namespace
4. Implement rate limiting on publishing

### Audit Trail

Registries SHOULD maintain:

```json
{
  "audit": {
    "published_by": "user@example.com",
    "published_at": "2026-02-01T00:00:00Z",
    "published_from_ip": "redacted",
    "verification_status": "automated_scan_passed"
  }
}
```

---

## Appendix: Migration from v1 Registry

The current `cognitive-registry.json` uses v1 format. To migrate:

### v1 Format (Current)

```json
{
  "modules": {
    "code-reviewer": {
      "description": "...",
      "version": "1.0.0",
      "source": "github:...",
      "tags": [...],
      "author": "..."
    }
  }
}
```

### v2 Format (New)

```json
{
  "modules": {
    "code-reviewer": {
      "identity": {
        "name": "code-reviewer",
        "namespace": "official",
        "version": "2.2.0",
        "spec_version": "2.2"
      },
      "metadata": {
        "description": "...",
        "author": "...",
        "keywords": [...]
      },
      "quality": { ... },
      "dependencies": { ... },
      "distribution": { ... }
    }
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02 | Initial registry protocol |
