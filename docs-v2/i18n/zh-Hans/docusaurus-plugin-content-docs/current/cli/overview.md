---
sidebar_position: 1
---

# CLI 概览（Node.js）

Cognitive Modules CLI 通过 npm 分发，命令为 `cog`。

## 安装

```bash
npx cogn@2.2.7 --help
npm install -g cogn@2.2.7
# 或：npm install -g cognitive-modules-cli@2.2.7
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `core <cmd>` | 极简路径：`new`/`run`/`schema`/`promote` |
| `list` | 列出模块 |
| `run <module>` | 运行模块 |
| `pipe --module <name>` | 管道模式 |
| `init [name]` | 初始化项目/创建模块 |
| `add <url>` | 从 GitHub 安装模块 |
| `update <module>` | 更新模块 |
| `versions <url>` | 查看可用版本 |
| `remove <module>` | 删除模块 |
| `compose <module>` | 组合执行 |
| `compose-info <module>` | 查看组合配置 |
| `validate <module>` | 校验模块 |
| `migrate <module>` | 迁移到 v2.2 |
| `serve` | 启动 HTTP API |
| `mcp` | 启动 MCP Server |
| `doctor` | 环境检查 |

## 常用流程

```bash
cog core new
cog core run demo.md --args "hello" --pretty
cog run code-reviewer --args "your code" --pretty
cog init my-module
cog validate my-module --v22
cog add Cognary/cognitive -m code-simplifier
cog compose code-review-pipeline --args "code" --trace
```

## 渐进复杂度（Profiles）

CLI 通过 `--profile` 实现“按需启用复杂度”的默认策略（并提供少量覆盖开关）：

| Profile | 场景 | 默认策略 |
|---------|------|----------|
| `core` | 5 分钟跑通，最少约束 | `--validate=off`，`--audit=false` |
| `default` | 日常使用 | `--validate=on`，`--audit=false` |
| `strict` | 更高可靠性/更强约束 | `--validate=on`，`--audit=false` |
| `certified` | 最强门禁/可发布流程 | `--validate=on`，`--audit=true`，并要求 v2.2 + registry provenance/完整性门禁 |

覆盖开关：

- `--validate auto|on|off`（兼容：`--no-validate` 等价于 `--validate off`）
- `--audit` 会把审计记录写入 `~/.cognitive/audit/`（路径输出到 stderr）

示例：

```bash
# 极简：跳过校验
cog run ./demo.md --args "hello" --profile core

# 更严格
cog run code-reviewer --args "..." --profile strict

# certified：拒绝 legacy 模块，并要求 registry provenance/完整性
cog run code-reviewer --args "..." --profile certified
```

## 可迁移/可发布（Registry Tarballs）

```bash
# 构建 tarball 资产，并生成/更新 cognitive-registry.v2.json
cog registry build --tag v2.2.7

# 校验本地 tarball 是否与 registry v2 索引一致（checksum/size/files）
cog registry verify --index cognitive-registry.v2.json --assets-dir dist/registry-assets

# 校验远端 registry（拉取 index + tarball 并校验完整性）
# 默认 "latest" registry index 策略：
#   https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json
cog registry verify --remote --index https://github.com/Cognary/cognitive/releases/latest/download/cognitive-registry.v2.json

# 固定到某个 release tag（推荐用于可复现构建）
cog registry verify --remote --index https://github.com/Cognary/cognitive/releases/download/v2.2.7/cognitive-registry.v2.json

# 调整远端校验限制（默认：15s、index 2MB、tarball 25MB）
cog registry verify --remote \
  --fetch-timeout-ms 20000 \
  --max-index-bytes 2097152 \
  --max-tarball-bytes 26214400

# 控制远端校验并发（默认：4；最大：8）
cog registry verify --remote --concurrency 2
```

## Registry 拉取严谨化（Index Client）

会读取 registry index 的命令（例如 `search`/`add`/`update`）使用带门禁的拉取策略：

- 超时（默认：10s）
- 最大 payload 字节数（默认：2MB，硬上限：20MB）

CLI 覆盖：

```bash
cog search "code" --registry-timeout-ms 15000 --registry-max-bytes 2097152
```

或环境变量：

```bash
export COGNITIVE_REGISTRY_TIMEOUT_MS=15000
export COGNITIVE_REGISTRY_MAX_BYTES=2097152
```
