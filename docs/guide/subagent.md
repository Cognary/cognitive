# 子代理

Cognitive Modules 支持模块间调用，实现复杂任务的分解与组合。

## @call 语法

在 MODULE.md 中使用 `@call:module-name` 调用其他模块：

```markdown
## 处理流程

1. 分析用户需求
2. 调用 UI 规范生成器：
   @call:ui-spec-generator($ARGUMENTS)
3. 整合结果
```

## 调用形式

| 语法 | 说明 |
|------|------|
| `@call:module-name` | 传递父模块输入 |
| `@call:module-name($ARGUMENTS)` | 传递父模块的 $ARGUMENTS |
| `@call:module-name(自定义参数)` | 传递自定义参数 |

## context 配置

### fork（隔离执行）

```yaml
---
name: parent-module
context: fork
---
```

- 子模块有独立上下文
- 子模块结果不影响其他子模块
- 适合并行执行多个独立任务

### main（共享执行）

```yaml
---
name: parent-module
context: main  # 默认
---
```

- 子模块共享父模块上下文
- 子模块结果可被其他子模块访问

## 运行时启用

```bash
# 启用子代理模式
cog run parent-module --args "需求" --subagent

# 简写
cog run parent-module -a "需求" -s
```

## 执行流程

1. 解析 prompt 中的 `@call` 指令
2. 递归执行子模块
3. 将子模块结果注入父 prompt
4. 执行父模块生成最终输出

```
父模块 Prompt
    ↓
解析 @call:child-module
    ↓
执行 child-module
    ↓
注入结果 [Result from @call:child-module]: {...}
    ↓
执行父模块
    ↓
最终输出
```

## 示例：product-analyzer

```yaml
---
name: product-analyzer
version: 1.0.0
responsibility: 分析产品需求并调用 UI 规范生成器
context: fork
---

# 产品分析器

## 输入

用户产品描述：$ARGUMENTS

## 处理流程

1. 需求分析
2. 调用 UI 规范生成器：
   @call:ui-spec-generator($ARGUMENTS)
3. 整合输出

## 输出

- analysis: 产品分析
- ui_spec: 来自 @call 的 UI 规范
- recommendations: 建议
```

运行：

```bash
cog run product-analyzer --args "健康产品官网" --subagent --pretty
```

## 限制

| 限制 | 值 |
|------|-----|
| 最大调用深度 | 5 层 |
| 循环调用 | 自动检测并阻止 |
| 子模块验证 | 跳过输入验证，保留输出验证 |
