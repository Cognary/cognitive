---
sidebar_position: 1
---

# 安装（Node.js）

Cognitive Modules 2.2 通过 npm 分发，命令为 `cog`。

## 5 分钟跑通

如果你只是想体验 Cognitive，不需要先理解 registry / conformance / certification。

```bash
# 零安装（推荐）
npx cogn@2.2.7 --help

# 从本仓库安装一个模块
npx cogn@2.2.7 add Cognary/cognitive -m code-reviewer

# 运行（返回 v2.2 envelope）
npx cogn@2.2.7 run code-reviewer --args "def login(u,p): pass" --pretty
```

### 单文件模块（临时/即用）

你也可以用一个 Markdown 文件直接运行模块（可选 YAML frontmatter + prompt 正文）。

```bash
cat > demo-single-file.md <<'EOF'
---
name: demo-single-file
version: 0.1.0
responsibility: 单文件模块示例
tier: decision
---

请返回一个合法的 v2.2 envelope JSON（包含 meta 和 data）。
EOF

npx cogn@2.2.7 run ./demo-single-file.md --args "hello" --pretty
```

## 安装

```bash
# 零安装
npx cogn@2.2.7 --help

# 全局安装
npm install -g cogn@2.2.7
# 或：npm install -g cognitive-modules-cli@2.2.7
```

## 验证安装

```bash
cog --version
# 输出：Cognitive Runtime v2.2.7

cog doctor
```

## 安装模块

```bash
# 从 GitHub 安装模块（推荐）
cog add Cognary/cognitive -m code-simplifier

# 安装指定版本
cog add Cognary/cognitive -m code-reviewer --tag v1.0.0

# 列出模块
cog list
```

## 渐进复杂（可选）

只在需要时才开启更严格的部分：

- 需要 **可验证**：完善/收紧 `schema.json`，并执行 `cog validate --all`。
- 需要 **可审计**：强制 `meta.explain` + `data.rationale`，并落盘 envelope/事件流结果。
- 需要 **分发**：发布 registry index 与 GitHub Release tarball，再通过 `cog add <url>` 安装。
- 需要 **生态背书**：加入 conformance 测试与 certification 信号。

## 版本管理

```bash
cog update code-simplifier
cog update code-simplifier --tag v2.0.0
cog versions Cognary/cognitive
cog remove code-simplifier
```

## 模块搜索路径

1. `./cognitive/modules/`
2. `~/.cognitive/modules/`
