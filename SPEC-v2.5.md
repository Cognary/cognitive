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

### 4.2 Media Input Formats

#### 4.2.1 URL Reference

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

#### 4.2.2 Base64 Inline

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

#### 4.2.3 File Path (Local)

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

### 4.3 Media Output Formats

#### 4.3.1 Generated Image

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

#### 4.3.2 URL Reference (Temporary)

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

### 4.4 Multimodal in Prompt

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
