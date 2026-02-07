# Cognitive Modules CLI (Node.js)

[![npm version](https://badge.fury.io/js/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)

Node.js/TypeScript 版本的 Cognitive Modules CLI，提供 `cog` 命令。

> 这是 [cognitive-modules](../../README.md) monorepo 的一部分。

## 安装

```bash
# 全局安装（推荐）
npm install -g cogn@2.2.7
# 或使用完整包名（同样提供 `cog` 命令）
# npm install -g cognitive-modules-cli@2.2.7

# 或使用 npx 零安装
npx cogn@2.2.7 --help
```

## 快速开始

```bash
# 配置 LLM
export OPENAI_API_KEY=sk-xxx

# 运行模块
cog run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 列出模块
cog list

# 管道模式
echo "review this code" | cog pipe --module code-reviewer
```

## 支持的 Provider

| Provider | 环境变量 | 说明 |
|----------|----------|------|
| OpenAI | `OPENAI_API_KEY` | OpenAI API |
| Anthropic | `ANTHROPIC_API_KEY` | Claude |
| Gemini | `GEMINI_API_KEY` | Google Gemini |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek |
| MiniMax | `MINIMAX_API_KEY` | MiniMax |
| Moonshot | `MOONSHOT_API_KEY` | Kimi |
| Qwen | `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | 通义千问 |
| Ollama | `OLLAMA_HOST` | 本地模型 |

## 命令

```bash
# Core（单文件极简路径）
cog core new                       # 生成 demo.md
cog core run demo.md --args "..."  # 运行单文件模块
cog core promote demo.md           # 升级为 v2 模块目录

# 渐进复杂度（Profiles）
cog run code-reviewer --args "..." --profile core       # 极简：跳过校验
cog run code-reviewer --args "..." --profile default    # 默认：开启校验
cog run code-reviewer --args "..." --profile strict     # 更严格：开启校验（更强门禁）
cog run code-reviewer --args "..." --profile certified  # 最严格：v2.2 + 审计 + registry provenance/完整性门禁
# 覆盖开关：--validate auto|on|off，--audit（写入 ~/.cognitive/audit/）

# 模块操作
cog list                      # 列出模块
cog run <module> --args "..." # 运行模块
cog add <url> -m <module>     # 从 GitHub 添加模块
cog update <module>           # 更新模块
cog remove <module>           # 删除模块
cog versions <url>            # 查看可用版本
cog init <name>               # 创建新模块
cog pipe --module <name>      # 管道模式

# 组合执行
cog compose <module> --args "..."
cog compose-info <module>

# 校验与迁移
cog validate <module> --v22
cog validate --all
cog migrate <module> --dry-run
cog migrate --all --no-backup

# 服务器
cog serve --port 8000         # 启动 HTTP API 服务
cog mcp                       # 启动 MCP 服务（Claude Code / Cursor）

# 环境检查
cog doctor

# Registry（索引与分发）
# 默认 registry index（latest）：
#   https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
# 可通过环境变量或全局参数覆盖：
COGNITIVE_REGISTRY_URL=... cog search
COGNITIVE_REGISTRY_TIMEOUT_MS=15000 COGNITIVE_REGISTRY_MAX_BYTES=2097152 cog search
cog search --registry https://github.com/Cognary/cognitive/releases/download/v2.2.7/cognitive-registry.v2.json
cog registry verify --remote --index https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
cog registry verify --remote --concurrency 2
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

## 发布前检查

```bash
# 完整发布检查（构建 + 测试 + npm 打包清单）
npm run release:check
```

## License

MIT
