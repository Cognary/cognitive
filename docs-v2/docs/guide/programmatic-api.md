---
sidebar_position: 6
---

# Programmatic API (Node.js)

The CLI package also exposes a runtime API for programmatic use.

## Install

```bash
npm install cognitive-modules-cli
```

## Basic Usage

```ts
import { loadModule, runModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-reviewer');

const result = await runModule(module, provider, {
  args: 'def foo(): pass'
});

if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## Streaming

```ts
import { loadModule, runModuleStream, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-reviewer');

for await (const event of runModuleStream(module, provider, { args: 'code' })) {
  if (event.type === 'chunk') process.stdout.write(event.chunk);
  if (event.type === 'complete') console.log(event.result);
}
```

## Subagents

```ts
import { runWithSubagents, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await runWithSubagents('product-analyzer', provider, {
  args: 'health product website'
});
```

## Composition

```ts
import { executeComposition, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await executeComposition('code-review-pipeline', { query: 'code' }, provider);
```

## Response Format (v2.2)

```ts
interface Envelope<T> {
  ok: boolean;
  meta: {
    confidence: number;
    risk: 'none' | 'low' | 'medium' | 'high';
    explain: string;
  };
  data?: T;
  error?: { code: string; message: string };
  partial_data?: unknown;
}
```
