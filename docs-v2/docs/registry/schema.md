---
sidebar_position: 3
---

# Registry Schema

Registry entries should validate against the official JSON Schema.

## Required Fields

- Module identity (`name`, `version`)
- Source location (`repository`, `path` or package URL)
- Runtime compatibility (`tier`, `spec version`, optional conformance level)

## Validation Goal

Reject malformed or ambiguous entries before install.

## Source of Truth

- `spec/registry-entry.schema.json`
- `REGISTRY-PROTOCOL.md`
