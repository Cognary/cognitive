# Cognitive Modules Conformance Levels

> **Version**: 2.2  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines conformance levels for Cognitive Modules runtime implementations. Implementations MAY claim partial conformance by declaring which level they support.

---

## Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

---

## Conformance Levels Overview

| Level | Name | Description | Use Case |
|-------|------|-------------|----------|
| 1 | Basic | Core envelope validation | Minimal viable implementation |
| 2 | Standard | Full tier + error codes | Production-ready implementation |
| 3 | Full | Composition + context | Enterprise/platform implementation |

---

## Level 1: Basic Conformance

### Requirements

A Level 1 conformant implementation MUST:

1. **Envelope Validation**
   - MUST validate response envelopes against `response-envelope.schema.json`
   - MUST accept envelopes with `ok: true` containing `meta` and `data` fields
   - MUST accept envelopes with `ok: false` containing `meta` and `error` fields
   - MUST reject envelopes missing required fields

2. **Meta Field Validation**
   - MUST validate `meta.confidence` is a number in range [0, 1]
   - MUST validate `meta.risk` is one of: `"none"`, `"low"`, `"medium"`, `"high"`
   - MUST validate `meta.explain` is a string with maxLength 280
   - MUST accept optional fields: `trace_id`, `model`, `latency_ms`

3. **Data Field Validation**
   - MUST validate `data.rationale` is present and is a string
   - MUST accept `data.extensions.insights` array when present

4. **Error Field Validation**
   - MUST validate `error.code` is a string
   - MUST validate `error.message` is a string

5. **Schema Validation**
   - MUST validate input against module's `schema.json#/input`
   - MUST validate output against module's `schema.json#/data`
   - MUST support JSON Schema Draft-07

### Test Vectors

Level 1 implementations MUST pass all test vectors with `conformance_level: 1`.

### Badge

```
[Cognitive Modules Level 1]
```

---

## Level 2: Standard Conformance

### Requirements

A Level 2 conformant implementation MUST meet all Level 1 requirements, plus:

1. **Tier Support**
   - MUST support all three tiers: `exec`, `decision`, `exploration`
   - MUST enforce tier-specific schema strictness:
     - `exec`: high strictness, overflow disabled
     - `decision`: medium strictness, overflow enabled (max 5)
     - `exploration`: low strictness, overflow relaxed (max 20)

2. **Error Codes**
   - MUST implement standard error codes E1xxx through E3xxx
   - MUST return appropriate error codes for validation failures
   - SHOULD include `recoverable` and `suggestion` in error responses

3. **Overflow Handling**
   - MUST support `extensions.insights` array
   - MUST enforce `overflow.max_items` limit from module.yaml
   - MUST validate `suggested_mapping` when `require_suggested_mapping: true`

4. **Extensible Enum**
   - MUST support `enums.strategy: extensible`
   - MUST accept `{ custom: string, reason: string }` objects for extensible enums
   - MUST enforce `enums.strategy: strict` when configured

5. **Repair Pass**
   - SHOULD implement repair pass for minor schema violations
   - MUST NOT modify business semantics during repair
   - MAY truncate over-length `explain` to 280 characters
   - MUST NOT invent new enum values during repair

6. **v2.1 Compatibility**
   - SHOULD support `compat.accepts_v21_payload: true`
   - SHOULD implement auto-wrap from v2.1 to v2.2 format

### Test Vectors

Level 2 implementations MUST pass all test vectors with `conformance_level: 1` or `2`.

### Badge

```
[Cognitive Modules Level 2]
```

---

## Level 3: Full Conformance

### Requirements

A Level 3 conformant implementation MUST meet all Level 2 requirements, plus:

1. **Module Composition**
   - MUST support `@call:module` syntax in prompts
   - MUST support `requires` dependency declarations
   - MUST enforce maximum call depth (default: 5)
   - MUST detect and prevent circular dependencies

2. **Context Protocol**
   - MUST support `context: fork` and `context: main` modes
   - SHOULD support context type declarations (`accepts`, `emits`)
   - MAY implement context caching with TTL

3. **Runtime Requirements**
   - MUST validate `runtime_requirements` from module.yaml
   - MUST verify `structured_output` capability
   - MUST enforce `max_input_tokens` limit
   - SHOULD check `preferred_capabilities` compatibility

4. **Policy Enforcement**
   - MUST enforce `policies` from module.yaml
   - MUST implement `tools.policy` access control
   - MUST block denied tools when `tools.denied` is specified

5. **Complete Error Taxonomy**
   - MUST implement all error codes E1xxx through E4xxx
   - MUST handle runtime errors (E4xxx)

6. **Test Coverage**
   - MUST pass all official test vectors
   - SHOULD implement module-level test runner
   - SHOULD support `tests` declarations in module.yaml

### Test Vectors

Level 3 implementations MUST pass all test vectors regardless of `conformance_level`.

### Badge

```
[Cognitive Modules Level 3]
```

---

## Conformance Declaration

Implementations SHOULD declare their conformance level in documentation:

```markdown
## Conformance

This implementation conforms to Cognitive Modules Specification v2.2 at **Level 2**.

- [x] Level 1: Basic envelope validation
- [x] Level 2: Full tier support, error codes, overflow
- [ ] Level 3: Composition, context protocol
```

---

## Verification Process

### Self-Assessment

1. Download official test vectors from `spec/test-vectors/`
2. Run all test vectors against your implementation
3. Document pass/fail results
4. Declare highest level where all tests pass

### Official Certification (Future)

A formal certification program will be established when:
- At least 2 independent implementations exist
- Community governance is in place
- Automated test infrastructure is available

---

## Error Code Reference

### Level 1 Required

| Code | Name | Description |
|------|------|-------------|
| - | - | No specific codes required |

### Level 2 Required

| Code | Category | Description |
|------|----------|-------------|
| E1001 | Input | Invalid input schema |
| E1002 | Input | Missing required field |
| E1003 | Input | Type mismatch |
| E2001 | Processing | Confidence below threshold |
| E2002 | Processing | Timeout exceeded |
| E2003 | Processing | Token limit reached |
| E3001 | Output | Output schema violation |
| E3002 | Output | Partial result (overflow) |
| E3003 | Output | Rationale missing |

### Level 3 Required

| Code | Category | Description |
|------|----------|-------------|
| E4001 | Runtime | Provider unavailable |
| E4002 | Runtime | Rate limited |
| E4003 | Runtime | Context window exceeded |
| E4004 | Runtime | Circular dependency detected |
| E4005 | Runtime | Max call depth exceeded |

---

## Appendix: Conformance Matrix

| Feature | Level 1 | Level 2 | Level 3 |
|---------|---------|---------|---------|
| Envelope validation | MUST | MUST | MUST |
| Meta field validation | MUST | MUST | MUST |
| Schema validation | MUST | MUST | MUST |
| Tier support | - | MUST | MUST |
| Error codes (E1-E3) | - | MUST | MUST |
| Overflow handling | - | MUST | MUST |
| Extensible enum | - | MUST | MUST |
| Repair pass | - | SHOULD | MUST |
| v2.1 compatibility | - | SHOULD | SHOULD |
| Module composition | - | - | MUST |
| Context protocol | - | - | MUST |
| Policy enforcement | - | - | MUST |
| Error codes (E4) | - | - | MUST |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2-draft | 2026-02 | Initial conformance levels |
