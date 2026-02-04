# Image Analyzer

A Cognitive Modules v2.5 example demonstrating **multimodal input** and **streaming output**.

## Features

- **Multimodal Input**: Accepts images via URL, base64, or file path
- **Streaming Output**: Real-time analysis feedback with delta chunks
- **Object Detection**: Identifies objects with confidence scores
- **OCR**: Extracts text from images
- **Risk Assessment**: Evaluates content for potential concerns

## Usage

### CLI

```bash
# Analyze image from URL
cog run image-analyzer --args "Describe this image" \
  --input '{"images": [{"type": "url", "url": "https://example.com/photo.jpg"}]}'

# Analyze local file
cog run image-analyzer --args "What objects are in this image?" \
  --input '{"images": [{"type": "file", "path": "./photo.jpg"}]}'
```

### Programmatic (Python)

```python
from cognitive import CognitiveRuntime

runtime = CognitiveRuntime(streaming=True, multimodal=True)

# Streaming execution
async for chunk in runtime.execute_stream("image-analyzer", {
    "prompt": "Describe this image",
    "images": [{"type": "url", "url": "https://example.com/photo.jpg"}]
}):
    if chunk.get("chunk"):
        print(chunk["chunk"]["delta"], end="", flush=True)
    elif chunk.get("final"):
        print("\n\nAnalysis complete!")
        print(f"Confidence: {chunk['meta']['confidence']}")
```

### Programmatic (Node.js)

```typescript
import { CognitiveRuntime } from 'cognitive-modules-cli';

const runtime = new CognitiveRuntime({ streaming: true, multimodal: true });

const stream = runtime.executeStream('image-analyzer', {
  prompt: 'Describe this image',
  images: [{ type: 'url', url: 'https://example.com/photo.jpg' }]
});

for await (const chunk of stream) {
  if (chunk.chunk) {
    process.stdout.write(chunk.chunk.delta);
  }
}
```

## Input Schema

```json
{
  "prompt": "Optional analysis instructions",
  "images": [
    {
      "type": "url",
      "url": "https://example.com/image.jpg"
    }
  ],
  "options": {
    "extract_text": true,
    "detect_objects": true,
    "include_bbox": false
  }
}
```

## Output Schema

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "none",
    "explain": "Clear landscape photo with 3 detected objects"
  },
  "data": {
    "rationale": "The image shows a mountain landscape...",
    "analysis": {
      "description": "A scenic mountain view with snow-capped peaks...",
      "objects": [
        {"label": "mountain", "confidence": 0.95},
        {"label": "sky", "confidence": 0.99},
        {"label": "trees", "confidence": 0.87}
      ],
      "tags": ["nature", "landscape", "mountains"]
    }
  }
}
```

## Streaming Output

When running in streaming mode, the module outputs chunks:

1. **Meta chunk**: Initial streaming signal
2. **Delta chunks**: Incremental content updates
3. **Progress chunks**: Analysis stage updates (optional)
4. **Final chunk**: Complete result with all data

## Supported Image Formats

| Format | MIME Type | Max Size |
|--------|-----------|----------|
| JPEG | image/jpeg | 20MB |
| PNG | image/png | 20MB |
| WebP | image/webp | 20MB |
| GIF | image/gif | 20MB (first frame) |

## Error Codes

| Code | Description |
|------|-------------|
| E1010 | Unsupported image format |
| E1011 | Image exceeds size limit |
| E1012 | Failed to fetch image from URL |
| E2001 | Analysis failed |

## Requirements

- Runtime: Cognitive Modules v2.5+
- LLM: Vision-capable model (GPT-4V, Claude 3, Gemini Pro Vision)
