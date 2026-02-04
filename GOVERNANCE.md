# Cognitive Modules Governance

> **Version**: 1.0  
> **Status**: Draft  
> **Last Updated**: 2026-02

This document defines the governance structure for the Cognitive Modules project.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Governance Structure](#2-governance-structure)
3. [Roles and Responsibilities](#3-roles-and-responsibilities)
4. [Decision Making](#4-decision-making)
5. [Elections and Appointments](#5-elections-and-appointments)
6. [Code of Conduct](#6-code-of-conduct)
7. [Amendments](#7-amendments)

---

## 1. Overview

### Mission

The Cognitive Modules project exists to:

1. Develop and maintain a high-quality, open specification for structured AI task execution
2. Foster an ecosystem of compatible implementations and modules
3. Ensure the specification remains vendor-neutral and community-driven
4. Promote best practices for verifiable, auditable AI outputs

### Principles

1. **Openness** — All decisions are made transparently
2. **Meritocracy** — Influence is earned through contribution
3. **Consensus** — Major decisions seek broad agreement
4. **Stability** — Changes are carefully considered for backward compatibility
5. **Inclusivity** — All contributors are welcome regardless of background

---

## 2. Governance Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     Governance Structure                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                   ┌─────────────────────┐                       │
│                   │ Technical Steering  │                       │
│                   │    Committee (TSC)  │                       │
│                   │     5 members       │                       │
│                   └──────────┬──────────┘                       │
│                              │                                   │
│            ┌─────────────────┼─────────────────┐                │
│            │                 │                 │                │
│            ▼                 ▼                 ▼                │
│  ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐       │
│  │ Core Maintainers│ │  Working    │ │   Community     │       │
│  │   (Spec + Ref)  │ │   Groups    │ │  Contributors   │       │
│  └─────────────────┘ └─────────────┘ └─────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Governance Bodies

| Body | Size | Term | Responsibility |
|------|------|------|----------------|
| **TSC** | 5 | 2 years | Strategic direction, major decisions |
| **Core Maintainers** | 3-7 | Indefinite | Day-to-day maintenance |
| **Working Groups** | Varies | Project-based | Specific initiatives |
| **Community** | Open | - | Contributions, feedback |

---

## 3. Roles and Responsibilities

### 3.1 Technical Steering Committee (TSC)

**Composition:**
- 5 voting members
- At least 2 must be independent (no shared employer)
- Chair rotates annually

**Responsibilities:**
- Approve major specification changes (Core CMEPs)
- Resolve disputes between maintainers
- Set project roadmap
- Approve new Core Maintainers
- Manage project resources
- Represent project externally

**Meetings:**
- Monthly public meeting (recorded)
- Agenda published 1 week in advance
- Minutes published within 1 week

### 3.2 Core Maintainers

**Responsibilities:**
- Review and merge pull requests
- Triage issues
- Release management
- Extension CMEP approval
- Community support

**Current Core Maintainers:**

| Name | Focus Area | Since |
|------|------------|-------|
| TBD | Specification | - |
| TBD | Python Runtime | - |
| TBD | Node.js Runtime | - |

### 3.3 Working Groups

Active working groups:

| Group | Focus | Lead |
|-------|-------|------|
| **Spec WG** | Specification development | TBD |
| **Ecosystem WG** | Registry, modules | TBD |
| **Security WG** | Security reviews | TBD |

Working groups are created by TSC as needed.

### 3.4 Community Contributors

Anyone can contribute by:

- Opening issues and discussions
- Submitting pull requests
- Writing CMEPs
- Creating modules
- Improving documentation
- Helping other users

---

## 4. Decision Making

### 4.1 Consensus Model

Decisions follow this hierarchy:

1. **Lazy Consensus** — For routine changes
2. **Simple Majority** — For maintainer-level decisions
3. **Supermajority (66%)** — For TSC decisions
4. **Unanimous** — For governance changes

### 4.2 Decision Types

| Decision | Who Decides | Threshold |
|----------|-------------|-----------|
| Bug fix PR | Any maintainer | 1 approval |
| Feature PR | Core maintainers | 2 approvals |
| Extension CMEP | Core maintainers | 2 approvals |
| Core CMEP | TSC | 66% vote |
| New maintainer | TSC | 66% vote |
| Governance change | TSC | Unanimous |
| Remove maintainer | TSC | 66% vote (excl. affected) |

### 4.3 Voting Process

For formal votes:

1. Motion proposed with 1 week notice
2. Discussion period (1 week minimum)
3. Voting period (1 week)
4. Votes recorded publicly
5. Result announced

**Vote options:**
- +1: Approve
- 0: Abstain
- -1: Reject (must provide reason)

### 4.4 Conflict Resolution

1. Discussion in issue/PR
2. Escalate to maintainer meeting
3. Escalate to TSC if unresolved
4. TSC decision is final

---

## 5. Elections and Appointments

### 5.1 TSC Elections

**Eligibility to vote:**
- Core maintainers
- Active contributors (10+ merged PRs in past year)

**Eligibility to run:**
- Active contributor for 6+ months
- Demonstrated leadership
- No conflict of interest

**Process:**
1. Nominations open 4 weeks before election
2. Candidates submit statements
3. 2-week voting period
4. Ranked choice voting
5. Results announced

**Schedule:**
- Elections held annually in January
- 2-3 seats open each year (staggered terms)

### 5.2 Core Maintainer Appointments

**Nomination:**
- Self-nomination or by existing maintainer
- Requires 6+ months of active contribution
- Demonstrated expertise in focus area

**Approval:**
- TSC vote (66% approval)
- No veto from existing maintainers in same area

**Emeritus:**
- Maintainers inactive for 6+ months become emeritus
- Can return to active status with TSC approval

### 5.3 Working Group Formation

1. Proposal submitted to TSC
2. Charter defines scope, deliverables, timeline
3. TSC approves formation
4. Lead appointed by TSC
5. Members volunteer or are invited

---

## 6. Code of Conduct

### 6.1 Expected Behavior

All participants must:

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the project
- Show empathy to other community members

### 6.2 Unacceptable Behavior

- Harassment or discrimination
- Personal attacks
- Trolling or inflammatory comments
- Publishing others' private information
- Other unprofessional conduct

### 6.3 Enforcement

1. **Warning** — First offense, private warning
2. **Temporary Ban** — Repeated offenses, 30-day ban
3. **Permanent Ban** — Severe violations

Reports should be sent to: conduct@cognitive-modules.dev (TBD)

---

## 7. Amendments

### 7.1 Proposing Changes

Governance changes require:

1. CMEP of type "Meta"
2. 4-week review period
3. Unanimous TSC approval

### 7.2 Emergency Changes

In case of urgent security or safety issues:

1. TSC can make temporary changes (66% vote)
2. Changes must be ratified within 30 days
3. Failure to ratify reverts the change

---

## Appendix A: Current Governance

### TSC Members (Initial)

The initial TSC is appointed by the project founders:

| Name | Affiliation | Term Ends |
|------|-------------|-----------|
| TBD | - | 2028-01 |
| TBD | - | 2028-01 |
| TBD | - | 2027-01 |
| TBD | - | 2027-01 |
| TBD | - | 2027-01 |

First elections will be held when:
- At least 10 active contributors exist
- At least 2 independent implementations exist

### Bootstrapping Period

Until the first election:
- Founders act as provisional TSC
- Decisions require 2/3 approval
- Focus on building contributor base

---

## Appendix B: Contributor Path

```
┌────────────────────────────────────────────────────────────────┐
│                    Contributor Path                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌───────────────┐    ┌────────────────┐      │
│  │ Community│───▶│  Contributor  │───▶│ Core Maintainer│      │
│  │  Member  │    │  (10+ PRs)    │    │  (TSC approval)│      │
│  └──────────┘    └───────────────┘    └───────┬────────┘      │
│                                                │               │
│                                                ▼               │
│                                         ┌───────────┐         │
│                                         │ TSC Member│         │
│                                         │ (elected) │         │
│                                         └───────────┘         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Progression Criteria

| Level | Criteria |
|-------|----------|
| Community Member | Anyone participating |
| Contributor | 1+ merged PR |
| Active Contributor | 10+ merged PRs in past year |
| Core Maintainer | TSC appointment, sustained contribution |
| TSC Member | Election by contributors |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0-draft | 2026-02 | Initial governance document |
