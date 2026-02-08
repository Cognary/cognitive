---
sidebar_position: 2
---

# code-reviewer

Review code and provide structured improvement suggestions.

## Basic Info

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Category | Code Quality |
| Format | New Format |

## Features

- Identify security vulnerabilities (SQL injection, XSS, etc.)
- Detect logic errors and boundary condition issues
- Evaluate code readability and maintainability
- Provide specific improvement suggestions

## Review Dimensions

1. **Correctness** - Logic errors, boundary conditions, exception handling
2. **Security** - Injection risks, sensitive data, permission issues
3. **Performance** - Time complexity, memory usage, N+1 problems
4. **Readability** - Naming, comments, structural clarity
5. **Maintainability** - Coupling, test-friendliness, extensibility

## Usage

```bash
npx cogn@2.2.11 run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty
```

## Output Example

```json
{
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "location": "line 1",
      "description": "SQL injection vulnerability",
      "suggestion": "Use parameterized queries"
    }
  ],
  "highlights": [
    "Clear function naming"
  ],
  "summary": "Code has critical security issues",
  "rationale": "Detected f-string directly concatenating...",
  "confidence": 0.95
}
```

## Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `issues` | array | List of detected issues |
| `issues[].severity` | string | critical/high/major/medium/minor/low/info |
| `issues[].category` | string | correctness/security/performance/readability/maintainability |
| `issues[].location` | string | Issue location |
| `issues[].description` | string | Issue description |
| `issues[].suggestion` | string | Improvement suggestion |
| `highlights` | array | Code strengths |
| `summary` | string | Overall assessment |
| `rationale` | string/object | Review reasoning |
| `confidence` | number | Confidence 0-1 |
