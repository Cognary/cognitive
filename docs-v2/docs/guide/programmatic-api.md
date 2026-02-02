---
sidebar_position: 6
---

# Programmatic API

Besides CLI, you can also call Cognitive Modules directly in code.

## Python API

### Basic Usage

```python
from cognitive import run_module, find_module, load_module

# Method 1: Direct run (recommended)
result = run_module('code-reviewer', {
    'code': 'def foo(): pass',
    'language': 'python'
})

print(result['issues'])
print(result['confidence'])
print(result['rationale'])
```

### Step-by-step Call

```python
from cognitive.loader import load_module, find_module
from cognitive.runtime import execute

# Find module
module_path = find_module('code-reviewer')

# Load module
module = load_module(module_path)

# Execute
result = execute(module, {
    'code': 'your code',
    'language': 'python'
})
```

### Async Support

```python
import asyncio
from cognitive import run_module_async

async def main():
    result = await run_module_async('code-reviewer', {
        'code': 'async def foo(): pass'
    })
    print(result)

asyncio.run(main())
```

## TypeScript/JavaScript API

### Basic Usage

```typescript
import { runModule, findModule } from 'cognitive-runtime';

// Direct run
const result = await runModule('code-reviewer', {
  code: 'function foo() {}',
  language: 'javascript'
});

console.log(result.issues);
console.log(result.confidence);
```

### Configuration

```typescript
import { CognitiveRuntime } from 'cognitive-runtime';

const runtime = new CognitiveRuntime({
  modulesPath: './cognitive/modules',
  provider: 'openai',
  model: 'gpt-4o'
});

const result = await runtime.run('code-reviewer', {
  code: '...'
});
```

## Response Format

### v2.2 Envelope

```typescript
interface CognitiveResponse<T> {
  ok: boolean;
  meta: {
    confidence: number;
    risk: 'none' | 'low' | 'medium' | 'high';
    explain: string;
  };
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### Handling Results

```python
result = run_module('code-reviewer', input_data)

if result['ok']:
    # Success
    print(f"Confidence: {result['meta']['confidence']}")
    print(f"Issues: {result['data']['issues']}")
else:
    # Error
    print(f"Error: {result['error']['code']}")
    print(f"Message: {result['error']['message']}")
```

## Provider Configuration

```python
from cognitive import configure

# Set provider
configure(
    provider='anthropic',
    api_key='sk-ant-xxx',
    model='claude-sonnet-4-20250514'
)

# Or use environment variables
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-xxx
```

## Error Handling

```python
from cognitive import run_module, CognitiveError

try:
    result = run_module('code-reviewer', {'code': '...'})
except CognitiveError as e:
    print(f"Module error: {e.code}")
    print(f"Message: {e.message}")
except ValidationError as e:
    print(f"Input validation failed: {e}")
```
