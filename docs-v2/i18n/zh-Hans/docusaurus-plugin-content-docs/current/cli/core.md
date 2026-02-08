---
sidebar_position: 2
---

# core

`core` 是 Cognitive Modules 的极简「单文件」工作流。

它的设计目标是：

- 5 分钟跑通（不需要 registry / conformance）。
- 需要可迁移时，可以一键升级为标准 v2 模块目录。

## 命令

### 1) 创建单文件模块

```bash
npx cogn@2.2.13 core new            # 生成 ./demo.md
npx cogn@2.2.13 core new my.md
```

### 2) 运行（文件）

```bash
npx cogn@2.2.13 core run demo.md --args "hello" --pretty
```

### 3) 运行（STDIN，零文件）

```bash
cat <<'EOF' | npx cogn@2.2.13 core run --stdin --args "hello" --pretty
请返回一个合法的 v2.2 envelope。把结果放在 data.result。
EOF
```

### 4) 升级为 v2 模块目录

```bash
# 默认输出：./cognitive/modules/<module-name>/
npx cogn@2.2.13 core promote demo.md

# 自定义输出目录
npx cogn@2.2.13 core promote demo.md ./cognitive/modules/demo
```

`promote` 会额外生成最小 golden tests：

- `tests/smoke.input.json`
- `tests/smoke.expected.json`（schema 校验模式：`$validate`）

### 5) 覆盖已有目标目录

```bash
npx cogn@2.2.13 core promote demo.md ./cognitive/modules/demo --force
```

## 为什么重要

`core` 提供了低门槛起步，同时保留了明确的升级路径：

- 从一个 `.md` 文件开始。
- 需要可迁移/可发布时，一键升级到 `module.yaml/prompt.md/schema.json/tests/`。
