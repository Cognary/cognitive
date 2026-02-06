---
sidebar_position: 6
---

# 编程 API（Node.js）

CLI 包同时提供运行时 API。

## 安装

```bash
npm install cognitive-modules-cli
```

## 基础用法

```ts
import { loadModule, runModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-reviewer');

const result = await runModule(module, provider, { args: 'def foo(): pass' });
console.log(result);
```

## 流式输出

```ts
import { loadModule, runModuleStream, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-reviewer');

for await (const event of runModuleStream(module, provider, { args: 'code' })) {
  if (event.type === 'chunk') process.stdout.write(event.chunk);
  if (event.type === 'complete') console.log(event.result);
}
```

## 子代理

```ts
import { runWithSubagents, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await runWithSubagents('product-analyzer', provider, {
  args: 'health product website'
});
```

## 组合执行

```ts
import { executeComposition, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await executeComposition('code-review-pipeline', { query: 'code' }, provider);
```
