---
sidebar_position: 5
---

# Node.js 运行时

运行时由 `cognitive-modules-cli` 提供，也可作为库使用。

## 安装

```bash
npm install cognitive-modules-cli
```

## 示例

```ts
import { loadModule, runModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-simplifier');

const result = await runModule(module, provider, { args: 'code' });
console.log(result);
```

## 模块搜索路径

1. `./cognitive/modules/`
2. `~/.cognitive/modules/`
