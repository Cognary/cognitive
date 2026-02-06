---
sidebar_position: 5
---

# Node.js Runtime

The Node.js runtime is provided by the `cognitive-modules-cli` package. It can be used programmatically (not just via CLI).

## Install

```bash
npm install cognitive-modules-cli
```

## Example

```ts
import { loadModule, runModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-simplifier');

const result = await runModule(module, provider, { args: 'code' });
console.log(result);
```

## Module Search Paths

The runtime searches these locations (in order):

1. `./cognitive/modules/`
2. `~/.cognitive/modules/`
