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
| Requires | [CMEP numbers this depends on, or "None"] |
| Replaces | [CMEP number if superseding, or "None"] |

## Abstract

[One paragraph summary of the proposal. What does this CMEP do?]

## Motivation

[Why is this change needed? What problem does it solve? Who benefits?]

### Use Cases

1. [Use case 1]
2. [Use case 2]
3. [Use case 3]

## Specification

[Detailed technical specification. Be precise and complete.]

### [Section 1: e.g., Configuration]

[Details...]

```yaml
# Example configuration
example:
  field: value
```

### [Section 2: e.g., Behavior]

[Details...]

### [Section 3: e.g., API]

[Details...]

## Rationale

[Why this design? What trade-offs were made?]

### Design Decisions

1. **[Decision 1]**: [Explanation]
2. **[Decision 2]**: [Explanation]

## Backward Compatibility

[How does this affect existing implementations?]

### Breaking Changes

- [List any breaking changes, or "None"]

### Migration Path

[How to migrate from current behavior]

```python
# Before
old_way()

# After
new_way()
```

## Security Considerations

[Security implications of this proposal]

- [Consideration 1]
- [Consideration 2]

## Reference Implementation

[Link to implementation, or describe the implementation plan]

- Repository: [URL or "TBD"]
- Status: [Not started / In progress / Complete]

## Test Vectors

[New test vectors to add, if applicable]

```json
{
  "$test": {
    "name": "example-test",
    "expects": "accept",
    "conformance_level": 2
  },
  "envelope": {
    "...": "..."
  }
}
```

## Rejected Alternatives

### [Alternative 1]

[Description of alternative and why it was rejected]

### [Alternative 2]

[Description of alternative and why it was rejected]

## References

- [Reference 1](URL)
- [Reference 2](URL)
- Related CMEP: CMEP-XXXX

## Acknowledgements

[Thank contributors who helped with this proposal]

## Copyright

This document is placed in the public domain.
