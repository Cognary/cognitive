---
sidebar_position: 4
---

# task-prioritizer

根据紧急度、重要性和依赖关系对任务进行优先级排序。

## 基本信息

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 分类 | 项目管理 |
| 格式 | 新格式 |

## 功能

- 使用 Eisenhower Matrix 进行分类
- 分析任务依赖关系
- 识别阻塞任务
- 提供执行建议

## 排序方法

基于 Eisenhower Matrix：

| 象限 | 说明 | 处理 |
|------|------|------|
| urgent-important | 紧急且重要 | 立即处理 |
| important | 重要不紧急 | 计划处理 |
| urgent | 紧急不重要 | 委派或快速处理 |
| neither | 不紧急不重要 | 考虑放弃 |

## 使用

```bash
cog run task-prioritizer --args "修复登录bug(紧急), 写文档, 优化性能, 添加新功能" --pretty
```

## 输出示例

```json
{
  "prioritized_tasks": [
    {
      "rank": 1,
      "task_id": "修复登录bug",
      "priority_score": 95,
      "quadrant": "urgent-important",
      "reasoning": "影响所有用户，必须立即修复"
    },
    {
      "rank": 2,
      "task_id": "优化性能",
      "priority_score": 65,
      "quadrant": "important",
      "reasoning": "重要但不紧急"
    }
  ],
  "dependencies": [
    {
      "task_id": "优化性能",
      "blocked_by": [],
      "blocks": []
    }
  ],
  "recommendations": [
    "立即处理登录bug",
    "安排时间进行性能优化"
  ],
  "rationale": "根据 Eisenhower Matrix 进行分类...",
  "confidence": 0.88
}
```

## 输出字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `prioritized_tasks` | array | 排序后的任务列表 |
| `prioritized_tasks[].rank` | integer | 优先级排名 |
| `prioritized_tasks[].task_id` | string | 任务标识 |
| `prioritized_tasks[].priority_score` | number | 优先级分数 0-100 |
| `prioritized_tasks[].quadrant` | string | Eisenhower 象限 |
| `prioritized_tasks[].reasoning` | string | 排序理由 |
| `dependencies` | array | 依赖关系 |
| `recommendations` | array | 执行建议 |
| `rationale` | object | 排序思路 |
| `confidence` | number | 置信度 0-1 |
