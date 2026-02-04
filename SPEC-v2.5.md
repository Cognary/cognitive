# Cognitive Modules Specification v2.5

> **Version**: 2.5.0  
> **Status**: Draft  
> **Last Updated**: 2026-02

## 0. Preamble

### 0.0.1 Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

### 0.0.2 What's New in v2.5

| Feature | Description |
|---------|-------------|
| **Streaming Response** | Real-time chunk-based output for better UX |
| **Multimodal Support** | Native image, audio, and video input/output |
| **Backward Compatible** | v2.2 modules run without modification |

### 0.0.3 Versioning Policy

- **Major (3.0)**: Breaking changes to envelope format, 12-month deprecation notice
- **Minor (2.5)**: New features, backward compatible with v2.2+
- **Patch (2.5.1)**: Bug fixes and clarifications only

### 0.0.4 Compatibility Matrix

| Spec Version | Runtime Support | New Features | Deprecation |
|--------------|-----------------|--------------|-------------|
| v2.5 | ✅ Current | Streaming, Multimodal | - |
| v2.2 | ✅ Supported | Envelope, Tiers | - |
| v2.1 | ⚠️ Legacy | Basic envelope | 2026-12-01 |
| v1.0 | ❌ Deprecated | - | 2025-12-01 |

### 0.0.5 Related Documents

| Document | Description |
|----------|-------------|
| [CONFORMANCE.md](CONFORMANCE.md) | Conformance levels (Level 1/2/3/4) |
| [ERROR-CODES.md](ERROR-CODES.md) | Standard error taxonomy |
| [STREAMING.md](STREAMING.md) | Streaming protocol details |
| [MULTIMODAL.md](MULTIMODAL.md) | Multimodal format reference |

---

## 1. Design Philosophy

### Core Principle

> **Cognitive trades conversational convenience for engineering certainty.**

All context MUST be explicit. Implicit context (conversation history, hidden state) is NOT permitted in the module input schema.

### v2.5 Additions

1. **Progressive Delivery** — Stream results as they're generated
2. **Rich Media** — First-class support for images, audio, video
3. **Graceful Degradation** — Fallback when streaming/multimodal unavailable

---

## 2. Module Structure

### 2.1 Directory Layout (v2.5)

```
module-name/
├── module.yaml          # Machine-readable manifest (REQUIRED)
├── prompt.md            # Human-readable prompt template (REQUIRED)
├── schema.json          # IO contract with media types (REQUIRED)
├── tests/               # Golden tests (RECOMMENDED)
│   ├── case1.input.json
│   └── case1.expected.json
└── assets/              # Static assets for multimodal (OPTIONAL)
    ├── example-input.png
    └── example-output.png
```

### 2.2 module.yaml (v2.5)

```yaml
# module.yaml - v2.5 format
name: image-analyzer
version: 2.5.0
responsibility: Analyze images and provide structured insights

# === Tier (unchanged from v2.2) ===
tier: decision  # exec | decision | exploration

# === v2.5: Response Mode ===
response:
  mode: streaming      # sync (default) | streaming | both
  chunk_type: delta    # delta | snapshot
  buffer_size: 1024    # bytes before flush (optional)

# === v2.5: Modalities ===
modalities:
  input:
    - text             # Always supported
    - image            # JPEG, PNG, WebP, GIF
    - audio            # MP3, WAV, OGG (optional)
    - video            # MP4, WebM (optional)
  output:
    - text             # Always supported
    - image            # Can generate images

# === Existing v2.2 fields ===
schema_strictness: medium

excludes:
  - modifying original media
  - storing user data

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

### 2.3 schema.json (v2.5 with Media Types)

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
        "description": "Analysis instruction"
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

## 3. Response Envelope (v2.5)

### 3.1 Synchronous Response (unchanged)

For `response.mode: sync` (default), the envelope format is identical to v2.2:

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Image analysis completed successfully"
  },
  "data": {
    "rationale": "The image shows a sunset over mountains...",
    "analysis": {
      "description": "Landscape photograph",
      "objects": [
        {"label": "mountain", "confidence": 0.95, "bbox": [10, 50, 400, 300]},
        {"label": "sun", "confidence": 0.88, "bbox": [200, 20, 280, 100]}
      ],
      "tags": ["nature", "sunset", "landscape"]
    }
  }
}
```

### 3.2 Streaming Response (NEW in v2.5)

For `response.mode: streaming`, the response is delivered as a sequence of chunks.

#### 3.2.1 Chunk Types

| Chunk Type | Purpose | Required Fields |
|------------|---------|-----------------|
| `meta` | Initial metadata | `streaming`, `meta` |
| `delta` | Incremental content | `chunk.seq`, `chunk.delta` |
| `snapshot` | Full state replacement | `chunk.seq`, `chunk.data` |
| `progress` | Progress update | `progress.percent` |
| `final` | Completion signal | `final`, `meta`, `data` |
| `error` | Error during stream | `ok: false`, `error` |

#### 3.2.2 Streaming Protocol

**Initial Chunk (meta)**

```json
{
  "ok": true,
  "streaming": true,
  "session_id": "sess_abc123",
  "meta": {
    "confidence": null,
    "risk": "low",
    "explain": "Starting analysis..."
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
    "delta": "The image shows "
  }
}

{
  "chunk": {
    "seq": 2,
    "type": "delta",
    "field": "data.rationale",
    "delta": "a beautiful sunset "
  }
}

{
  "chunk": {
    "seq": 3,
    "type": "delta",
    "field": "data.rationale",
    "delta": "over mountain peaks..."
  }
}
```

**Progress Chunk (optional)**

```json
{
  "progress": {
    "percent": 45,
    "stage": "analyzing_objects",
    "message": "Detecting objects in image..."
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
    "explain": "Analysis complete with 3 objects detected"
  },
  "data": {
    "rationale": "The image shows a beautiful sunset over mountain peaks...",
    "analysis": {
      "description": "Landscape photograph",
      "objects": [
        {"label": "mountain", "confidence": 0.95},
        {"label": "sun", "confidence": 0.88}
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

**Error During Stream**

```json
{
  "ok": false,
  "streaming": true,
  "session_id": "sess_abc123",
  "error": {
    "code": "E2002",
    "message": "Stream interrupted: timeout exceeded",
    "recoverable": true
  },
  "partial_data": {
    "rationale": "The image shows a beautiful sunset..."
  }
}
```

#### 3.2.3 Streaming Requirements

| Requirement | Level | Description |
|-------------|-------|-------------|
| Session ID | MUST | Unique identifier for the stream session |
| Sequence Numbers | MUST | Monotonically increasing, start from 1 |
| Final Chunk | MUST | Stream MUST end with `final: true` or error |
| Meta Chunk | MUST | First chunk MUST include `streaming: true` |
| Chunk Ordering | SHOULD | Deliver in order; client MAY reorder by seq |
| Heartbeat | MAY | Send empty chunk every 15s to prevent timeout |

#### 3.2.4 Transport Mechanisms

| Transport | Format | Use Case |
|-----------|--------|----------|
| **SSE** | `text/event-stream` | HTTP streaming (recommended) |
| **WebSocket** | JSON frames | Bidirectional, low latency |
| **NDJSON** | `application/x-ndjson` | Simple line-delimited JSON |

**SSE Example:**

```
event: meta
data: {"ok":true,"streaming":true,"session_id":"sess_abc123","meta":{...}}

event: chunk
data: {"chunk":{"seq":1,"type":"delta","field":"data.rationale","delta":"The image"}}

event: chunk
data: {"chunk":{"seq":2,"type":"delta","field":"data.rationale","delta":" shows a"}}

event: final
data: {"final":true,"meta":{...},"data":{...}}
```

#### 3.2.5 Response Mode Negotiation (`both` mode)

When `response.mode: both` is configured, the module supports both synchronous and streaming responses. The client negotiates the desired mode via the request.

##### 3.2.5.1 Negotiation Mechanism

**Option 1: HTTP Header (Recommended)**

```http
POST /v1/modules/image-analyzer/execute HTTP/1.1
Accept: text/event-stream
X-Cognitive-Response-Mode: streaming
```

| Header | Value | Behavior |
|--------|-------|----------|
| `Accept: application/json` | (default) | Synchronous response |
| `Accept: text/event-stream` | Streaming | SSE streaming response |
| `X-Cognitive-Response-Mode` | `sync` / `streaming` | Explicit mode override |

**Option 2: Query Parameter**

```
POST /v1/modules/image-analyzer/execute?response_mode=streaming
```

**Option 3: Request Body Field**

```json
{
  "input": { ... },
  "_options": {
    "response_mode": "streaming",
    "chunk_type": "delta"
  }
}
```

##### 3.2.5.2 Negotiation Priority

When multiple signals are present, runtime MUST use this priority:

1. `X-Cognitive-Response-Mode` header (highest)
2. `_options.response_mode` in request body
3. `response_mode` query parameter
4. `Accept` header inference
5. Module's default `response.mode` (lowest)

##### 3.2.5.3 Capability Mismatch Handling

| Module Mode | Client Requests | Provider Supports | Runtime Behavior |
|-------------|-----------------|-------------------|------------------|
| `both` | streaming | ✅ Yes | Stream response |
| `both` | streaming | ❌ No | Sync response + warning header |
| `both` | sync | Any | Sync response |
| `streaming` | sync | Any | E4010 error or forced sync with warning |
| `sync` | streaming | Any | Sync response + warning header |

**Warning Response Header:**

```http
X-Cognitive-Warning: STREAMING_UNAVAILABLE; fallback=sync; reason=provider_limitation
```

**Warning in Response Body (for sync fallback):**

```json
{
  "ok": true,
  "meta": { ... },
  "data": { ... },
  "_warnings": [
    {
      "code": "W4010",
      "message": "Streaming requested but not available, returned sync response",
      "fallback_used": "sync"
    }
  ]
}
```

#### 3.2.6 Error Recovery Protocol

When a stream fails mid-way, clients MAY attempt recovery using the following protocol.

##### 3.2.6.1 Recovery Checkpoint

Each chunk includes recovery information:

```json
{
  "chunk": {
    "seq": 15,
    "type": "delta",
    "field": "data.rationale",
    "delta": "analyzing the composition...",
    "checkpoint": {
      "offset": 342,
      "hash": "a3f2b1"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `checkpoint.offset` | Byte offset in the target field |
| `checkpoint.hash` | Short hash of accumulated content (first 6 chars of SHA256) |

##### 3.2.6.2 Error Chunk with Recovery Info

```json
{
  "ok": false,
  "streaming": true,
  "session_id": "sess_abc123",
  "error": {
    "code": "E2010",
    "message": "Stream interrupted: connection timeout",
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
    "rationale": "The image shows a beautiful sunset, with warm orange..."
  }
}
```

##### 3.2.6.3 Retry Request

Client MAY retry with recovery context:

```http
POST /v1/modules/image-analyzer/execute HTTP/1.1
X-Cognitive-Recovery-Session: sess_abc123
X-Cognitive-Recovery-Seq: 15
```

Or in request body:

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

##### 3.2.6.4 Server Recovery Behavior

| Scenario | Server Behavior |
|----------|-----------------|
| Session found, checkpoint valid | Resume from `last_seq + 1` |
| Session found, checkpoint mismatch | Restart stream with `seq: 1`, include `_warnings` |
| Session expired/not found | Restart stream with new `session_id` |
| Recovery not supported | Return E4012 error |

**Resumed Stream Example:**

```json
// First chunk after recovery
{
  "ok": true,
  "streaming": true,
  "session_id": "sess_abc123",
  "resumed": true,
  "resume_from_seq": 16,
  "meta": {
    "confidence": null,
    "risk": "low",
    "explain": "Resuming analysis..."
  }
}
```

##### 3.2.6.5 Client-Side Recovery Strategy

```
1. On error with recoverable=true:
   a. Wait for retry_after_ms (or exponential backoff)
   b. Check retry count < max_retries
   c. Send retry request with recovery context
   d. Validate first resumed chunk's seq matches expected
   e. If hash mismatch, discard partial_data and accept new stream

2. On error with recoverable=false:
   a. Surface error to user
   b. Optionally retry with fresh request (no recovery context)
```

---

## 4. Multimodal Specification (NEW in v2.5)

### 4.1 Supported Media Types

#### 4.1.1 Input Media Types

| Category | MIME Types | Max Size | Notes |
|----------|-----------|----------|-------|
| **Image** | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 20MB | GIF: first frame only |
| **Audio** | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/webm` | 25MB | Max 10 minutes |
| **Video** | `video/mp4`, `video/webm`, `video/quicktime` | 100MB | Max 5 minutes |
| **Document** | `application/pdf` | 50MB | Text extraction |

#### 4.1.2 Output Media Types

| Category | MIME Types | Generation Method |
|----------|-----------|-------------------|
| **Image** | `image/png`, `image/jpeg`, `image/webp` | DALL-E, Stable Diffusion, etc. |
| **Audio** | `audio/mpeg`, `audio/wav` | TTS, music generation |
| **Video** | `video/mp4` | Video generation (emerging) |

#### 4.1.3 Size Limits and Constraints

| Category | Max Size | Max Dimension | Max Duration | Notes |
|----------|----------|---------------|--------------|-------|
| **Image** | 20MB | 8192×8192 px | - | Larger images SHOULD be downscaled |
| **Audio** | 25MB | - | 10 minutes | Longer audio SHOULD be chunked |
| **Video** | 100MB | 4K (3840×2160) | 5 minutes | Frame sampling for long videos |
| **Document** | 50MB | - | - | Max 500 pages |

### 4.2 Large File Handling

For files exceeding inline size limits, Cognitive Modules supports multiple upload strategies.

#### 4.2.1 Upload Strategy Selection

| File Size | Recommended Strategy | Rationale |
|-----------|---------------------|-----------|
| < 5MB | Base64 inline | Simple, no extra infrastructure |
| 5MB - 20MB | URL reference | Avoid large JSON payloads |
| > 20MB | Pre-upload with reference | Required for large media |

#### 4.2.2 Pre-Upload Protocol

For large files, clients SHOULD use pre-upload:

**Step 1: Request Upload URL**

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

**Response:**

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

**Step 2: Upload File**

```http
PUT https://storage.example.com/upload/upl_abc123 HTTP/1.1
Content-Type: video/mp4
Content-Length: 52428800

<binary data>
```

**Step 3: Reference in Request**

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

#### 4.2.3 Chunked Upload (for files > 50MB)

For very large files, use multipart chunked upload:

```http
POST /v1/media/upload-multipart/init HTTP/1.1

{
  "filename": "large-video.mp4",
  "media_type": "video/mp4",
  "size_bytes": 157286400,
  "chunk_size_bytes": 10485760
}
```

**Response:**

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

**Complete Multipart:**

```http
POST https://storage.example.com/upload/upl_xyz789/complete HTTP/1.1

{
  "parts": [
    {"part": 1, "etag": "abc123"},
    {"part": 2, "etag": "def456"}
  ]
}
```

#### 4.2.4 Streaming Upload (Alternative)

For real-time media capture, runtime MAY support streaming upload:

```http
POST /v1/media/stream HTTP/1.1
Content-Type: audio/webm
Transfer-Encoding: chunked
X-Cognitive-Stream-Id: stream_123

<chunked binary data>
```

### 4.3 Media Input Formats

#### 4.3.1 URL Reference

```json
{
  "type": "url",
  "url": "https://example.com/image.jpg",
  "media_type": "image/jpeg"
}
```

**Requirements:**
- URL MUST be publicly accessible or include auth token
- `media_type` is OPTIONAL; runtime MAY infer from Content-Type
- Runtime SHOULD cache fetched media for retry

#### 4.3.2 Base64 Inline

```json
{
  "type": "base64",
  "media_type": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."
}
```

**Requirements:**
- `media_type` is REQUIRED
- `data` MUST be valid base64 encoding
- Runtime SHOULD validate media before LLM call

#### 4.3.3 File Path (Local)

```json
{
  "type": "file",
  "path": "/path/to/image.jpg"
}
```

**Requirements:**
- Path MUST be absolute or relative to module directory
- Runtime MUST check file exists and is readable
- `media_type` inferred from extension

#### 4.3.4 Upload Reference (for pre-uploaded files)

```json
{
  "type": "upload_ref",
  "upload_id": "upl_abc123",
  "media_type": "video/mp4"
}
```

**Requirements:**
- `upload_id` MUST reference a completed upload
- Upload MUST not be expired
- Runtime MUST verify upload ownership

### 4.4 Media Output Formats

#### 4.4.1 Generated Image

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

#### 4.4.2 URL Reference (Temporary)

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

### 4.5 Media Content Validation

Runtime MUST validate media content before processing. This section defines the validation requirements.

#### 4.5.1 Validation Levels

| Level | Description | When to Use |
|-------|-------------|-------------|
| **Structure** | Validate JSON structure only | Always (MUST) |
| **Format** | Validate media format/magic bytes | Always (MUST) |
| **Content** | Validate dimensions, duration, etc. | Recommended (SHOULD) |
| **Deep** | Content safety, corruption check | Optional (MAY) |

#### 4.5.2 Magic Bytes Validation

Runtime MUST verify media content matches declared MIME type:

| Media Type | Magic Bytes (Hex) | Description |
|------------|-------------------|-------------|
| `image/jpeg` | `FF D8 FF` | JPEG/JFIF image |
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` | PNG image |
| `image/gif` | `47 49 46 38` | GIF image |
| `image/webp` | `52 49 46 46 ... 57 45 42 50` | WebP image |
| `audio/mpeg` | `FF FB` or `FF FA` or `49 44 33` | MP3 audio |
| `audio/wav` | `52 49 46 46 ... 57 41 56 45` | WAV audio |
| `audio/ogg` | `4F 67 67 53` | OGG audio |
| `video/mp4` | `00 00 00 ... 66 74 79 70` | MP4 video |
| `video/webm` | `1A 45 DF A3` | WebM video |
| `application/pdf` | `25 50 44 46` | PDF document |

**Validation Error:**

```json
{
  "ok": false,
  "error": {
    "code": "E1014",
    "message": "Media content does not match declared type",
    "details": {
      "declared_type": "image/png",
      "detected_type": "image/jpeg",
      "magic_bytes": "ffd8ff"
    }
  }
}
```

#### 4.5.3 Dimension Validation

For images, runtime SHOULD validate dimensions:

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

**Dimension Constraints:**

| Constraint | Validation | Error Code |
|------------|------------|------------|
| Max width/height | width ≤ 8192 AND height ≤ 8192 | E1015 |
| Min width/height | width ≥ 10 AND height ≥ 10 | E1016 |
| Max pixels | width × height ≤ 67,108,864 | E1017 |

#### 4.5.4 Duration Validation

For audio/video, runtime SHOULD validate duration:

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

#### 4.5.5 Checksum Validation

Clients MAY include checksums for integrity verification:

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

**Supported Algorithms:**

| Algorithm | Output Length | Use Case |
|-----------|---------------|----------|
| `sha256` | 64 hex chars | Recommended for all |
| `md5` | 32 hex chars | Legacy support only |
| `crc32` | 8 hex chars | Quick verification |

#### 4.5.6 Validation Response

Runtime SHOULD include validation results in response:

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "Image analyzed successfully",
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

### 4.6 Multimodal in Prompt

In `prompt.md`, reference media inputs using placeholders:

```markdown
# Image Analysis Task

Analyze the following image(s):

$MEDIA_INPUTS

## Instructions
1. Describe what you see in detail
2. Identify all objects with bounding boxes
3. Assign relevant tags

## Output Format
Return analysis in the schema-defined format.
```

**Runtime Behavior:**
- `$MEDIA_INPUTS` is replaced with media representations
- For images: inline or URL depending on model support
- Runtime handles format conversion for different LLM APIs

### 4.5 Multimodal Envelope Example

**Input:**

```json
{
  "prompt": "Describe this image and identify any text",
  "images": [
    {
      "type": "url",
      "url": "https://example.com/receipt.jpg"
    }
  ]
}
```

**Output (Streaming Final):**

```json
{
  "final": true,
  "meta": {
    "confidence": 0.88,
    "risk": "none",
    "explain": "Receipt analyzed, 5 items extracted"
  },
  "data": {
    "rationale": "The image shows a retail receipt with itemized purchases...",
    "analysis": {
      "description": "Retail receipt from SuperMart",
      "extracted_text": "SuperMart\n123 Main St\n...",
      "items": [
        {"name": "Milk", "price": 3.99},
        {"name": "Bread", "price": 2.49}
      ],
      "total": 15.47
    }
  }
}
```

---

## 5. Tiers (unchanged from v2.2)

### 5.1 Tier Definitions

| Tier | Purpose | Confidence | Risk | Schema Strictness |
|------|---------|------------|------|-------------------|
| **exec** | Automatic execution | ≥0.9 required | Must be `none` or `low` | high |
| **decision** | Human-aided judgment | 0.5-0.9 typical | Any | medium |
| **exploration** | Research/inspiration | Any | Any | low |

### 5.2 Tier Defaults

```yaml
# Tier-based defaults (if not explicitly set)
exec:
  schema_strictness: high
  overflow.enabled: false
  enums.strategy: strict
  response.mode: sync      # Exec typically sync

decision:
  schema_strictness: medium
  overflow.enabled: true
  overflow.max_items: 5
  enums.strategy: extensible
  response.mode: both      # Support both sync and streaming

exploration:
  schema_strictness: low
  overflow.enabled: true
  overflow.max_items: 20
  enums.strategy: extensible
  response.mode: streaming  # Exploration benefits from streaming
```

---

## 6. Meta Field Specification

### 6.1 Required Fields

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| `confidence` | number | [0.0, 1.0] | Model's self-assessed certainty |
| `risk` | string/object | enum or extensible | Assessed risk level |
| `explain` | string | maxLength: 280 | Human-readable summary |

### 6.2 Optional Fields (v2.5)

| Field | Type | Description |
|-------|------|-------------|
| `processing_time_ms` | integer | Time taken to generate response |
| `model` | string | Model used (e.g., "gpt-4-vision") |
| `media_processed` | array | List of processed media items |

### 6.3 Streaming-Specific Meta

During streaming, meta fields MAY be updated:

```json
// Initial
{ "confidence": null, "risk": "low", "explain": "Processing..." }

// Final
{ "confidence": 0.92, "risk": "low", "explain": "Analysis complete" }
```

### 6.4 Multimodal Confidence Semantics

The meaning of `confidence` varies based on the task type. This section defines the semantics for different multimodal scenarios.

#### 6.4.1 Confidence by Task Type

| Task Type | Confidence Meaning | Example |
|-----------|-------------------|---------|
| **Text Analysis** | Certainty of correctness | Sentiment classification: 0.95 |
| **Image Analysis** | Certainty of detection/classification | Object detection: 0.88 |
| **Image Generation** | Prompt adherence score | Generated image matches prompt: 0.82 |
| **Audio Transcription** | Transcription accuracy | Speech-to-text confidence: 0.91 |
| **Audio Generation** | Quality/naturalness score | TTS quality: 0.85 |
| **Video Analysis** | Overall analysis certainty | Video understanding: 0.78 |

#### 6.4.2 Image Generation Confidence

For image generation tasks, `confidence` represents the model's assessment of how well the generated image matches the prompt:

```json
{
  "meta": {
    "confidence": 0.82,
    "risk": "low",
    "explain": "Generated image closely matches prompt with minor artistic interpretation",
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

**Confidence Breakdown (Optional):**

| Sub-score | Description | Range |
|-----------|-------------|-------|
| `prompt_adherence` | How well image matches the text prompt | [0.0, 1.0] |
| `aesthetic_score` | Visual appeal and composition | [0.0, 1.0] |
| `technical_quality` | Resolution, artifacts, coherence | [0.0, 1.0] |

#### 6.4.3 Multi-Object Detection Confidence

When detecting multiple objects, overall `confidence` is typically the mean or minimum of individual detections:

```json
{
  "meta": {
    "confidence": 0.87,
    "confidence_aggregation": "mean",
    "risk": "low",
    "explain": "Detected 3 objects with high confidence"
  },
  "data": {
    "objects": [
      {"label": "car", "confidence": 0.95, "bbox": [10, 20, 100, 80]},
      {"label": "person", "confidence": 0.88, "bbox": [120, 30, 160, 180]},
      {"label": "dog", "confidence": 0.78, "bbox": [200, 100, 250, 150]}
    ]
  }
}
```

**Aggregation Methods:**

| Method | Calculation | Use Case |
|--------|-------------|----------|
| `mean` | Average of all confidences | General detection |
| `min` | Minimum confidence | Conservative estimate |
| `weighted_mean` | Weighted by object area/importance | Primary object focus |

#### 6.4.4 Audio/Video Confidence

For temporal media, confidence may vary over time:

```json
{
  "meta": {
    "confidence": 0.89,
    "risk": "low",
    "explain": "Transcription complete with high accuracy",
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

#### 6.4.5 Confidence Thresholds by Tier

| Tier | Min Confidence | Action if Below |
|------|----------------|-----------------|
| `exec` | 0.9 | MUST fail with E3001 |
| `decision` | 0.5 | SHOULD include warning |
| `exploration` | None | Informational only |

---

## 7. Error Codes (v2.5 Additions)

### 7.1 New Error Codes

| Code | Name | Description |
|------|------|-------------|
| **E1010** | UNSUPPORTED_MEDIA_TYPE | Media type not supported by module |
| **E1011** | MEDIA_TOO_LARGE | Media exceeds size limit |
| **E1012** | MEDIA_FETCH_FAILED | Failed to fetch media from URL |
| **E1013** | MEDIA_DECODE_FAILED | Failed to decode base64 media |
| **E2010** | STREAM_INTERRUPTED | Stream was interrupted |
| **E2011** | STREAM_TIMEOUT | Stream exceeded timeout |
| **E4010** | STREAMING_NOT_SUPPORTED | Runtime doesn't support streaming |
| **E4011** | MULTIMODAL_NOT_SUPPORTED | Runtime doesn't support multimodal |

### 7.2 Full Error Code Table

| Range | Category | v2.5 Additions |
|-------|----------|----------------|
| E1xxx | Input errors | E1010-E1013 (media) |
| E2xxx | Processing errors | E2010-E2011 (streaming) |
| E3xxx | Output errors | (none) |
| E4xxx | Runtime errors | E4010-E4011 (capability) |

---

## 8. Runtime Behavior

### 8.1 Capability Declaration

Runtimes MUST declare their capabilities:

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

### 8.2 Graceful Degradation

When a capability is requested but not available:

| Scenario | Runtime Behavior |
|----------|-----------------|
| Streaming requested, not supported | Return sync response with warning |
| Multimodal input, not supported | Return E4011 error |
| Media too large | Return E1011 error |

### 8.3 Repair Pass (v2.5 Extension)

The repair pass now handles media:

1. **Media Validation** — Verify media is valid and within limits
2. **Media Normalization** — Convert to runtime's preferred format
3. **Streaming Assembly** — Assemble chunks into final envelope

---

## 9. Conformance Levels (v2.5)

### Level 1: Basic (unchanged)
- Sync envelope validation
- Text-only input/output

### Level 2: Standard (unchanged)
- Full tier support
- Error codes E1xxx-E3xxx

### Level 3: Full (v2.2 features)
- Composition support
- Context protocol

### Level 4: Extended (NEW in v2.5)
- Streaming support
- Multimodal input
- Multimodal output (optional)

---

## 10. Migration Guide

### 10.1 From v2.2 to v2.5

**No changes required for existing modules.**

To add streaming:
```yaml
# Add to module.yaml
response:
  mode: streaming
```

To add multimodal:
```yaml
# Add to module.yaml
modalities:
  input: [text, image]
  output: [text]
```

### 10.2 Runtime Updates

```python
# Python runtime
from cognitive import CognitiveRuntime

runtime = CognitiveRuntime(
    streaming=True,
    multimodal=True
)

# Streaming execution
async for chunk in runtime.execute_stream(module, input):
    print(chunk)

# Sync execution (unchanged)
result = runtime.execute(module, input)
```

---

## 11. Security Considerations

### 11.1 Media Security

- **URL Validation** — Validate URLs before fetching; block private IPs
- **Size Limits** — Enforce max size before processing
- **Content Validation** — Verify media matches declared type
- **Sanitization** — Strip EXIF/metadata if configured

### 11.2 Streaming Security

- **Session Tokens** — Use unique session IDs for stream correlation
- **Timeout Enforcement** — Kill streams exceeding max duration
- **Rate Limiting** — Limit concurrent streams per client

---

## 12. Examples

### 12.1 Image Analysis Module

See `cognitive/modules/image-analyzer/` for complete example.

### 12.2 Audio Transcription Module

```yaml
# module.yaml
name: audio-transcriber
version: 2.5.0
responsibility: Transcribe audio to text with timestamps
tier: exec

response:
  mode: streaming
  chunk_type: delta

modalities:
  input: [audio]
  output: [text]
```

### 12.3 Image Generation Module

```yaml
# module.yaml
name: image-generator
version: 2.5.0
responsibility: Generate images from text descriptions
tier: decision

modalities:
  input: [text]
  output: [text, image]
```

---

## 13. Normative References

- [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) - Key words
- [JSON Schema Draft-07](https://json-schema.org/specification-links.html#draft-7)
- [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259) - JSON
- [RFC 2046](https://datatracker.ietf.org/doc/html/rfc2046) - MIME Types
- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.5.0 | 2026-02 | Added: Streaming response, Multimodal support, Level 4 conformance |
| v2.2.1 | 2026-02 | Added: Versioning, Compatibility Matrix, Test Vectors |
| v2.2.0 | 2025-08 | Initial v2.2 with envelope, tiers, overflow |
