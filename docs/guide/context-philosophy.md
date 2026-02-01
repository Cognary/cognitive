# 上下文哲学

> **Cognitive trades conversational convenience for engineering certainty.**
> 
> 不是不做动态，是不做不可控的动态。

## 核心区分

Cognitive Modules 的优势来自**契约层面的可确定性**，但这不等于"不能有动态上下文"。

| 类型 | 说明 | Cognitive |
|------|------|-----------|
| 隐式上下文 | 对话历史自动叠加、Agent scratchpad、模型"记住" | ❌ 禁止 |
| 显式上下文 | 结构化状态快照、事件窗口、上游模块输出 | ✅ 允许 |

**判断标准**：是否在输入 Schema 里声明？

- 在 Schema 里 → 可验证 → 允许
- 不在 Schema 里 → 不可控 → 禁止

## 为什么禁止隐式上下文？

隐式上下文会破坏三件 Cognitive 非常看重的事：

1. **可复现性** - 同样的输入应该产生可预测的输出
2. **可验证性** - 输出可以用 Schema 验证
3. **模块可替换性** - 模块是独立的，不依赖外部状态

## 允许的动态上下文形态

### 1. 状态快照（State Snapshot）

```json
{
  "current_state": {
    "mode": "exploration",
    "confidence_history": [0.82, 0.76, 0.61],
    "open_questions": 2
  },
  "input": { ... }
}
```

- 每次调用传入一个快照
- 没有隐式记忆
- 可裁剪、可回放

### 2. 事件窗口（Event Log / Windowed）

```json
{
  "recent_events": [
    { "type": "validation_failed", "module": "ui-spec-generator" },
    { "type": "missing_field", "field": "breakpoints" }
  ],
  "input": { ... }
}
```

- 时间窗口明确（last N events）
- 不是完整历史
- 可被规则约束

### 3. 上游模块输出（Typed Handoff）

```json
{
  "ui_spec": { ... },
  "review_policy": { ... }
}
```

- 上下游通过 Schema 对接
- 上下文来源清晰
- 组合性极强

## Context Builder 模式

推荐架构：

```
脏数据 / 对话 / 日志
       ↓
Context Builder（可脏、可自由）
       ↓
Structured Context（JSON, windowed, typed）
       ↓
Cognitive Module（严格、可验证）
```

- Context Builder 可以是 Agent、Prompt、Skill、检索系统等
- Cognitive Module 只接收"已整理好的上下文"

## 与 Skills 的差异

| | Skills | Cognitive Modules |
|---|--------|------------------|
| 上下文 | 环境（自动存在） | 参数（必须声明） |
| 对话历史 | ✅ 自动 | ❌ 需显式传入 |
| 灵活性 | 高 | 中 |
| 可验证性 | 低 | 高 |
| 适用场景 | 对话助手 | 结构化任务 |
