---
sidebar_position: 5
---

# TypeScript Runtime

Besides the Python CLI, Cognitive Modules also provides a standalone TypeScript runtime `cognitive-runtime`.

## Installation

```bash
npm install -g cognitive-runtime
```

## CLI Usage

```bash
# Run module
cog run code-reviewer --args "your code" --pretty

# List modules
cog list

# Module info
cog info code-reviewer

# Validate module
cog validate code-reviewer --v22
```

## Programmatic Usage

### Basic

```typescript
import { runModule } from 'cognitive-runtime';

const result = await runModule('code-reviewer', {
  code: 'function add(a, b) { return a + b; }',
  language: 'javascript'
});

console.log(result.meta.confidence);
console.log(result.data.issues);
```

### With Configuration

```typescript
import { CognitiveRuntime } from 'cognitive-runtime';

const runtime = new CognitiveRuntime({
  modulesPath: './cognitive/modules',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o'
});

const result = await runtime.run('code-reviewer', { code: '...' });
```

### Streaming

```typescript
import { runModuleStream } from 'cognitive-runtime';

const stream = runModuleStream('code-reviewer', { code: '...' });

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## v2.2 Format Support

TypeScript runtime fully supports v2.2 format:

```typescript
interface ModuleResult<T = any> {
  ok: boolean;
  meta: {
    confidence: number;
    risk: 'none' | 'low' | 'medium' | 'high';
    explain: string;
  };
  data?: T & {
    rationale: string;
    extensions?: {
      insights?: Array<{
        text: string;
        suggested_mapping: string;
      }>;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}
```

## HTTP Server

```bash
# Start HTTP server
cog serve --port 8000

# With CORS
cog serve --port 8000 --cors
```

### API Endpoints

```bash
# Run module
POST /api/run/:module
Content-Type: application/json
{
  "code": "...",
  "language": "python"
}

# List modules
GET /api/modules

# Module info
GET /api/modules/:module
```

## MCP Server

```bash
# Start MCP server (for Claude Desktop, Cursor)
cog mcp

# With custom port
cog mcp --port 3000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | Provider (openai/anthropic/ollama) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LLM_MODEL` | Default model |
| `COGNITIVE_MODULES_PATH` | Custom modules path |

## Comparison with Python

| Feature | Python (cogn) | TypeScript (cog) |
|---------|---------------|------------------|
| CLI | ✅ | ✅ |
| HTTP Server | ✅ | ✅ |
| MCP Server | ✅ | ✅ |
| Async | ✅ | ✅ |
| Streaming | ❌ | ✅ |
| v2.2 Support | ✅ | ✅ |
