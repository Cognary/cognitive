# Cognitive Protocol

> **开放认知协议 — 让 AI 输出可验证、可审计、可编排**

---

## 一句话说明

Cognitive 是一个开放协议，定义 AI 任务的输入/输出契约，让 LLM 输出像 API 一样可验证。

---

## 核心概念

```
Module = Manifest + Prompt + Contract
```

| 文件 | 职责 |
|------|------|
| `module.yaml` | 模块配置（tier、策略） |
| `prompt.md` | LLM 指令 |
| `schema.json` | **Contract**：输入/输出/错误的 JSON Schema |

---

## 响应格式 (Envelope v2.2)

```json
{
  "ok": true,
  "meta": {
    "confidence": 0.92,
    "risk": "low",
    "explain": "简短摘要（≤280字符）"
  },
  "data": {
    "...业务字段...",
    "rationale": "详细推理过程"
  }
}
```

| 层 | 字段 | 用途 |
|---|------|------|
| **Control Plane** | `meta.confidence` | 路由/降级决策 |
| **Control Plane** | `meta.risk` | 人工审核触发 |
| **Control Plane** | `meta.explain` | 日志/UI 卡片 |
| **Data Plane** | `data.*` | 业务结果 |
| **Data Plane** | `data.rationale` | 完整审计 |

---

## 为什么原生支持？

### 对 AI IDE（Cursor/Claude Code/Kimi Code）的收益

| 收益 | 说明 |
|------|------|
| **结构化输出** | 用户说"用 code-reviewer 模块审查"，直接按 schema 输出 |
| **可测试** | 模块有 Contract，可以写黄金测试 |
| **可审计** | 每次输出有 confidence + rationale |
| **可编排** | 模块间可以安全组合（子代理） |
| **零配置** | 用户只需一个模块目录，无需额外 API 调用 |

### 对用户的收益

| 收益 | 说明 |
|------|------|
| **确定性** | 知道 AI 会返回什么结构 |
| **可复用** | 模块可以分享、安装、版本管理 |
| **可信任** | 有 confidence 和 risk 指示 |

---

## 最小实现

AI IDE 原生支持 Cognitive 只需：

### 1. 识别模块目录

```
~/.cognitive/modules/<module-name>/
├── module.yaml
├── prompt.md
└── schema.json
```

### 2. 读取 Contract

```javascript
// 伪代码
const schema = JSON.parse(fs.readFileSync('schema.json'));
const inputSchema = schema.input;
const outputSchema = { meta: schema.meta, data: schema.data };
```

### 3. 按 Contract 输出

当用户说：
> "用 code-reviewer 模块审查这段代码"

AI IDE 应该：
1. 读取 `~/.cognitive/modules/code-reviewer/prompt.md`
2. 按 `schema.json#/meta` + `schema.json#/data` 格式输出
3. 输出符合 Envelope v2.2 格式

---

## 协议核心原则

| 原则 | 说明 |
|------|------|
| **Contract-first** | 输入/输出必须可验证 |
| **Control/Data 分离** | meta 用于路由，data 用于业务 |
| **Tier 分级** | exec / decision / exploration 不同约束 |
| **Overflow 可回收** | 额外洞察不丢失，可纳入未来 schema |

---

## 现有生态

| 平台 | 状态 |
|------|------|
| PyPI | `pip install cognitive-modules` ✅ |
| npm | `npx cogn` ✅ |
| MCP | `cog mcp` (Claude Desktop) ✅ |
| HTTP API | `cog serve` ✅ |

---

## 链接

- **GitHub**: https://github.com/ziel-io/cognitive-modules
- **文档**: https://ziel-io.github.io/cognitive-modules/
- **规范**: [SPEC-v2.2.md](./SPEC-v2.2.md)

---

## 联系

如有兴趣原生支持 Cognitive Protocol，欢迎联系：

- GitHub Issues: https://github.com/ziel-io/cognitive-modules/issues
- Email: [your-email]

---

**Cognitive Protocol** — 让每一次 AI 输出都可验证
