---
sidebar_position: 1
---

# HTTP API

REST API for running Cognitive Modules.

## Starting the Server

```bash
# Basic
cog serve

# With options
cog serve --port 8000 --host 0.0.0.0 --cors
```

## Endpoints

### Run Module

```
POST /api/run/:module
```

Request:
```json
{
  "code": "def foo(): pass",
  "language": "python"
}
```

Response (v2.2):
```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "low",
    "explain": "Code review complete, 1 issue found"
  },
  "data": {
    "issues": [...],
    "rationale": "..."
  }
}
```

### List Modules

```
GET /api/modules
```

Response:
```json
{
  "modules": [
    {
      "name": "code-reviewer",
      "version": "1.0.0",
      "description": "Review code and provide suggestions"
    }
  ]
}
```

### Module Info

```
GET /api/modules/:name
```

Response:
```json
{
  "name": "code-reviewer",
  "version": "1.0.0",
  "responsibility": "Review code...",
  "schema": {
    "input": {...},
    "output": {...}
  }
}
```

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.3.0",
  "modules_count": 5
}
```

## cURL Examples

### Run Code Review

```bash
curl -X POST http://localhost:8000/api/run/code-reviewer \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def login(u,p): return db.query(f\"SELECT * FROM users WHERE name={u}\")"
  }'
```

### With Arguments

```bash
curl -X POST http://localhost:8000/api/run/code-reviewer \
  -H "Content-Type: application/json" \
  -d '{
    "$ARGUMENTS": "def foo(): pass"
  }'
```

## SDK Examples

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:8000/api/run/code-reviewer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: '...' })
});

const result = await response.json();
console.log(result.data.issues);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:8000/api/run/code-reviewer',
    json={'code': 'def foo(): pass'}
)

result = response.json()
print(result['data']['issues'])
```

## Error Responses

### Validation Error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed: 'code' is required"
  }
}
```

### Module Not Found

```json
{
  "ok": false,
  "error": {
    "code": "MODULE_NOT_FOUND",
    "message": "Module 'unknown-module' not found"
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8000 |
| `HOST` | Server host | 127.0.0.1 |
| `CORS_ORIGINS` | Allowed origins | * |
| `LLM_PROVIDER` | LLM backend | openai |
