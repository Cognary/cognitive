# 与 AI 工具集成

Cognitive Modules 可以与各种 AI 工具无缝集成。

## Cursor / VS Code

### 方式 1：直接对话

在 Cursor 中直接输入：

```
读取 ~/.cognitive/modules/code-reviewer/MODULE.md，
审查这段代码：

def login(u, p):
    return db.query(f"SELECT * FROM users WHERE name={u}")
```

### 方式 2：AGENTS.md 约定

在项目根目录创建 `AGENTS.md`：

```markdown
# 项目 AI 规范

## 代码审查

当需要审查代码时：
1. 读取 `~/.cognitive/modules/code-reviewer/MODULE.md`
2. 按 `schema.json` 格式输出
3. 必须包含 issues、summary、rationale、confidence

## UI 规范

当需要设计 UI 时：
1. 读取 `~/.cognitive/modules/ui-spec-generator/MODULE.md`
2. 生成完整的 UI 规范
3. 保存到 `ui-spec.json`
```

## Codex CLI

```bash
# 在 Codex 对话中
> 使用 code-reviewer 模块审查 src/auth.py
```

## Claude Desktop

### 方式 1：System Prompt

```
你可以使用以下 Cognitive Module：

1. code-reviewer - 代码审查
   读取 ~/.cognitive/modules/code-reviewer/MODULE.md

2. task-prioritizer - 任务排序
   读取 ~/.cognitive/modules/task-prioritizer/MODULE.md

使用时遵循模块中的指令和 schema。
```

### 方式 2：包装成 Skill

```yaml
# ~/.claude/skills/code-review/SKILL.md
---
name: code-review
description: 使用 Cognitive Module 审查代码
---

执行 ~/.cognitive/modules/code-reviewer/MODULE.md
```

## GitHub Copilot

在 `.github/copilot-instructions.md` 中：

```markdown
## 代码审查

使用 Cognitive Module 格式进行代码审查：
- 输出 JSON 格式
- 包含 issues 数组
- 每个 issue 有 severity、category、description、suggestion
- 包含 confidence 0-1
```

## 通用集成模式

```
用户请求
    ↓
AI 工具读取 MODULE.md
    ↓
按 schema.json 生成输出
    ↓
返回结构化结果
```

关键点：

1. AI 工具用自己的 LLM，不需要调用 cog CLI
2. MODULE.md 作为"可执行的规范"
3. schema.json 确保输出格式一致
