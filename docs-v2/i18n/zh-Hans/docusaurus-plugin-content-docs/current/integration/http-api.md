---
sidebar_position: 1
---

# HTTP API

通过 REST API 运行模块。

## 启动服务

```bash
npx cogn@2.2.12 serve --host 0.0.0.0 --port 8000
```

## 可选鉴权

设置 `COGNITIVE_API_KEY` 后，需在请求中提供：

```
Authorization: Bearer <your-api-key>
```

## 接口

### `GET /`

返回 API 信息与版本。

### `GET /health`

返回健康状态。

### `GET /modules`

列出模块。

### `GET /modules/:name`

模块详情。

### `POST /run`

**请求**

```json
{
  "module": "code-reviewer",
  "args": "def foo(): pass",
  "provider": "openai",
  "model": "gpt-4o"
}
```

**响应**

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

**错误响应**

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

## cURL 示例

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"module":"code-reviewer","args":"def foo(): pass"}'
```

## 备注

- 请求体大小限制：1MB
- Provider 选择规则与 CLI 相同
- `/run` 响应始终包含 `module` 和 `provider`（若无法解析则为 `"unknown"`）
