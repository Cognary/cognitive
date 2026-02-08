# Cognitive Modules CLI (Node.js)

[![npm version](https://badge.fury.io/js/cognitive-modules-cli.svg)](https://www.npmjs.com/package/cognitive-modules-cli)

Node.js/TypeScript 版本的 Cognitive Modules CLI。文档统一使用明确入口 `npx cogn@2.2.11 ...`，避免 PATH/命令冲突。

> 这是 [cognitive-modules](../../README.md) monorepo 的一部分。

## 安装

```bash
# 零安装（推荐）
npx cogn@2.2.11 --help

# 全局安装（可选）
npm install -g cogn@2.2.11
# 或：npm install -g cognitive-modules-cli@2.2.11
```

## 快速开始

```bash
# 配置 LLM
export OPENAI_API_KEY=sk-xxx

# 查看 providers 能力矩阵（结构化输出/流式）
npx cogn@2.2.11 providers --pretty

# 运行模块
npx cogn@2.2.11 run code-reviewer --args "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')" --pretty

# 列出模块
npx cogn@2.2.11 list

# 管道模式
echo "review this code" | npx cogn@2.2.11 pipe --module code-reviewer
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
npx cogn@2.2.11 core new                       # 生成 demo.md
npx cogn@2.2.11 core run demo.md --args "..."  # 运行单文件模块
npx cogn@2.2.11 core promote demo.md           # 升级为 v2 模块目录

# 渐进复杂度（Profiles）
npx cogn@2.2.11 run code-reviewer --args "..." --profile core       # 极简：跳过校验
npx cogn@2.2.11 run code-reviewer --args "..." --profile default    # 默认：开启校验
npx cogn@2.2.11 run code-reviewer --args "..." --profile strict     # 更严格：开启校验（更强门禁）
npx cogn@2.2.11 run code-reviewer --args "..." --profile certified  # 最严格：v2.2 + 审计 + registry provenance/完整性门禁
# 覆盖开关：
# - --validate auto|on|off
# - --structured auto|off|prompt|native（provider 层结构化输出策略）
# - --audit（写入 ~/.cognitive/audit/）

# 模块操作
npx cogn@2.2.11 list                      # 列出模块
npx cogn@2.2.11 run <module> --args "..." # 运行模块
npx cogn@2.2.11 add <url> -m <module>     # 从 GitHub 添加模块
npx cogn@2.2.11 update <module>           # 更新模块
npx cogn@2.2.11 remove <module>           # 删除模块
npx cogn@2.2.11 versions <url>            # 查看可用版本
npx cogn@2.2.11 init <name>               # 创建新模块
npx cogn@2.2.11 pipe --module <name>      # 管道模式

# 组合执行
npx cogn@2.2.11 compose <module> --args "..."
npx cogn@2.2.11 compose-info <module>

# 校验与迁移
npx cogn@2.2.11 validate <module> --v22
npx cogn@2.2.11 validate --all
npx cogn@2.2.11 migrate <module> --dry-run
npx cogn@2.2.11 migrate --all --no-backup

# 服务器
npx cogn@2.2.11 serve --port 8000         # 启动 HTTP API 服务
npx cogn@2.2.11 mcp                       # 启动 MCP 服务（Claude Code / Cursor）

# 环境检查
npx cogn@2.2.11 doctor

# Registry（索引与分发）
# 默认 registry index（latest）：
#   https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
# 可通过环境变量或全局参数覆盖：
COGNITIVE_REGISTRY_URL=... npx cogn@2.2.11 search
COGNITIVE_REGISTRY_TIMEOUT_MS=15000 COGNITIVE_REGISTRY_MAX_BYTES=2097152 npx cogn@2.2.11 search
npx cogn@2.2.11 search --registry https://github.com/Cognary/cognitive/releases/download/v2.2.11/cognitive-registry.v2.json
npx cogn@2.2.11 registry verify --remote --index https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
npx cogn@2.2.11 registry verify --remote --concurrency 2
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
