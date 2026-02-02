---
sidebar_position: 5
---

# api-designer

根据业务需求设计 RESTful API 端点规范。

## 基本信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 分类 | 设计规范 |
| 格式 | 新格式 |

## 功能

- 设计 RESTful API 端点
- 定义请求/响应格式
- 包含认证、分页、错误处理
- 提供请求示例

## 设计原则

1. **RESTful 规范** - 正确使用 HTTP 方法和状态码
2. **一致性** - 命名、格式统一
3. **版本控制** - API 版本策略
4. **错误处理** - 标准化错误响应
5. **分页与过滤** - 列表接口支持

## 使用

```bash
cog run api-designer --args "用户系统 CRUD API" --pretty
```

## 输出示例

```json
{
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/v1/users",
      "description": "创建新用户",
      "auth_required": true,
      "request": {
        "body": {
          "name": "string",
          "email": "string",
          "password": "string"
        }
      },
      "response": {
        "body": {
          "id": "string",
          "name": "string"
        }
      },
      "status_codes": [
        { "code": 201, "description": "创建成功" },
        { "code": 400, "description": "请求错误" }
      ]
    }
  ],
  "common": {
    "authentication": {
      "type": "Bearer Token"
    },
    "pagination": {
      "default_limit": 20,
      "max_limit": 100
    },
    "error_format": {
      "error": {
        "code": "string",
        "message": "string"
      }
    }
  },
  "examples": [...],
  "rationale": {...},
  "confidence": 0.91
}
```

## 输出字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `endpoints` | array | API 端点列表 |
| `endpoints[].method` | string | HTTP 方法 |
| `endpoints[].path` | string | 路径 |
| `endpoints[].description` | string | 描述 |
| `endpoints[].request` | object | 请求格式 |
| `endpoints[].response` | object | 响应格式 |
| `endpoints[].status_codes` | array | 状态码 |
| `common` | object | 通用定义 |
| `examples` | array | 请求示例 |
| `rationale` | object | 设计思路 |
| `confidence` | number | 置信度 0-1 |
