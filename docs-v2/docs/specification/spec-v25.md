---
sidebar_position: 1
---

# Cognitive Modules Specification v2.5

> **Verifiable Structured AI Task Specification — Streaming & Multimodal Edition**

English | [中文](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC-v2.5_zh.md)

---

## What's New in v2.5

| Feature | Description |
|---------|-------------|
| **Streaming Response** | Real-time chunk-based output for better UX |
| **Multimodal Support** | Native image, audio, and video input/output |
| **Backward Compatible** | v2.2 modules run without modification |
| **Level 4 Conformance** | Extended conformance level for v2.5 features |

---

## 1. Streaming Response

### 1.1 Response Mode Configuration

```yaml
# module.yaml
response:
  mode: streaming      # sync | streaming | both
  chunk_type: delta    # delta | snapshot
  buffer_size: 1024    # bytes before flush
  heartbeat_interval_ms: 15000
  max_duration_ms: 300000
```

### 1.2 Chunk Types

| Chunk Type | Purpose | Required Fields |
|------------|---------|-----------------|
| `meta` | Initial metadata | `streaming`, `session_id`, `meta` |
| `delta` | Incremental content | `chunk.seq`, `chunk.delta` |
| `snapshot` | Full state replacement | `chunk.seq`, `chunk.data` |
| `progress` | Progress update | `progress.percent` |
| `final` | Completion signal | `final`, `meta`, `data` |
| `error` | Error during stream | `ok: false`, `error` |

### 1.3 Streaming Protocol Example

**Initial Chunk:**
```json
{
  "ok": true,
  "streaming": true,
  "session_id": "sess_abc123",
  "meta": { "confidence": null, "risk": "low", "explain": "Processing..." }
}
```

**Delta Chunks:**
```json
{ "chunk": { "seq": 1, "type": "delta", "field": "data.rationale", "delta": "The image shows " } }
{ "chunk": { "seq": 2, "type": "delta", "field": "data.rationale", "delta": "a beautiful sunset..." } }
```

**Final Chunk:**
```json
{
  "final": true,
  "meta": { "confidence": 0.92, "risk": "low", "explain": "Analysis complete" },
  "data": { "rationale": "The image shows a beautiful sunset...", "analysis": {...} },
  "usage": { "input_tokens": 1250, "output_tokens": 340, "total_tokens": 1590 }
}
```

### 1.4 Transport Mechanisms

| Transport | Format | Use Case |
|-----------|--------|----------|
| **SSE** | `text/event-stream` | HTTP streaming (recommended) |
| **WebSocket** | JSON frames | Bidirectional, low latency |
| **NDJSON** | `application/x-ndjson` | Simple line-delimited JSON |

---

## 2. Multimodal Support

### 2.1 Modalities Configuration

```yaml
# module.yaml
modalities:
  input:
    - text             # Always supported
    - image            # JPEG, PNG, WebP, GIF
    - audio            # MP3, WAV, OGG
    - video            # MP4, WebM
  output:
    - text
    - image            # Can generate images
  constraints:
    max_image_size_mb: 20
    max_audio_duration_s: 600
```

### 2.2 Media Input Formats

#### URL Reference
```json
{ "type": "url", "url": "https://example.com/image.jpg", "media_type": "image/jpeg" }
```

#### Base64 Inline
```json
{ "type": "base64", "media_type": "image/png", "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA..." }
```

#### File Path
```json
{ "type": "file", "path": "/path/to/image.jpg" }
```

### 2.3 Supported Media Types

| Category | MIME Types | Max Size |
|----------|-----------|----------|
| **Image** | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 20MB |
| **Audio** | `audio/mpeg`, `audio/wav`, `audio/ogg` | 25MB |
| **Video** | `video/mp4`, `video/webm` | 100MB |
| **Document** | `application/pdf` | 50MB |

---

## 3. Error Codes (v2.5 Additions)

### Media Errors (E1xxx)

| Code | Name | Description |
|------|------|-------------|
| E1010 | UNSUPPORTED_MEDIA_TYPE | Media type not supported |
| E1011 | MEDIA_TOO_LARGE | Media exceeds size limit |
| E1012 | MEDIA_FETCH_FAILED | Failed to fetch URL |
| E1013 | MEDIA_DECODE_FAILED | Failed to decode base64 |

### Streaming Errors (E2xxx)

| Code | Name | Description |
|------|------|-------------|
| E2010 | STREAM_INTERRUPTED | Stream was interrupted |
| E2011 | STREAM_TIMEOUT | Stream exceeded timeout |

### Capability Errors (E4xxx)

| Code | Name | Description |
|------|------|-------------|
| E4010 | STREAMING_NOT_SUPPORTED | Runtime doesn't support streaming |
| E4011 | MULTIMODAL_NOT_SUPPORTED | Runtime doesn't support multimodal |

---

## 4. Conformance Level 4

Level 4 (Extended) requires all Level 1-3 requirements plus:

- ✅ Streaming response support
- ✅ Multimodal input support
- ⚪ Multimodal output support (optional)
- ✅ Runtime capability declaration

### Runtime Capabilities

```json
{
  "runtime": "cognitive-runtime-python",
  "version": "2.5.0",
  "capabilities": {
    "streaming": true,
    "multimodal": { "input": ["image", "audio"], "output": ["image"] },
    "max_media_size_mb": 20,
    "supported_transports": ["sse", "websocket", "ndjson"]
  }
}
```

---

## 5. Migration from v2.2

**No changes required for existing modules.**

### Adding Streaming

```yaml
# Add to module.yaml
response:
  mode: streaming
```

### Adding Multimodal

```yaml
# Add to module.yaml
modalities:
  input: [text, image]
  output: [text]
```

---

## 6. Example Module

See the complete [image-analyzer module](https://github.com/ziel-io/cognitive-modules/tree/main/cognitive/modules/image-analyzer) for a working v2.5 example with streaming and multimodal support.

---

## Full Specification

For the complete specification, see:
- [SPEC-v2.5.md](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC-v2.5.md) (English)
- [SPEC-v2.5_zh.md](https://github.com/ziel-io/cognitive-modules/blob/main/SPEC-v2.5_zh.md) (中文)

## Related Documents

- [Conformance Levels](./conformance.md) - Including Level 4 requirements
- [Error Codes](./error-codes.md) - Complete error taxonomy
- [Streaming Schema](https://github.com/ziel-io/cognitive-modules/blob/main/spec/streaming-envelope.schema.json)
- [Media Types Schema](https://github.com/ziel-io/cognitive-modules/blob/main/spec/media-types.schema.json)
