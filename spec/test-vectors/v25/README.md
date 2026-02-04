# Cognitive Modules v2.5 Test Vectors

Test vectors for v2.5 features: streaming and multimodal support.

## Categories

### Streaming Tests

| File | Description | Expects |
|------|-------------|---------|
| `streaming-meta-chunk.json` | Initial meta chunk | accept |
| `streaming-delta-chunk.json` | Delta content chunk | accept |
| `streaming-final-chunk.json` | Final completion chunk | accept |
| `streaming-progress-chunk.json` | Progress update chunk | accept |
| `streaming-error-chunk.json` | Error during stream | accept |
| `invalid-streaming-missing-session.json` | Missing session_id | reject |

### Multimodal Tests

| File | Description | Expects |
|------|-------------|---------|
| `multimodal-url-input.json` | URL image reference | accept |
| `multimodal-base64-input.json` | Base64 encoded image | accept |
| `multimodal-output-image.json` | Generated image output | accept |
| `multimodal-multiple-images.json` | Multiple images input | accept |
| `invalid-multimodal-missing-type.json` | Missing type field | reject |
| `invalid-multimodal-missing-media-type.json` | Missing media_type for base64 | reject |

## Conformance Level

All v2.5 test vectors are tagged with `conformance_level: 4` (Extended).

Level 4 conformance requires:
- All Level 1-3 requirements
- Streaming support
- Multimodal input support
- Multimodal output support (optional)

## Running Tests

```bash
# Validate v2.5 test vectors
python scripts/validate-test-vectors.py --level 4
```
