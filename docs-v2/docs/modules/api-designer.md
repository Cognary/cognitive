---
sidebar_position: 5
---

# api-designer

Design REST API specifications.

## Basic Info

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Category | Design Specs |
| Format | New Format |

## Features

- Generate RESTful endpoint designs
- Define request/response schemas
- Specify authentication requirements
- Include error handling patterns

## Usage

```bash
npx cogn@2.2.11 run api-designer --args "user management system with registration, login, profile CRUD" --pretty
```

## Output Example

```json
{
  "api_name": "User Management API",
  "base_path": "/api/v1",
  "endpoints": [
    {
      "method": "POST",
      "path": "/auth/register",
      "description": "Register new user",
      "request": {
        "body": {
          "email": "string (required)",
          "password": "string (required, min 8 chars)",
          "name": "string (optional)"
        }
      },
      "response": {
        "201": { "user_id": "string", "email": "string" },
        "400": { "error": "VALIDATION_ERROR", "message": "string" },
        "409": { "error": "EMAIL_EXISTS", "message": "string" }
      },
      "auth": "none"
    },
    {
      "method": "POST",
      "path": "/auth/login",
      "description": "User login",
      "request": {
        "body": {
          "email": "string",
          "password": "string"
        }
      },
      "response": {
        "200": { "access_token": "string", "refresh_token": "string" },
        "401": { "error": "INVALID_CREDENTIALS" }
      },
      "auth": "none"
    },
    {
      "method": "GET",
      "path": "/users/me",
      "description": "Get current user profile",
      "response": {
        "200": { "id": "string", "email": "string", "name": "string" }
      },
      "auth": "bearer"
    }
  ],
  "authentication": {
    "type": "JWT Bearer",
    "header": "Authorization: Bearer <token>"
  },
  "rationale": "Designed RESTful endpoints following best practices...",
  "confidence": 0.92
}
```

## Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `api_name` | string | API name |
| `base_path` | string | Base URL path |
| `endpoints` | array | Endpoint definitions |
| `endpoints[].method` | string | HTTP method |
| `endpoints[].path` | string | Endpoint path |
| `endpoints[].description` | string | Endpoint description |
| `endpoints[].request` | object | Request schema |
| `endpoints[].response` | object | Response schemas by status code |
| `endpoints[].auth` | string | Auth requirement |
| `authentication` | object | Auth configuration |
| `rationale` | string | Design reasoning |
| `confidence` | number | Confidence 0-1 |
