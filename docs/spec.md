# 规范文档

完整的 Cognitive Modules 规范请参阅项目根目录的 [SPEC.md](https://github.com/leizii/cognitive-modules/blob/main/SPEC.md)。

## 快速概览

### 设计原则

1. **单一职责** - 每个模块只做一件事
2. **数据优先** - 强类型输入输出
3. **可验证输出** - 必须包含 confidence 和 rationale
4. **约束执行** - 明确禁止的行为
5. **示例驱动** - 必须提供可验证的示例
6. **显式上下文** - 上下文必须是输入的一部分

### 核心概念

| 概念 | 说明 |
|------|------|
| MODULE.md | 模块定义文件（元数据 + 指令） |
| schema.json | 输入输出 JSON Schema |
| $ARGUMENTS | 运行时参数占位符 |
| @call:module | 子代理调用语法 |
| context | 执行上下文（fork/main） |
| confidence | 置信度 0-1 |
| rationale | 推理过程 |

### 与 Skills 对比

| | Skills | Cognitive Modules |
|---|--------|------------------|
| 核心理念 | 灵活动态 | 严谨可测 |
| 输入验证 | ❌ | ✅ JSON Schema |
| 输出验证 | ❌ | ✅ JSON Schema |
| 置信度 | ❌ | ✅ 必须 |
| 推理过程 | ❌ | ✅ 必须 |
| 上下文 | 隐式（环境） | 显式（参数） |

### 上下文哲学

> Cognitive trades conversational convenience for engineering certainty.

- ❌ 隐式上下文（对话历史自动叠加）
- ✅ 显式上下文（结构化、可验证）

详细信息请参阅 [上下文哲学](guide/context-philosophy.md)。
