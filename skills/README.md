# Cognitive Skills

这是 Cognitive Modules 的 Skills 包装层，让 Cursor/Codex/Claude 等 AI 工具可以直接识别和使用。

## 目录结构

```
skills/
├── code-reviewer/SKILL.md      # 代码审查
├── api-designer/SKILL.md       # API 设计
├── task-prioritizer/SKILL.md   # 任务排序
├── ui-spec-generator/SKILL.md  # UI 规范
└── product-analyzer/SKILL.md   # 产品分析
```

## 使用方式

### 方式 1：通过 Skills（推荐）

AI 工具会自动识别 `SKILL.md` 文件，根据用户意图调用对应的 Skill。

### 方式 2：直接使用 Cognitive

```bash
cog run <module-name> --args "输入" --pretty
```

## 两者关系

```
┌─────────────────────────────────────┐
│  Cursor / Codex / Claude           │
│  (识别 SKILL.md)                    │
└─────────────┬───────────────────────┘
              │ 调用
              ▼
┌─────────────────────────────────────┐
│  skills/xxx/SKILL.md               │
│  (包装层，说明如何调用)              │
└─────────────┬───────────────────────┘
              │ 执行
              ▼
┌─────────────────────────────────────┐
│  cog run xxx --args "..."          │
│  (Cognitive CLI)                    │
└─────────────┬───────────────────────┘
              │ 加载
              ▼
┌─────────────────────────────────────┐
│  cognitive/modules/xxx/            │
│  (MODULE.md + schema.json)         │
└─────────────────────────────────────┘
```

## 为什么这样设计？

- **Skills** = 让 AI 工具知道"有这个能力"
- **Cognitive** = 真正执行任务，保证输出可验证

这样 Cognitive Modules 可以：
1. 被 Cursor/Codex 原生识别（通过 Skills）
2. 独立使用（通过 CLI）
3. 嵌入其他工具链（通过 Python API）
