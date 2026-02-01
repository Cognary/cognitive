# Task Prioritizer

任务优先级排序，输出排序后的任务列表和决策依据。

## 何时使用

当用户有多个任务需要排序、确定优先级、规划执行顺序时，使用此 Skill。

## 使用方法

```bash
cog run task-prioritizer --args "任务列表" --pretty
```

## 输入

描述需要排序的任务，可以是：
- 逗号分隔的任务列表
- 带编号的任务描述
- 自然语言描述的多个待办事项

## 输出

JSON 格式，包含：

- `prioritized_tasks`: 排序后的任务列表，每个任务有 `rank`、`name`、`priority`（high/medium/low）、`reason`
- `confidence`: 0-1 之间的置信度
- `rationale`: 排序逻辑和考量因素

## 示例

```bash
cog run task-prioritizer --args "修复登录bug, 写文档, 性能优化, 添加新功能" --pretty
```

## 注意事项

- 这是一个 Cognitive Module 的 Skill 包装
- 输出始终是结构化 JSON
- 需要先安装：`pip install cognitive-modules`
- 需要配置 LLM
