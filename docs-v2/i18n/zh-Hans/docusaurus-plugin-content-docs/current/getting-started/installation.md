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

如果你已经有 `cog core`，最小路径可以做到“零文件”：

```bash
cat <<'EOF' | cog core run --stdin --args "hello" --pretty
请返回一个合法的 v2.2 envelope（meta + data）。把答案放在 data.result。
EOF
```

或者生成模板文件：

```bash
cog core new demo.md
cog core run demo.md --args "hello" --pretty
```

然后一键升级为可迁移的 v2 模块目录：

```bash
cog core promote demo.md
```

如果你暂时还没有 `cog core`，下面的“文件方式”在任何版本都可用：

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

只在需要时才引入复杂度。Cognitive 2.2 的设计目标是：既能让你 5 分钟跑通，也能逐步演进到“协议级”的严谨体系，
而不强迫所有人一上来就把 registry / conformance / certification 全部吃下去。

下一步建议阅读：[渐进复杂（升级触发器）](./progressive-complexity)

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
