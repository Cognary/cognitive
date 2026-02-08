# Cognitive Modules 集成指南（Node.js CLI）

本文档面向 AI Agent 工具（如 Cursor、Claude Code、工作流平台）集成 Cognitive Modules。

## 集成方式

| 方式 | 适用场景 | 说明 |
|------|----------|------|
| **MCP Server** | Claude Desktop、Cursor 等 AI 工具 | `npx cogn@2.2.12 mcp` |
| **HTTP API** | n8n、Coze、Dify 等工作流平台 | `npx cogn@2.2.12 serve` |
| **CLI** | 命令行/脚本 | `npx cogn@2.2.12 run` |

> 本仓库的文档统一以 `npx cogn@2.2.12 ...` 作为权威入口，以避免本机 PATH 上存在其他同名命令导致的错觉。

---

## MCP Server（推荐）

MCP 是 Anthropic 推出的标准协议，Claude Desktop 和 Cursor 原生支持。

### 启动

```bash
npx cogn@2.2.12 mcp
```

### 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "cognitive": {
      "command": "npx",
      "args": ["cogn@2.2.12", "mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### 暴露的工具

| Tool | 说明 |
|------|------|
| `cognitive_run(module, args, provider?, model?)` | 运行模块 |
| `cognitive_list()` | 列出所有模块 |
| `cognitive_info(module)` | 获取模块详情 |

---

## HTTP API

### 启动

```bash
npx cogn@2.2.12 serve --port 8000
```

### 请求示例

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "module": "code-reviewer",
    "args": "def login(u,p): return db.query(f\\"SELECT * FROM users WHERE name={u}\\")",
    "provider": "openai",
    "model": "gpt-4o"
  }'
```

---

## 模块发现

### 标准路径

```
./cognitive/modules/           # 项目本地
~/.cognitive/modules/          # 用户全局
```

### 发现算法（逻辑示意）

```
for each base in search_paths:
  if base/<module>/module.yaml exists -> use it
  else if base/<module>/MODULE.md exists -> use it (legacy)
```

---

## 模块格式

### v2 格式（推荐）

```
module-name/
├── module.yaml    # 元数据
├── prompt.md      # 执行指令
├── schema.json    # 输入/输出 Schema
└── tests/         # 测试用例
```

### v1 格式（兼容）

```
module-name/
├── MODULE.md      # 元数据 + 指令（YAML frontmatter）
└── schema.json    # Schema
```

---

## 执行协议（概念级）

1. **构建 Prompt**：将模块 prompt 与输入拼装
2. **执行**：调用 LLM
3. **校验**：按 JSON Schema 验证输出，并保证 v2.2 envelope

---

## 编程集成（Node.js）

`cognitive-modules-cli` 同时提供运行时 API：

```ts
import { runModule, loadModule, getProvider } from 'cognitive-modules-cli';

const provider = getProvider('openai', 'gpt-4o');
const module = await loadModule('./cognitive/modules/code-reviewer');
const result = await runModule(module, provider, { args: 'your code' });
console.log(result);
```
