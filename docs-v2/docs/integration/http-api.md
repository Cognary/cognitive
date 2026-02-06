---
sidebar_position: 1
---

# HTTP API

Run Cognitive Modules via a simple REST API.

## Start Server

```bash
cog serve --host 0.0.0.0 --port 8000
```

## Authentication (Optional)

If `COGNITIVE_API_KEY` is set, requests must include:

```
Authorization: Bearer <your-api-key>
```

## Endpoints

### `GET /`

Returns API info and version.

### `GET /health`

Returns health info and provider availability.

### `GET /modules`

List available modules.

### `GET /modules/:name`

Module metadata.

### `POST /run`

Run a module.

**Request**

```json
{
  "module": "code-reviewer",
  "args": "def foo(): pass",
  "provider": "openai",
  "model": "gpt-4o"
}
```

**Response**

```json
{
  "ok": true,
  "version": "2.2",
  "module": "code-reviewer",
  "provider": "openai",
  "meta": { "confidence": 0.92, "risk": "low", "explain": "..." },
  "data": { "...": "..." }
}
```

**Error Response**

```json
{
  "ok": false,
  "version": "2.2",
  "module": "code-reviewer",
  "provider": "openai",
  "meta": { "confidence": 0.0, "risk": "high", "explain": "Module 'code-reviewer' not found" },
  "error": { "code": "E4006", "message": "Module 'code-reviewer' not found" }
}
```

## cURL Example

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "module": "code-reviewer",
    "args": "def foo(): pass"
  }'
```

### `POST /run/stream` (SSE)

Run a module and stream `cep.events.v2.2` events over SSE.

- Response `Content-Type`: `text/event-stream`
- Each SSE message uses:
  - `event:` = `type`
  - `data:` = JSON-serialized CEP event object

Terminal `event: end` MUST contain `result` which conforms to the v2.2 response envelope.

**cURL example**

```bash
curl -N -X POST http://localhost:8000/run/stream \
  -H "Content-Type: application/json" \
  -d '{
    "module": "code-reviewer",
    "args": "def foo(): pass"
  }'
```

## Notes

- Payload limit: 1MB
- Provider selection follows the same rules as CLI (`--provider`/API keys)
- `/run` responses always include `module` and `provider` (may be `"unknown"` if not resolved)
- CLI streaming uses NDJSON (`cog run --stream`) with the same event objects, one JSON per line
