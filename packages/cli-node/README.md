# Cognitive Modules CLI (Node.js)

[![npm version](https://badge.fury.io/js/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)

Node.js/TypeScript 版本的 Cognitive Modules CLI。

> 这是 [cognitive-modules](../../README.md) monorepo 的一部分。

## 安装

```bash
# 全局安装（推荐）
npm install -g cogn
# 或使用完整包名（同样提供 `cog` 命令）
# npm install -g cognitive-modules-cli

# 或使用 npx 零安装
npx cogn --help
```

## 快速开始

```bash
# 配置 LLM
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx

# 运行模块
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"

# 列出模块
cog list

# 管道模式
echo "review this code" | cog pipe --module code-reviewer
```

## 与 Python 版的功能对比

| 功能 | Python (`cog`) | Node.js (`cog`) |
|------|----------------|-----------------|
| 包名 | `cognitive-modules` | `cogn`（别名） / `cognitive-modules-cli`（主包） |
| 安装 | `pip install` | `npm install -g` |
| 子代理 | ✅ `@call:module` | ✅ `@call:module` |
| MCP Server | ✅ | ✅ |
| HTTP Server | ✅ | ✅ |
| v2.2 Envelope | ✅ | ✅ |

两个版本功能完全一致，共享相同的模块格式和 v2.2 规范。

**推荐使用 Node.js 版**：零安装快速体验 `npx cogn run ...`

## 支持的 Provider

| Provider | 环境变量 | 别名 |
|----------|----------|------|
| OpenAI | `OPENAI_API_KEY` | - |
| Anthropic | `ANTHROPIC_API_KEY` | - |
| Gemini | `GEMINI_API_KEY` | - |
| DeepSeek | `DEEPSEEK_API_KEY` | - |
| MiniMax | `MINIMAX_API_KEY` | - |
| Moonshot | `MOONSHOT_API_KEY` | `kimi` |
| Qwen | `DASHSCOPE_API_KEY` | `tongyi` |
| Ollama | `OLLAMA_HOST` | `local` |

## 命令

```bash
# 模块操作
cog list                      # 列出模块
cog run <module> --args "..." # 运行模块
cog add <url> -m <module>     # 从 GitHub 添加模块
cog update <module>           # 更新模块
cog remove <module>           # 删除模块
cog versions <url>            # 查看可用版本
cog init <name>               # 创建新模块
cog pipe --module <name>      # 管道模式

# 服务器
cog serve --port 8000         # 启动 HTTP API 服务
cog mcp                       # 启动 MCP 服务（Claude Code / Cursor）
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式运行
npm run dev -- run code-reviewer --args "..."
```

## License

MIT
