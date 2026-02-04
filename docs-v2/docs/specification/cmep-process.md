---
sidebar_position: 10
---

# Cognitive Modules Enhancement Proposal (CMEP) Process

> **Version**: 1.0  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines the process for proposing, reviewing, and adopting changes to the Cognitive Modules specification.

---

## Table of Contents

1. [Overview](#1-overview)
2. [CMEP Types](#2-cmep-types)
3. [CMEP Lifecycle](#3-cmep-lifecycle)
4. [Writing a CMEP](#4-writing-a-cmep)
5. [Review Process](#5-review-process)
6. [Implementation](#6-implementation)
7. [CMEP Index](#7-cmep-index)

---

## 1. Overview

### What is a CMEP?

A **Cognitive Modules Enhancement Proposal (CMEP)** is a design document providing:

- Rationale for a proposed change
- Technical specification
- Implementation considerations
- Backward compatibility analysis

### When to Write a CMEP

| Change Type | CMEP Required? |
|-------------|----------------|
| New specification feature | ✅ Yes |
| Breaking change to existing spec | ✅ Yes |
| New standard error code | ⚠️ Minor CMEP |
| Bug fix or clarification | ❌ No (PR only) |
| Documentation improvement | ❌ No (PR only) |

### Goals

1. **Transparency** — All significant changes are publicly discussed
2. **Quality** — Proposals are thoroughly reviewed before adoption
3. **History** — Permanent record of design decisions
4. **Inclusivity** — Anyone can propose changes

---

## 2. CMEP Types

### Standards Track

Changes to the core specification that affect implementations:

- **Core** — Response envelope, meta fields, error codes
- **Extension** — Optional features (composition, context)
- **Process** — Changes to the CMEP process itself

### Informational

Non-normative documents:

- Best practices
- Design rationale
- Implementation guides

### Meta

Process and governance changes:

- CMEP process updates
- Governance changes
- Community guidelines

---

## 3. CMEP Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                       CMEP Lifecycle                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────┐    ┌──────┐    ┌──────────┐    ┌───────┐    ┌──────┐ │
│  │ Draft │───▶│Review│───▶│ Accepted │───▶│ Final │───▶│Active│ │
│  └──────┘    └──────┘    └──────────┘    └───────┘    └──────┘ │
│      │           │             │                                 │
│      │           │             │                                 │
│      ▼           ▼             ▼                                 │
│  ┌──────────┐  ┌────────┐  ┌──────────┐                        │
│  │Withdrawn │  │Rejected│  │Superseded│                        │
│  └──────────┘  └────────┘  └──────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Status Definitions

| Status | Description |
|--------|-------------|
| **Draft** | Initial proposal, open for feedback |
| **Review** | Formal review period (2 weeks minimum) |
| **Accepted** | Approved by maintainers, awaiting implementation |
| **Final** | Specification text finalized |
| **Active** | Implemented in reference runtime |
| **Rejected** | Not accepted (with documented reason) |
| **Withdrawn** | Withdrawn by author |
| **Superseded** | Replaced by newer CMEP |

---

## 4. Writing a CMEP

### 4.1 CMEP Template

Create a new file: `cmeps/CMEP-XXXX.md`

```markdown
# CMEP-XXXX: [Title]

| Field | Value |
|-------|-------|
| CMEP | XXXX |
| Title | [Descriptive title] |
| Author | [Your name] <[email]> |
| Status | Draft |
| Type | Standards Track / Informational / Meta |
| Created | YYYY-MM-DD |
| Updated | YYYY-MM-DD |
| Requires | [CMEP numbers this depends on] |
| Replaces | [CMEP number if superseding] |

## Abstract

[One paragraph summary of the proposal]

## Motivation

[Why is this change needed? What problem does it solve?]

## Specification

[Detailed technical specification]

### [Section 1]

[Details...]

### [Section 2]

[Details...]

## Rationale

[Why this design? What alternatives were considered?]

## Backward Compatibility

[How does this affect existing implementations?]

### Breaking Changes

[List any breaking changes]

### Migration Path

[How to migrate from current behavior]

## Security Considerations

[Security implications of this proposal]

## Reference Implementation

[Link to implementation, or "TBD"]

## Rejected Alternatives

[What alternatives were considered and why rejected?]

## References

[Links to related documents, discussions, etc.]

## Copyright

This document is placed in the public domain.
```

### 4.2 CMEP Numbering

- CMEPs are numbered sequentially: 0001, 0002, 0003...
- Reserve a number by opening a PR with Draft status
- Numbers are never reused

### 4.3 Writing Guidelines

1. **Be specific** — Include concrete examples
2. **Be complete** — Address all edge cases
3. **Be concise** — Avoid unnecessary length
4. **Be objective** — Present alternatives fairly

---

## 5. Review Process

### 5.1 Submitting a CMEP

1. Fork the repository
2. Create `cmeps/CMEP-XXXX.md` using the template
3. Open a Pull Request with title "CMEP-XXXX: [Title]"
4. Request review from maintainers

### 5.2 Review Period

| CMEP Type | Minimum Review Period |
|-----------|----------------------|
| Core | 4 weeks |
| Extension | 2 weeks |
| Informational | 1 week |
| Meta | 2 weeks |

### 5.3 Review Criteria

Reviewers evaluate:

1. **Necessity** — Is this change needed?
2. **Design** — Is the design sound?
3. **Completeness** — Are all cases covered?
4. **Compatibility** — What's the migration burden?
5. **Clarity** — Is the spec clear and implementable?

### 5.4 Decision Process

- **Core CMEPs**: Requires TSC approval (>66% vote)
- **Extension CMEPs**: Requires 2 maintainer approvals
- **Informational**: Requires 1 maintainer approval
- **Meta**: Requires TSC approval

### 5.5 Requesting Changes

Reviewers may request:

- Clarifications
- Design changes
- Additional sections
- Reference implementation

Authors should address all feedback before advancing.

---

## 6. Implementation

### 6.1 Reference Implementation

Before a CMEP can reach **Final** status:

1. Reference implementation must exist
2. Implementation must pass relevant test vectors
3. Implementation must be reviewed

### 6.2 Test Vectors

CMEPs that change behavior SHOULD include:

- New test vectors in `spec/test-vectors/`
- Updates to existing test vectors if needed

### 6.3 Documentation Updates

When a CMEP reaches **Active**:

1. Update main specification (SPEC-v2.X.md)
2. Update CONFORMANCE.md if needed
3. Update related documentation
4. Add to CMEP index

---

## 7. CMEP Index

### Active CMEPs

| CMEP | Title | Status | Type |
|------|-------|--------|------|
| 0001 | CMEP Process | Active | Meta |
| 0002 | Module Composition | Draft | Extension |
| 0003 | Context Protocol | Draft | Extension |

### Reserved CMEPs

| CMEP | Title | Author | Status |
|------|-------|--------|--------|
| 0004 | Async Module Execution | TBD | Reserved |
| 0005 | Module Versioning | TBD | Reserved |

---

## Appendix A: Quick Reference

### Starting a CMEP

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/cognitive-modules.git
cd cognitive-modules

# 2. Create branch
git checkout -b cmep-XXXX-my-proposal

# 3. Create CMEP file
cp cmeps/TEMPLATE.md cmeps/CMEP-XXXX.md

# 4. Edit and commit
git add cmeps/CMEP-XXXX.md
git commit -m "CMEP-XXXX: Initial draft"

# 5. Push and open PR
git push origin cmep-XXXX-my-proposal
```

### CMEP PR Checklist

```markdown
## CMEP Submission Checklist

- [ ] Used CMEP template
- [ ] Abstract is clear and complete
- [ ] Motivation explains the problem
- [ ] Specification is detailed and implementable
- [ ] Backward compatibility addressed
- [ ] Security considerations included
- [ ] Added to CMEP index in PR
```

---

## Appendix B: Example CMEPs

### CMEP-0001: CMEP Process

This document itself serves as CMEP-0001.

### CMEP-0002: Module Composition

See [COMPOSITION.md](./composition) for the full specification.

### CMEP-0003: Context Protocol

See [CONTEXT-PROTOCOL.md](./context-protocol) for the full specification.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0-draft | 2026-02 | Initial CMEP process |
