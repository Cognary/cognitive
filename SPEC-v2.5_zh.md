# Cognitive Modules Specification v2.5

> **可验证的结构化 AI 任务规范 — 流式与多模态增强版**

[English](SPEC-v2.5.md) | 中文

---

> **版本**: 2.5.0  
> **状态**: Draft  
> **最后更新**: 2026-02

## 0. 序言

### 0.0.1 关键词

本文档中的 "MUST"、"MUST NOT"、"REQUIRED"、"SHALL"、"SHALL NOT"、"SHOULD"、"SHOULD NOT"、"RECOMMENDED"、"MAY" 和 "OPTIONAL" 应按照 [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) 的定义来解释。

### 0.0.2 v2.5 新特性

| 特性 | 说明 |
|------|------|
| **流式响应** | 基于 chunk 的实时输出，提升用户体验 |
| **多模态支持** | 原生支持图像、音频、视频的输入/输出 |
| **向后兼容** | v2.2 模块无需修改即可运行 |

### 0.0.3 版本策略

- **主版本 (3.0)**：信封格式的破坏性变更，12 个月弃用通知期
- **次版本 (2.5)**：新功能，与 v2.2+ 向后兼容
- **补丁版本 (2.5.1)**：仅 Bug 修复和澄清

### 0.0.4 兼容性矩阵

| 规范版本 | 运行时支持 | 新特性 | 弃用日期 |
|----------|-----------|--------|----------|
| v2.5 | ✅ 当前版本 | 流式、多模态 | - |
| v2.2 | ✅ 支持 | 信封、分级 | - |
| v2.1 | ⚠️ 遗留版本 | 基础信封 | 2026-12-01 |
| v1.0 | ❌ 已弃用 | - | 2025-12-01 |

### 0.0.5 相关文档

| 文档 | 说明 |
|------|------|
| [CONFORMANCE.md](CONFORMANCE.md) | 合规等级（Level 1/2/3/4） |
| [ERROR-CODES.md](ERROR-CODES.md) | 标准错误码分类 |
| [STREAMING.md](STREAMING.md) | 流式协议详情 |
| [MULTIMODAL.md](MULTIMODAL.md) | 多模态格式参考 |

---

## 1. 设计哲学

### 核心原则

> **Cognitive 以对话便利性换取工程确定性。**

所有上下文 MUST 是显式的。模块输入 schema 中 NOT 允许隐式上下文（对话历史、隐藏状态）。

### v2.5 新增原则

1. **渐进式交付** — 结果生成时即刻流式输出
2. **富媒体支持** — 图像、音频、视频作为一等公民
3. **优雅降级** — 当流式/多模态不可用时自动回退

---

## 2. 模块结构

### 2.1 目录布局 (v2.5)

```
module-name/
├── module.yaml          # 机器可读清单（必需）
├── prompt.md            # 人类可读提示模板（必需）
├── schema.json          # 含媒体类型的 IO 契约（必需）
├── tests/               # 黄金测试（推荐）
│   ├── case1.input.json
│   └── case1.expected.json
└── assets/              # 多模态静态资源（可选）
    ├── example-input.png
    └── example-output.png
```

### 2.2 module.yaml (v2.5)

```yaml
# module.yaml - v2.5 格式
name: image-analyzer
version: 2.5.0
responsibility: 分析图像并提供结构化见解

# === 分级（与 v2.2 相同）===
tier: decision  # exec | decision | exploration

# === v2.5: 响应模式 ===
response:
  mode: streaming      # sync（默认）| streaming | both
  chunk_type: delta    # delta | snapshot
  buffer_size: 1024    # 刷新前的字节数（可选）

# === v2.5: 模态 ===
modalities:
  input:
    - text             # 始终支持
    - image            # JPEG、PNG、WebP、GIF
    - audio            # MP3、WAV、OGG（可选）
    - video            # MP4、WebM（可选）
  output:
    - text             # 始终支持
    - image            # 可生成图像

# === 现有 v2.2 字段 ===
schema_strictness: medium

excludes:
  - 修改原始媒体
  - 存储用户数据

overflow:
  enabled: true
  max_items: 10

enums:
  strategy: extensible

policies:
  tools_allowed: false
  network_allowed: false

compat:
  accepts_v22_payload: true
  runtime_auto_wrap: true
```

### 2.3 schema.json（v2.5 含媒体类型）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://cognitive-modules.dev/modules/image-analyzer/schema.json",
  
  "meta": {
    "type": "object",
    "required": ["confidence", "risk", "explain"],
    "properties": {
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "risk": {
        "type": "string",
        "enum": ["none", "low", "medium", "high"]
      },
      "explain": {
        "type": "string",
        "maxLength": 280
      }
    }
  },
  
  "input": {
    "type": "object",
    "required": ["images"],
    "properties": {
      "prompt": {
        "type": "string",
        "description": "分析指令"
      },
      "images": {
        "type": "array",
        "minItems": 1,
        "maxItems": 10,
        "items": {
          "$ref": "#/$defs/MediaInput"
        }
      }
    }
  },
  
  "data": {
    "type": "object",
    "required": ["rationale", "analysis"],
    "properties": {
      "rationale": {
        "type": "string"
      },
      "analysis": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "objects": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "label": { "type": "string" },
                "confidence": { "type": "number" },
                "bbox": {
                  "type": "array",
                  "items": { "type": "number" },
                  "minItems": 4,
                  "maxItems": 4
                }
              }
            }
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      },
      "generated_image": {
        "$ref": "#/$defs/MediaOutput"
      }
    }
  },
  
  "error": {
    "type": "object",
    "required": ["code", "message"],
    "properties": {
      "code": { "type": "string", "pattern": "^E[1-4][0-9]{3}$" },
      "message": { "type": "string" },
      "recoverable": { "type": "boolean" },
      "details": { "type": "object" }
    }
  },
  
  "$defs": {
    "MediaInput": {
      "type": "object",
      "required": ["type"],
      "oneOf": [
        {
          "properties": {
            "type": { "const": "url" },
            "url": { "type": "string", "format": "uri" },
            "media_type": { "type": "string" }
          },
          "required": ["type", "url"]
        },
        {
          "properties": {
            "type": { "const": "base64" },
            "media_type": { 
              "type": "string",
              "pattern": "^(image|audio|video)/[a-z0-9.+-]+$"
            },
            "data": { "type": "string", "contentEncoding": "base64" }
          },
          "required": ["type", "media_type", "data"]
        },
        {
          "properties": {
            "type": { "const": "file" },
            "path": { "type": "string" }
          },
          "required": ["type", "path"]
        }
      ]
    },
    
    "MediaOutput": {
      "type": "object",
      "required": ["type", "media_type"],
      "properties": {
        "type": { 
          "type": "string",
          "enum": ["url", "base64", "file"]
        },
        "media_type": { 
          "type": "string",
          "pattern": "^(image|audio|video)/[a-z0-9.+-]+$"
        },
        "url": { "type": "string", "format": "uri" },
        "data": { "type": "string", "contentEncoding": "base64" },
        "path": { "type": "string" },
        "width": { "type": "integer" },
        "height": { "type": "integer" },
        "duration_ms": { "type": "integer" }
      }
    }
  }
}
```

---

## 3. 响应信封 (v2.5)

### 3.1 同步响应（不变）

对于 `response.mode: sync`（默认），信封格式与 v2.2 相同：

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "图像分析成功完成"
  },
  "data": {
    "rationale": "图像显示山脉上的日落...",
    "analysis": {
      "description": "风景照片",
      "objects": [
        {"label": "山脉", "confidence": 0.95, "bbox": [10, 50, 400, 300]},
        {"label": "太阳", "confidence": 0.88, "bbox": [200, 20, 280, 100]}
      ],
      "tags": ["自然", "日落", "风景"]
    }
  }
}
```

### 3.2 流式响应（v2.5 新增）

对于 `response.mode: streaming`，响应以 chunk 序列的形式交付。

#### 3.2.1 Chunk 类型

| Chunk 类型 | 用途 | 必需字段 |
|------------|------|----------|
| `meta` | 初始元数据 | `streaming`、`meta` |
| `delta` | 增量内容 | `chunk.seq`、`chunk.delta` |
| `snapshot` | 完整状态替换 | `chunk.seq`、`chunk.data` |
| `progress` | 进度更新 | `progress.percent` |
| `final` | 完成信号 | `final`、`meta`、`data` |
| `error` | 流式错误 | `ok: false`、`error` |

#### 3.2.2 流式协议

**初始 Chunk（meta）**

```json
{
  "ok": true,
  "streaming": true,
  "session_id": "sess_abc123",
  "meta": {
    "confidence": null,
    "risk": "low",
    "explain": "开始分析..."
  }
}
```

**Delta Chunks**

```json
{
  "chunk": {
    "seq": 1,
    "type": "delta",
    "field": "data.rationale",
    "delta": "图像显示"
  }
}

{
  "chunk": {
    "seq": 2,
    "type": "delta",
    "field": "data.rationale",
    "delta": "一幅美丽的日落"
  }
}

{
  "chunk": {
    "seq": 3,
    "type": "delta",
    "field": "data.rationale",
    "delta": "在山峰之上..."
  }
}
```

**Progress Chunk（可选）**

```json
{
  "progress": {
    "percent": 45,
    "stage": "analyzing_objects",
    "message": "正在检测图像中的物体..."
  }
}
```

**Final Chunk**

```json
{
  "final": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "分析完成，检测到 3 个物体"
  },
  "data": {
    "rationale": "图像显示一幅美丽的日落在山峰之上...",
    "analysis": {
      "description": "风景照片",
      "objects": [
        {"label": "山脉", "confidence": 0.95},
        {"label": "太阳", "confidence": 0.88}
      ]
    }
  },
  "usage": {
    "input_tokens": 1250,
    "output_tokens": 340,
    "total_tokens": 1590
  }
}
```

**流式错误**

```json
{
  "ok": false,
  "streaming": true,
  "session_id": "sess_abc123",
  "error": {
    "code": "E2002",
    "message": "流中断：超时",
    "recoverable": true
  },
  "partial_data": {
    "rationale": "图像显示一幅美丽的日落..."
  }
}
```

#### 3.2.3 流式要求

| 要求 | 级别 | 说明 |
|------|------|------|
| Session ID | MUST | 流会话的唯一标识符 |
| 序列号 | MUST | 单调递增，从 1 开始 |
| Final Chunk | MUST | 流 MUST 以 `final: true` 或错误结束 |
| Meta Chunk | MUST | 首个 chunk MUST 包含 `streaming: true` |
| Chunk 排序 | SHOULD | 按序交付；客户端 MAY 按 seq 重排序 |
| 心跳 | MAY | 每 15 秒发送空 chunk 以防超时 |

#### 3.2.4 传输机制

| 传输方式 | 格式 | 使用场景 |
|----------|------|----------|
| **SSE** | `text/event-stream` | HTTP 流式（推荐） |
| **WebSocket** | JSON 帧 | 双向、低延迟 |
| **NDJSON** | `application/x-ndjson` | 简单的行分隔 JSON |

**SSE 示例：**

```
event: meta
data: {"ok":true,"streaming":true,"session_id":"sess_abc123","meta":{...}}

event: chunk
data: {"chunk":{"seq":1,"type":"delta","field":"data.rationale","delta":"图像"}}

event: chunk
data: {"chunk":{"seq":2,"type":"delta","field":"data.rationale","delta":"显示一个"}}

event: final
data: {"final":true,"meta":{...},"data":{...}}
```

#### 3.2.5 响应模式协商（`both` 模式）

当配置 `response.mode: both` 时，模块同时支持同步和流式响应。客户端通过请求协商所需模式。

##### 3.2.5.1 协商机制

**方式 1：HTTP Header（推荐）**

```http
POST /v1/modules/image-analyzer/execute HTTP/1.1
Accept: text/event-stream
X-Cognitive-Response-Mode: streaming
```

| Header | 值 | 行为 |
|--------|------|----------|
| `Accept: application/json` | （默认） | 同步响应 |
| `Accept: text/event-stream` | 流式 | SSE 流式响应 |
| `X-Cognitive-Response-Mode` | `sync` / `streaming` | 显式模式覆盖 |

**方式 2：查询参数**

```
POST /v1/modules/image-analyzer/execute?response_mode=streaming
```

**方式 3：请求体字段**

```json
{
  "input": { ... },
  "_options": {
    "response_mode": "streaming",
    "chunk_type": "delta"
  }
}
```

##### 3.2.5.2 协商优先级

当存在多个信号时，运行时 MUST 按此优先级处理：

1. `X-Cognitive-Response-Mode` header（最高）
2. 请求体中的 `_options.response_mode`
3. `response_mode` 查询参数
4. `Accept` header 推断
5. 模块默认的 `response.mode`（最低）

##### 3.2.5.3 能力不匹配处理

| 模块模式 | 客户端请求 | Provider 支持 | 运行时行为 |
|----------|------------|---------------|------------|
| `both` | streaming | ✅ 是 | 流式响应 |
| `both` | streaming | ❌ 否 | 同步响应 + 警告 header |
| `both` | sync | 任意 | 同步响应 |
| `streaming` | sync | 任意 | E4010 错误或强制同步并警告 |
| `sync` | streaming | 任意 | 同步响应 + 警告 header |

**警告响应 Header：**

```http
X-Cognitive-Warning: STREAMING_UNAVAILABLE; fallback=sync; reason=provider_limitation
```

**响应体中的警告（同步回退时）：**

```json
{
  "ok": true,
  "meta": { ... },
  "data": { ... },
  "_warnings": [
    {
      "code": "W4010",
      "message": "请求流式但不可用，返回同步响应",
      "fallback_used": "sync"
    }
  ]
}
```

#### 3.2.6 错误恢复协议

当流在中途失败时，客户端 MAY 使用以下协议尝试恢复。

##### 3.2.6.1 恢复检查点

每个 chunk 包含恢复信息：

```json
{
  "chunk": {
    "seq": 15,
    "type": "delta",
    "field": "data.rationale",
    "delta": "分析构图...",
    "checkpoint": {
      "offset": 342,
      "hash": "a3f2b1"
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `checkpoint.offset` | 目标字段中的字节偏移量 |
| `checkpoint.hash` | 已累积内容的短哈希（SHA256 前 6 个字符） |

##### 3.2.6.2 带恢复信息的错误 Chunk

```json
{
  "ok": false,
  "streaming": true,
  "session_id": "sess_abc123",
  "error": {
    "code": "E2010",
    "message": "流中断：连接超时",
    "recoverable": true,
    "recovery": {
      "last_seq": 15,
      "last_checkpoint": {
        "offset": 342,
        "hash": "a3f2b1"
      },
      "retry_after_ms": 1000,
      "max_retries": 3
    }
  },
  "partial_data": {
    "rationale": "图像显示美丽的日落，温暖的橙色..."
  }
}
```

##### 3.2.6.3 重试请求

客户端 MAY 带恢复上下文重试：

```http
POST /v1/modules/image-analyzer/execute HTTP/1.1
X-Cognitive-Recovery-Session: sess_abc123
X-Cognitive-Recovery-Seq: 15
```

或在请求体中：

```json
{
  "input": { ... },
  "_recovery": {
    "session_id": "sess_abc123",
    "last_seq": 15,
    "last_checkpoint": {
      "offset": 342,
      "hash": "a3f2b1"
    }
  }
}
```

##### 3.2.6.4 服务器恢复行为

| 场景 | 服务器行为 |
|------|------------|
| 会话存在，检查点有效 | 从 `last_seq + 1` 恢复 |
| 会话存在，检查点不匹配 | 以 `seq: 1` 重新开始流，包含 `_warnings` |
| 会话过期/不存在 | 以新 `session_id` 重新开始流 |
| 不支持恢复 | 返回 E4012 错误 |

**恢复后的流示例：**

```json
// 恢复后的首个 chunk
{
  "ok": true,
  "streaming": true,
  "session_id": "sess_abc123",
  "resumed": true,
  "resume_from_seq": 16,
  "meta": {
    "confidence": null,
    "risk": "low",
    "explain": "恢复分析中..."
  }
}
```

##### 3.2.6.5 客户端恢复策略

```
1. 收到 recoverable=true 的错误时：
   a. 等待 retry_after_ms（或指数退避）
   b. 检查重试次数 < max_retries
   c. 发送带恢复上下文的重试请求
   d. 验证首个恢复 chunk 的 seq 符合预期
   e. 如果哈希不匹配，丢弃 partial_data 并接受新流

2. 收到 recoverable=false 的错误时：
   a. 向用户展示错误
   b. 可选择使用全新请求重试（无恢复上下文）
```

---

## 4. 多模态规范（v2.5 新增）

### 4.1 支持的媒体类型

#### 4.1.1 输入媒体类型

| 类别 | MIME 类型 | 最大大小 | 备注 |
|------|-----------|----------|------|
| **图像** | `image/jpeg`、`image/png`、`image/webp`、`image/gif` | 20MB | GIF：仅首帧 |
| **音频** | `audio/mpeg`、`audio/wav`、`audio/ogg`、`audio/webm` | 25MB | 最长 10 分钟 |
| **视频** | `video/mp4`、`video/webm`、`video/quicktime` | 100MB | 最长 5 分钟 |
| **文档** | `application/pdf` | 50MB | 文本提取 |

#### 4.1.2 输出媒体类型

| 类别 | MIME 类型 | 生成方法 |
|------|-----------|----------|
| **图像** | `image/png`、`image/jpeg`、`image/webp` | DALL-E、Stable Diffusion 等 |
| **音频** | `audio/mpeg`、`audio/wav` | TTS、音乐生成 |
| **视频** | `video/mp4` | 视频生成（新兴） |

#### 4.1.3 大小限制与约束

| 类别 | 最大大小 | 最大尺寸 | 最长时长 | 备注 |
|------|----------|----------|----------|------|
| **图像** | 20MB | 8192×8192 像素 | - | 更大图像 SHOULD 被缩小 |
| **音频** | 25MB | - | 10 分钟 | 更长音频 SHOULD 被分块 |
| **视频** | 100MB | 4K (3840×2160) | 5 分钟 | 长视频进行帧采样 |
| **文档** | 50MB | - | - | 最多 500 页 |

### 4.2 大文件处理

对于超过内联大小限制的文件，Cognitive Modules 支持多种上传策略。

#### 4.2.1 上传策略选择

| 文件大小 | 推荐策略 | 原因 |
|----------|----------|------|
| < 5MB | Base64 内联 | 简单，无需额外基础设施 |
| 5MB - 20MB | URL 引用 | 避免大 JSON 有效载荷 |
| > 20MB | 预上传后引用 | 大型媒体必需 |

#### 4.2.2 预上传协议

对于大文件，客户端 SHOULD 使用预上传：

**步骤 1：请求上传 URL**

```http
POST /v1/media/upload-url HTTP/1.1
Content-Type: application/json

{
  "filename": "large-video.mp4",
  "media_type": "video/mp4",
  "size_bytes": 52428800,
  "checksum": {
    "algorithm": "sha256",
    "value": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

**响应：**

```json
{
  "upload_id": "upl_abc123",
  "upload_url": "https://storage.example.com/upload/upl_abc123",
  "method": "PUT",
  "headers": {
    "Content-Type": "video/mp4",
    "x-amz-checksum-sha256": "..."
  },
  "expires_at": "2026-02-04T13:00:00Z",
  "max_size_bytes": 104857600
}
```

**步骤 2：上传文件**

```http
PUT https://storage.example.com/upload/upl_abc123 HTTP/1.1
Content-Type: video/mp4
Content-Length: 52428800

<二进制数据>
```

**步骤 3：在请求中引用**

```json
{
  "input": {
    "video": {
      "type": "upload_ref",
      "upload_id": "upl_abc123",
      "media_type": "video/mp4"
    }
  }
}
```

#### 4.2.3 分块上传（文件 > 50MB）

对于超大文件，使用多部分分块上传：

```http
POST /v1/media/upload-multipart/init HTTP/1.1

{
  "filename": "large-video.mp4",
  "media_type": "video/mp4",
  "size_bytes": 157286400,
  "chunk_size_bytes": 10485760
}
```

**响应：**

```json
{
  "upload_id": "upl_xyz789",
  "chunk_count": 15,
  "chunk_urls": [
    {"part": 1, "url": "https://storage.example.com/upload/upl_xyz789/1"},
    {"part": 2, "url": "https://storage.example.com/upload/upl_xyz789/2"}
  ],
  "complete_url": "https://storage.example.com/upload/upl_xyz789/complete"
}
```

**完成多部分上传：**

```http
POST https://storage.example.com/upload/upl_xyz789/complete HTTP/1.1

{
  "parts": [
    {"part": 1, "etag": "abc123"},
    {"part": 2, "etag": "def456"}
  ]
}
```

#### 4.2.4 流式上传（替代方案）

对于实时媒体捕获，运行时 MAY 支持流式上传：

```http
POST /v1/media/stream HTTP/1.1
Content-Type: audio/webm
Transfer-Encoding: chunked
X-Cognitive-Stream-Id: stream_123

<分块二进制数据>
```

### 4.3 媒体输入格式

#### 4.3.1 URL 引用

```json
{
  "type": "url",
  "url": "https://example.com/image.jpg",
  "media_type": "image/jpeg"
}
```

**要求：**
- URL MUST 是公开可访问的或包含认证令牌
- `media_type` 是 OPTIONAL 的；运行时 MAY 从 Content-Type 推断
- 运行时 SHOULD 缓存获取的媒体以便重试

#### 4.3.2 Base64 内联

```json
{
  "type": "base64",
  "media_type": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."
}
```

**要求：**
- `media_type` 是 REQUIRED 的
- `data` MUST 是有效的 base64 编码
- 运行时 SHOULD 在 LLM 调用前验证媒体

#### 4.3.3 文件路径（本地）

```json
{
  "type": "file",
  "path": "/path/to/image.jpg"
}
```

**要求：**
- 路径 MUST 是绝对路径或相对于模块目录的路径
- 运行时 MUST 检查文件存在且可读
- `media_type` 从扩展名推断

#### 4.3.4 上传引用（预上传文件）

```json
{
  "type": "upload_ref",
  "upload_id": "upl_abc123",
  "media_type": "video/mp4"
}
```

**要求：**
- `upload_id` MUST 引用已完成的上传
- 上传 MUST 未过期
- 运行时 MUST 验证上传所有权

### 4.4 媒体输出格式

#### 4.4.1 生成的图像

```json
{
  "type": "base64",
  "media_type": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 1024,
  "height": 1024,
  "generation_params": {
    "model": "dall-e-3",
    "quality": "hd",
    "style": "natural"
  }
}
```

#### 4.4.2 URL 引用（临时）

```json
{
  "type": "url",
  "media_type": "image/png",
  "url": "https://cdn.example.com/generated/abc123.png",
  "expires_at": "2026-02-04T12:00:00Z",
  "width": 1024,
  "height": 1024
}
```

### 4.5 媒体内容验证

运行时 MUST 在处理前验证媒体内容。本节定义验证要求。

#### 4.5.1 验证级别

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| **结构** | 仅验证 JSON 结构 | 始终（MUST） |
| **格式** | 验证媒体格式/魔数 | 始终（MUST） |
| **内容** | 验证尺寸、时长等 | 推荐（SHOULD） |
| **深度** | 内容安全、损坏检查 | 可选（MAY） |

#### 4.5.2 魔数验证

运行时 MUST 验证媒体内容与声明的 MIME 类型匹配：

| 媒体类型 | 魔数（十六进制） | 说明 |
|----------|------------------|------|
| `image/jpeg` | `FF D8 FF` | JPEG/JFIF 图像 |
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` | PNG 图像 |
| `image/gif` | `47 49 46 38` | GIF 图像 |
| `image/webp` | `52 49 46 46 ... 57 45 42 50` | WebP 图像 |
| `audio/mpeg` | `FF FB` 或 `FF FA` 或 `49 44 33` | MP3 音频 |
| `audio/wav` | `52 49 46 46 ... 57 41 56 45` | WAV 音频 |
| `audio/ogg` | `4F 67 67 53` | OGG 音频 |
| `video/mp4` | `00 00 00 ... 66 74 79 70` | MP4 视频 |
| `video/webm` | `1A 45 DF A3` | WebM 视频 |
| `application/pdf` | `25 50 44 46` | PDF 文档 |

**验证错误：**

```json
{
  "ok": false,
  "error": {
    "code": "E1014",
    "message": "媒体内容与声明类型不匹配",
    "details": {
      "declared_type": "image/png",
      "detected_type": "image/jpeg",
      "magic_bytes": "ffd8ff"
    }
  }
}
```

#### 4.5.3 尺寸验证

对于图像，运行时 SHOULD 验证尺寸：

```json
{
  "validation": {
    "width": 1920,
    "height": 1080,
    "aspect_ratio": "16:9",
    "color_space": "sRGB",
    "bit_depth": 8,
    "has_alpha": false
  }
}
```

**尺寸约束：**

| 约束 | 验证 | 错误码 |
|------|------|--------|
| 最大宽/高 | width ≤ 8192 且 height ≤ 8192 | E1015 |
| 最小宽/高 | width ≥ 10 且 height ≥ 10 | E1016 |
| 最大像素数 | width × height ≤ 67,108,864 | E1017 |

#### 4.5.4 时长验证

对于音频/视频，运行时 SHOULD 验证时长：

```json
{
  "validation": {
    "duration_ms": 180000,
    "sample_rate": 44100,
    "channels": 2,
    "codec": "aac"
  }
}
```

#### 4.5.5 校验和验证

客户端 MAY 包含校验和以进行完整性验证：

```json
{
  "type": "base64",
  "media_type": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "checksum": {
    "algorithm": "sha256",
    "value": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```

**支持的算法：**

| 算法 | 输出长度 | 使用场景 |
|------|----------|----------|
| `sha256` | 64 十六进制字符 | 推荐用于所有场景 |
| `md5` | 32 十六进制字符 | 仅遗留支持 |
| `crc32` | 8 十六进制字符 | 快速验证 |

#### 4.5.6 验证响应

运行时 SHOULD 在响应中包含验证结果：

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "图像分析成功",
    "media_validation": {
      "input_count": 2,
      "validated": [
        {
          "index": 0,
          "media_type": "image/jpeg",
          "size_bytes": 245000,
          "dimensions": {"width": 1920, "height": 1080},
          "valid": true
        },
        {
          "index": 1,
          "media_type": "image/png",
          "size_bytes": 128000,
          "dimensions": {"width": 800, "height": 600},
          "valid": true
        }
      ]
    }
  },
  "data": { ... }
}
```

### 4.6 Prompt 中的多模态

在 `prompt.md` 中，使用占位符引用媒体输入：

```markdown
# 图像分析任务

分析以下图像：

$MEDIA_INPUTS

## 指令
1. 详细描述你所看到的
2. 识别所有物体及其边界框
3. 分配相关标签

## 输出格式
按 schema 定义的格式返回分析结果。
```

**运行时行为：**
- `$MEDIA_INPUTS` 被替换为媒体表示
- 对于图像：根据模型支持使用内联或 URL
- 运行时处理不同 LLM API 的格式转换

### 4.5 多模态信封示例

**输入：**

```json
{
  "prompt": "描述这张图片并识别其中的文字",
  "images": [
    {
      "type": "url",
      "url": "https://example.com/receipt.jpg"
    }
  ]
}
```

**输出（流式 Final）：**

```json
{
  "final": true,
  "meta": {
    "confidence": 0.88,
    "risk": "none",
    "explain": "收据已分析，提取了 5 个项目"
  },
  "data": {
    "rationale": "图像显示一张零售收据，列有逐项购买...",
    "analysis": {
      "description": "来自超市的零售收据",
      "extracted_text": "超市\n123 主街\n...",
      "items": [
        {"name": "牛奶", "price": 3.99},
        {"name": "面包", "price": 2.49}
      ],
      "total": 15.47
    }
  }
}
```

---

## 5. 分级（与 v2.2 相同）

### 5.1 分级定义

| 分级 | 用途 | 置信度 | 风险 | Schema 严格度 |
|------|------|--------|------|---------------|
| **exec** | 自动执行 | ≥0.9 必需 | 必须是 `none` 或 `low` | high |
| **decision** | 人工辅助判断 | 0.5-0.9 典型 | 任意 | medium |
| **exploration** | 研究/灵感 | 任意 | 任意 | low |

### 5.2 分级默认值

```yaml
# 基于分级的默认值（如果未显式设置）
exec:
  schema_strictness: high
  overflow.enabled: false
  enums.strategy: strict
  response.mode: sync      # Exec 通常同步

decision:
  schema_strictness: medium
  overflow.enabled: true
  overflow.max_items: 5
  enums.strategy: extensible
  response.mode: both      # 同时支持同步和流式

exploration:
  schema_strictness: low
  overflow.enabled: true
  overflow.max_items: 20
  enums.strategy: extensible
  response.mode: streaming  # 探索从流式中受益
```

---

## 6. Meta 字段规范

### 6.1 必需字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `confidence` | number | [0.0, 1.0] | 模型的自评估确定性 |
| `risk` | string/object | enum 或可扩展 | 评估的风险级别 |
| `explain` | string | maxLength: 280 | 人类可读的摘要 |

### 6.2 可选字段（v2.5）

| 字段 | 类型 | 说明 |
|------|------|------|
| `processing_time_ms` | integer | 生成响应所用时间 |
| `model` | string | 使用的模型（如 "gpt-4-vision"） |
| `media_processed` | array | 已处理的媒体项列表 |

### 6.3 流式特定的 Meta

在流式过程中，meta 字段 MAY 被更新：

```json
// 初始
{ "confidence": null, "risk": "low", "explain": "处理中..." }

// 最终
{ "confidence": 0.92, "risk": "low", "explain": "分析完成" }
```

### 6.4 多模态 Confidence 语义

`confidence` 的含义因任务类型而异。本节定义不同多模态场景的语义。

#### 6.4.1 按任务类型的 Confidence

| 任务类型 | Confidence 含义 | 示例 |
|----------|-----------------|------|
| **文本分析** | 正确性的确定性 | 情感分类：0.95 |
| **图像分析** | 检测/分类的确定性 | 物体检测：0.88 |
| **图像生成** | Prompt 匹配度分数 | 生成图像与 prompt 匹配：0.82 |
| **音频转录** | 转录准确度 | 语音转文字置信度：0.91 |
| **音频生成** | 质量/自然度分数 | TTS 质量：0.85 |
| **视频分析** | 整体分析确定性 | 视频理解：0.78 |

#### 6.4.2 图像生成 Confidence

对于图像生成任务，`confidence` 表示模型对生成图像与 prompt 匹配程度的评估：

```json
{
  "meta": {
    "confidence": 0.82,
    "risk": "low",
    "explain": "生成的图像与 prompt 高度匹配，有轻微艺术演绎",
    "generation_quality": {
      "prompt_adherence": 0.85,
      "aesthetic_score": 0.79,
      "technical_quality": 0.88
    }
  },
  "data": {
    "generated_image": {
      "type": "base64",
      "media_type": "image/png",
      "data": "..."
    }
  }
}
```

**Confidence 细分（可选）：**

| 子分数 | 说明 | 范围 |
|--------|------|------|
| `prompt_adherence` | 图像与文本 prompt 的匹配程度 | [0.0, 1.0] |
| `aesthetic_score` | 视觉美感和构图 | [0.0, 1.0] |
| `technical_quality` | 分辨率、伪影、一致性 | [0.0, 1.0] |

#### 6.4.3 多物体检测 Confidence

检测多个物体时，总体 `confidence` 通常是各个检测的平均值或最小值：

```json
{
  "meta": {
    "confidence": 0.87,
    "confidence_aggregation": "mean",
    "risk": "low",
    "explain": "检测到 3 个物体，置信度高"
  },
  "data": {
    "objects": [
      {"label": "汽车", "confidence": 0.95, "bbox": [10, 20, 100, 80]},
      {"label": "行人", "confidence": 0.88, "bbox": [120, 30, 160, 180]},
      {"label": "狗", "confidence": 0.78, "bbox": [200, 100, 250, 150]}
    ]
  }
}
```

**聚合方法：**

| 方法 | 计算 | 使用场景 |
|------|------|----------|
| `mean` | 所有 confidence 的平均值 | 通用检测 |
| `min` | 最小 confidence | 保守估计 |
| `weighted_mean` | 按物体面积/重要性加权 | 主要物体聚焦 |

#### 6.4.4 音频/视频 Confidence

对于时序媒体，confidence 可能随时间变化：

```json
{
  "meta": {
    "confidence": 0.89,
    "risk": "low",
    "explain": "转录完成，准确度高",
    "temporal_confidence": {
      "overall": 0.89,
      "segments": [
        {"start_ms": 0, "end_ms": 5000, "confidence": 0.95},
        {"start_ms": 5000, "end_ms": 10000, "confidence": 0.82},
        {"start_ms": 10000, "end_ms": 15000, "confidence": 0.91}
      ],
      "low_confidence_regions": [
        {"start_ms": 5000, "end_ms": 7000, "reason": "background_noise"}
      ]
    }
  }
}
```

#### 6.4.5 按分级的 Confidence 阈值

| 分级 | 最小 Confidence | 低于阈值时的操作 |
|------|-----------------|------------------|
| `exec` | 0.9 | MUST 失败并返回 E3001 |
| `decision` | 0.5 | SHOULD 包含警告 |
| `exploration` | 无 | 仅供参考 |

---

## 7. 错误码（v2.5 新增）

### 7.1 新错误码

| 错误码 | 名称 | 说明 |
|--------|------|------|
| **E1010** | UNSUPPORTED_MEDIA_TYPE | 模块不支持该媒体类型 |
| **E1011** | MEDIA_TOO_LARGE | 媒体超出大小限制 |
| **E1012** | MEDIA_FETCH_FAILED | 无法从 URL 获取媒体 |
| **E1013** | MEDIA_DECODE_FAILED | 无法解码 base64 媒体 |
| **E2010** | STREAM_INTERRUPTED | 流被中断 |
| **E2011** | STREAM_TIMEOUT | 流超时 |
| **E4010** | STREAMING_NOT_SUPPORTED | 运行时不支持流式 |
| **E4011** | MULTIMODAL_NOT_SUPPORTED | 运行时不支持多模态 |

### 7.2 完整错误码表

| 范围 | 类别 | v2.5 新增 |
|------|------|-----------|
| E1xxx | 输入错误 | E1010-E1013（媒体） |
| E2xxx | 处理错误 | E2010-E2011（流式） |
| E3xxx | 输出错误 | （无） |
| E4xxx | 运行时错误 | E4010-E4011（能力） |

---

## 8. 运行时行为

### 8.1 能力声明

运行时 MUST 声明其能力：

```json
{
  "runtime": "cognitive-runtime-python",
  "version": "2.5.0",
  "capabilities": {
    "streaming": true,
    "multimodal": {
      "input": ["image", "audio"],
      "output": ["image"]
    },
    "max_media_size_mb": 20,
    "supported_transports": ["sse", "websocket", "ndjson"]
  }
}
```

### 8.2 优雅降级

当请求的能力不可用时：

| 场景 | 运行时行为 |
|------|-----------|
| 请求流式，不支持 | 返回同步响应并带警告 |
| 多模态输入，不支持 | 返回 E4011 错误 |
| 媒体过大 | 返回 E1011 错误 |

### 8.3 修复传递（v2.5 扩展）

修复传递现在处理媒体：

1. **媒体验证** — 验证媒体有效且在限制内
2. **媒体标准化** — 转换为运行时首选格式
3. **流式组装** — 将 chunks 组装成最终信封

---

## 9. 合规等级（v2.5）

### Level 1: 基础（不变）
- 同步信封验证
- 纯文本输入/输出

### Level 2: 标准（不变）
- 完整分级支持
- 错误码 E1xxx-E3xxx

### Level 3: 完整（v2.2 特性）
- 组合支持
- 上下文协议

### Level 4: 扩展（v2.5 新增）
- 流式支持
- 多模态输入
- 多模态输出（可选）

---

## 10. 迁移指南

### 10.1 从 v2.2 到 v2.5

**现有模块无需修改。**

添加流式：
```yaml
# 添加到 module.yaml
response:
  mode: streaming
```

添加多模态：
```yaml
# 添加到 module.yaml
modalities:
  input: [text, image]
  output: [text]
```

### 10.2 运行时更新

```python
# Python 运行时
from cognitive import CognitiveRuntime

runtime = CognitiveRuntime(
    streaming=True,
    multimodal=True
)

# 流式执行
async for chunk in runtime.execute_stream(module, input):
    print(chunk)

# 同步执行（不变）
result = runtime.execute(module, input)
```

---

## 11. 安全考虑

### 11.1 媒体安全

- **URL 验证** — 获取前验证 URL；阻止私有 IP
- **大小限制** — 处理前强制执行最大大小
- **内容验证** — 验证媒体与声明的类型匹配
- **清理** — 如已配置，剥离 EXIF/元数据

### 11.2 流式安全

- **会话令牌** — 使用唯一会话 ID 进行流关联
- **超时强制** — 终止超过最大持续时间的流
- **速率限制** — 限制每个客户端的并发流数

---

## 12. 示例

### 12.1 图像分析模块

参见 `cognitive/modules/image-analyzer/` 获取完整示例。

### 12.2 音频转录模块

```yaml
# module.yaml
name: audio-transcriber
version: 2.5.0
responsibility: 将音频转录为带时间戳的文本
tier: exec

response:
  mode: streaming
  chunk_type: delta

modalities:
  input: [audio]
  output: [text]
```

### 12.3 图像生成模块

```yaml
# module.yaml
name: image-generator
version: 2.5.0
responsibility: 根据文本描述生成图像
tier: decision

modalities:
  input: [text]
  output: [text, image]
```

---

## 13. 规范性引用

- [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) - 关键词
- [JSON Schema Draft-07](https://json-schema.org/specification-links.html#draft-7)
- [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259) - JSON
- [RFC 2046](https://datatracker.ietf.org/doc/html/rfc2046) - MIME 类型
- [SSE 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.5.0 | 2026-02 | 新增：流式响应、多模态支持、Level 4 合规 |
| v2.2.1 | 2026-02 | 新增：版本控制、兼容性矩阵、测试向量 |
| v2.2.0 | 2025-08 | 初始 v2.2，含信封、分级、溢出 |
