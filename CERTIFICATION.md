# Cognitive Modules Certification Program

> **Version**: 1.0  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines the certification program for Cognitive Modules, including badges, verification processes, and quality standards.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Certification Types](#2-certification-types)
3. [Module Certification](#3-module-certification)
4. [Runtime Certification](#4-runtime-certification)
5. [Verification Process](#5-verification-process)
6. [Badges](#6-badges)
7. [Maintenance Requirements](#7-maintenance-requirements)
8. [Revocation](#8-revocation)

---

## 1. Overview

### Purpose

The Certification Program provides:

1. **Trust** — Users can identify verified, quality modules and runtimes
2. **Standards** — Clear quality bar for the ecosystem
3. **Recognition** — Reward high-quality contributions
4. **Interoperability** — Ensure implementations work together

### Certification vs Conformance

| Concept | Scope | Who Verifies |
|---------|-------|--------------|
| **Conformance** | Meets technical requirements | Self-assessed |
| **Certification** | Verified quality standards | Foundation/Community |

Conformance is a prerequisite for certification.

---

## 2. Certification Types

### 2.1 Module Certification Levels

| Level | Name | Requirements | Badge |
|-------|------|--------------|-------|
| Bronze | **Basic** | Schema valid, runs successfully | ![Bronze](https://img.shields.io/badge/CM-Bronze-cd7f32) |
| Silver | **Tested** | + Test coverage ≥ 60% | ![Silver](https://img.shields.io/badge/CM-Silver-C0C0C0) |
| Gold | **Verified** | + Community review passed | ![Gold](https://img.shields.io/badge/CM-Gold-FFD700) |
| Platinum | **Official** | + Security audit, Foundation endorsed | ![Platinum](https://img.shields.io/badge/CM-Platinum-E5E4E2) |

### 2.2 Runtime Certification Levels

| Level | Name | Requirements | Badge |
|-------|------|--------------|-------|
| Level 1 | **Basic** | Passes Level 1 test vectors | ![L1](https://img.shields.io/badge/Runtime-Level%201-blue) |
| Level 2 | **Standard** | Passes Level 2 test vectors | ![L2](https://img.shields.io/badge/Runtime-Level%202-green) |
| Level 3 | **Full** | Passes Level 3 test vectors | ![L3](https://img.shields.io/badge/Runtime-Level%203-gold) |

---

## 3. Module Certification

### 3.1 Bronze (Basic) Requirements

**Checklist:**

```markdown
□ Valid module.yaml
  □ Required fields: name, version, responsibility, tier
  □ Passes schema validation

□ Valid schema.json
  □ Contains input, data, meta, error schemas
  □ Passes JSON Schema Draft-07 validation

□ Valid prompt.md
  □ Non-empty
  □ Contains task instructions

□ Successful Execution
  □ Runs without errors on at least one LLM
  □ Returns valid v2.2 envelope

□ Basic Documentation
  □ README or MODULE.md exists
  □ Describes what module does
```

**Automated Verification:**

```bash
cogn validate my-module --v22
# Must pass all checks
```

### 3.2 Silver (Tested) Requirements

All Bronze requirements, plus:

```markdown
□ Test Cases
  □ At least 3 test cases in tests/ directory
  □ Covers success and failure scenarios
  □ Tests defined in module.yaml

□ Test Coverage
  □ ≥ 60% of schema fields tested
  □ All required output fields tested

□ Example Files
  □ examples/input.json exists
  □ examples/output.json exists
  □ Examples are valid per schemas
```

**Verification Command:**

```bash
cogn test my-module --coverage
# Coverage must be ≥ 60%
```

### 3.3 Gold (Verified) Requirements

All Silver requirements, plus:

```markdown
□ Community Review
  □ At least 2 independent reviewers
  □ Review checklist completed
  □ No unresolved critical issues

□ Documentation Quality
  □ Clear responsibility statement
  □ Input/output examples
  □ Edge case documentation
  □ Known limitations listed

□ Code Quality
  □ No obvious prompt injection vulnerabilities
  □ Reasonable token usage
  □ Appropriate tier selection
```

**Review Checklist:**

```markdown
## Module Review: [module-name]

### Reviewer: [name]
### Date: [date]

#### Functionality
- [ ] Module does what it claims
- [ ] Output matches schema
- [ ] Confidence values are reasonable

#### Safety
- [ ] No prompt injection vectors
- [ ] Appropriate policies declared
- [ ] Excludes list is comprehensive

#### Quality
- [ ] Prompt is clear and effective
- [ ] Error handling is appropriate
- [ ] Documentation is accurate

#### Recommendation
- [ ] Approve for Gold
- [ ] Request changes
- [ ] Reject

#### Comments:
[...]
```

### 3.4 Platinum (Official) Requirements

All Gold requirements, plus:

```markdown
□ Security Audit
  □ Professional security review
  □ No known vulnerabilities
  □ Audit report published

□ Foundation Endorsement
  □ Approved by Technical Steering Committee
  □ Meets ecosystem quality bar
  □ Long-term maintenance commitment

□ SLA Commitment
  □ Response time for security issues
  □ Version support policy
```

---

## 4. Runtime Certification

### 4.1 Level 1 Certification

**Requirements:**

```markdown
□ Test Vector Compliance
  □ Passes all spec/test-vectors/valid/*.json
  □ Rejects all spec/test-vectors/invalid/*.json
  □ Level 1 conformance tests pass

□ Basic Functionality
  □ Loads modules from standard paths
  □ Validates input against schema
  □ Returns v2.2 envelope format

□ Documentation
  □ Installation instructions
  □ Basic usage examples
```

**Verification:**

```bash
python scripts/validate-test-vectors.py --level 1
# All tests must pass
```

### 4.2 Level 2 Certification

All Level 1 requirements, plus:

```markdown
□ Tier Support
  □ Enforces exec/decision/exploration semantics
  □ Tier-specific defaults applied

□ Error Codes
  □ Returns E1xxx for input errors
  □ Returns E2xxx for processing errors
  □ Returns E3xxx for output errors

□ Repair Pass
  □ Implements repair pass
  □ Doesn't modify business semantics

□ Extended Test Vectors
  □ Passes Level 2 test vectors
```

### 4.3 Level 3 Certification

All Level 2 requirements, plus:

```markdown
□ Composition Support
  □ Parses @call directives
  □ Detects circular dependencies
  □ Enforces max depth

□ Context Protocol
  □ Supports context modes
  □ Validates context schemas

□ Full Error Taxonomy
  □ Returns E4xxx for runtime errors

□ Extended Test Vectors
  □ Passes all official test vectors
```

---

## 5. Verification Process

### 5.1 Self-Certification (Bronze/Level 1)

1. Run automated verification tools
2. Generate verification report
3. Add badge to README
4. Submit to registry (optional)

```bash
# Generate verification report
cogn verify my-module --output report.json

# Report format
{
  "module": "my-module",
  "version": "1.0.0",
  "timestamp": "2026-02-01T00:00:00Z",
  "level": "bronze",
  "checks": {
    "schema_valid": true,
    "runs_successfully": true,
    "envelope_valid": true
  },
  "verification_hash": "sha256:..."
}
```

### 5.2 Community Verification (Silver/Gold)

1. Open verification request (GitHub Issue)
2. Assign 2+ reviewers from reviewer pool
3. Reviewers complete checklist
4. Reviewers approve or request changes
5. Upon approval, badge granted

**Request Template:**

```markdown
## Module Certification Request

**Module:** [name]
**Version:** [version]
**Requested Level:** Silver / Gold
**Repository:** [url]

### Checklist
- [x] Bronze certification passed
- [x] Test coverage ≥ 60%
- [x] Documentation complete
- [ ] Ready for review

### Notes
[Any additional context]
```

### 5.3 Official Verification (Platinum/Level 3)

1. Submit formal application to Foundation
2. Security audit conducted
3. TSC review
4. Certification granted or denied
5. Listed in official registry

---

## 6. Badges

### 6.1 Module Badges

**Markdown:**

```markdown
<!-- Bronze -->
[![Cognitive Module Bronze](https://img.shields.io/badge/Cognitive%20Module-Bronze-cd7f32)](https://cognitive-modules.dev/certified)

<!-- Silver -->
[![Cognitive Module Silver](https://img.shields.io/badge/Cognitive%20Module-Silver-C0C0C0)](https://cognitive-modules.dev/certified)

<!-- Gold -->
[![Cognitive Module Gold](https://img.shields.io/badge/Cognitive%20Module-Gold-FFD700)](https://cognitive-modules.dev/certified)

<!-- Platinum -->
[![Cognitive Module Platinum](https://img.shields.io/badge/Cognitive%20Module-Platinum-E5E4E2)](https://cognitive-modules.dev/certified)
```

### 6.2 Runtime Badges

```markdown
<!-- Level 1 -->
[![Cognitive Runtime Level 1](https://img.shields.io/badge/Cognitive%20Runtime-Level%201-blue)](https://cognitive-modules.dev/runtimes)

<!-- Level 2 -->
[![Cognitive Runtime Level 2](https://img.shields.io/badge/Cognitive%20Runtime-Level%202-green)](https://cognitive-modules.dev/runtimes)

<!-- Level 3 -->
[![Cognitive Runtime Level 3](https://img.shields.io/badge/Cognitive%20Runtime-Level%203-gold)](https://cognitive-modules.dev/runtimes)
```

### 6.3 Badge Verification

Badges link to verification page showing:

- Module/runtime name and version
- Certification level
- Verification date
- Verifier(s)
- Verification report

```
https://cognitive-modules.dev/certified/code-reviewer/2.2.0
```

---

## 7. Maintenance Requirements

### 7.1 Certification Validity

| Level | Validity Period | Renewal |
|-------|-----------------|---------|
| Bronze | Indefinite | Automatic on release |
| Silver | 12 months | Re-run tests |
| Gold | 12 months | Community re-review |
| Platinum | 24 months | TSC re-review |

### 7.2 Version Updates

When releasing a new version:

- **Patch** (1.0.x): Certification carries over
- **Minor** (1.x.0): Re-run automated tests
- **Major** (x.0.0): Full re-certification required

### 7.3 Security Updates

Certified modules/runtimes MUST:

1. Respond to security reports within 7 days
2. Release patches for critical issues within 14 days
3. Disclose vulnerabilities responsibly

---

## 8. Revocation

### 8.1 Grounds for Revocation

- Security vulnerability not addressed
- False claims about functionality
- Malicious behavior discovered
- Maintenance abandoned (no response for 90 days)

### 8.2 Revocation Process

1. Issue identified and documented
2. Maintainer notified, given 14 days to respond
3. If unresolved, TSC votes on revocation
4. Badge removed, registry updated
5. Public notice posted

### 8.3 Appeal Process

1. Submit appeal within 30 days
2. TSC reviews appeal
3. Final decision within 14 days
4. Decision is final

---

## Appendix: Reviewer Guidelines

### Becoming a Reviewer

Requirements:

1. Published at least one certified module
2. Active community member for 3+ months
3. Applied and approved by TSC

### Reviewer Responsibilities

1. Complete reviews within 14 days
2. Follow review checklist
3. Provide constructive feedback
4. Recuse from conflicts of interest

### Reviewer Recognition

- Listed on contributors page
- Priority consideration for TSC
- Exclusive reviewer badge

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0-draft | 2026-02 | Initial certification program |
