---
sidebar_position: 2
---

# cog core

`cog core` 是 Cognitive Modules 的极简「单文件」工作流。

它的设计目标是：

- 5 分钟跑通（不需要 registry / conformance）。
- 需要可迁移时，可以一键升级为标准 v2 模块目录。

## 可用性说明

如果你是通过 npm 安装的 `cogn@2.2.7`，可能暂时还没有 `cog core`。
本页描述的是当前仓库 `main` 分支的行为。

## 命令

### 1) 创建单文件模块

```bash
cog core new            # 生成 ./demo.md
cog core new my.md
```

### 2) 运行（文件）

```bash
cog core run demo.md --args "hello" --pretty
```

### 3) 运行（STDIN，零文件）

```bash
cat <<'EOF' | cog core run --stdin --args "hello" --pretty
请返回一个合法的 v2.2 envelope。把结果放在 data.result。
EOF
```

### 4) 升级为 v2 模块目录

```bash
# 默认输出：./cognitive/modules/<module-name>/
cog core promote demo.md

# 自定义输出目录
cog core promote demo.md ./cognitive/modules/demo
```

`promote` 会额外生成最小 golden tests：

- `tests/smoke.input.json`
- `tests/smoke.expected.json`（schema 校验模式：`$validate`）

### 5) 覆盖已有目标目录

```bash
cog core promote demo.md ./cognitive/modules/demo --force
```

## 为什么重要

`core` 提供了低门槛起步，同时保留了明确的升级路径：

- 从一个 `.md` 文件开始。
- 需要可迁移/可发布时，一键升级到 `module.yaml/prompt.md/schema.json/tests/`。

