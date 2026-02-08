---
sidebar_position: 4
---

# task-prioritizer

Prioritize and rank tasks based on multiple criteria.

## Basic Info

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Category | Project Management |
| Format | New Format |

## Features

- Analyze task urgency and importance
- Consider dependencies
- Estimate effort
- Provide prioritized ranking

## Usage

```bash
npx cogn@2.2.11 run task-prioritizer --args "fix login bug, write documentation, optimize database queries, add dark mode" --pretty
```

## Output Example

```json
{
  "prioritized_tasks": [
    {
      "task": "fix login bug",
      "priority": 1,
      "urgency": "high",
      "importance": "critical",
      "effort": "medium",
      "reason": "Security-affecting bug blocking users"
    },
    {
      "task": "optimize database queries",
      "priority": 2,
      "urgency": "medium",
      "importance": "high",
      "effort": "high",
      "reason": "Performance impacts user experience"
    },
    {
      "task": "write documentation",
      "priority": 3,
      "urgency": "low",
      "importance": "medium",
      "effort": "medium",
      "reason": "Important for long-term maintainability"
    },
    {
      "task": "add dark mode",
      "priority": 4,
      "urgency": "low",
      "importance": "low",
      "effort": "low",
      "reason": "Nice-to-have feature"
    }
  ],
  "summary": "Prioritized based on user impact and technical risk",
  "rationale": "Login bug is critical as it blocks user access...",
  "confidence": 0.88
}
```

## Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `prioritized_tasks` | array | Ranked task list |
| `prioritized_tasks[].task` | string | Task description |
| `prioritized_tasks[].priority` | number | Priority rank (1 = highest) |
| `prioritized_tasks[].urgency` | string | high/medium/low |
| `prioritized_tasks[].importance` | string | critical/high/medium/low |
| `prioritized_tasks[].effort` | string | high/medium/low |
| `prioritized_tasks[].reason` | string | Prioritization reason |
| `summary` | string | Overall prioritization logic |
| `rationale` | string | Detailed reasoning |
| `confidence` | number | Confidence 0-1 |

## Prioritization Matrix

| Urgency | Importance | Priority |
|---------|------------|----------|
| High | Critical | 1 |
| High | High | 2 |
| Medium | Critical | 2 |
| Medium | High | 3 |
| Low | High | 4 |
| Low | Medium | 5 |
| Low | Low | 6 |
