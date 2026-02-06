---
sidebar_position: 3
---

# 子代理（@call）

通过 `@call:` 实现模块间调用。

## 语法

```markdown
@call:ui-spec-generator($ARGUMENTS)
```

## context 配置

在 `module.yaml` 中：

```yaml
context: fork   # fork | main
```

## 运行方式

子代理编排通过 **编程 API** 使用：

```ts
import { runWithSubagents, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const result = await runWithSubagents('product-analyzer', provider, {
  args: 'health product website'
});
```

> CLI `cog run` **不会**自动解析 `@call`。

## 限制

| 限制 | 值 |
|------|----|
| 最大深度 | 5 |
| 循环调用 | 自动阻止 |
| 子模块校验 | 跳过输入校验，保留输出校验 |
