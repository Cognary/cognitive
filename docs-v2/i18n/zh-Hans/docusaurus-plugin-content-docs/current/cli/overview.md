---
sidebar_position: 1
---

# CLI 命令概览

Cognitive Modules 提供两个命令行工具：

| 平台 | 包名 | 命令 |
|------|------|------|
| pip | `cognitive-modules` | `cogn` |
| npm | `cognitive-modules-cli` | `cog` |

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## 安装

<Tabs>
<TabItem value="pip" label="Python (pip)">

```bash
pip install cognitive-modules
```

</TabItem>
<TabItem value="npm" label="Node.js (npm)">

```bash
npm install -g cognitive-modules-cli
```

</TabItem>
<TabItem value="npx" label="npx (零安装)">

```bash
npx cognitive-modules-cli <command>
```

</TabItem>
</Tabs>

## 命令列表

| 命令 | 说明 |
|------|------|
| `list` | 列出已安装模块 |
| `info <module>` | 查看模块详情 |
| `run <module>` | 运行模块 |
| `validate <module>` | 验证模块 |
| `init <name>` | 创建新模块 |
| `add <url>` | 从 GitHub 安装模块（推荐） |
| `update <module>` | 更新模块到最新版本 |
| `versions <url>` | 查看可用版本 |
| `remove <module>` | 删除模块 |
| `install <source>` | 安装模块（兼容方式） |
| `uninstall <module>` | 卸载模块 |
| `search <query>` | 搜索注册表 |
| `registry` | 查看注册表 |
| `doctor` | 环境检查 |

## 全局选项

```bash
cogn --version  # 显示版本 (pip)
cog --version   # 显示版本 (npm)
cogn --help     # 显示帮助
```

## 常用工作流

:::note 命令名称
以下示例使用 `cogn`（pip 版本）。如果使用 npm 版本，请将 `cogn` 替换为 `cog`。
:::

### 1. 使用内置模块

```bash
# 查看可用模块
cogn list

# 查看模块详情
cogn info code-reviewer

# 运行模块
cogn run code-reviewer --args "你的代码" --pretty
```

### 2. 创建自定义模块

```bash
# 创建骨架
cogn init my-module -d "模块描述"

# 编辑 MODULE.md 和 schema.json
# ...

# 验证
cogn validate my-module

# 全局安装
cogn install ./cognitive/modules/my-module
```

### 3. 安装社区模块

```bash
# 从 GitHub 安装（推荐）
cogn add ziel-io/cognitive-modules -m code-simplifier

# 安装指定版本
cogn add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# 查看可用版本
cogn versions ziel-io/cognitive-modules

# 搜索注册表
cogn search "code review"

# 从注册表安装
cogn install registry:code-reviewer
```

### 4. 版本管理

```bash
# 更新模块到最新版本
cogn update code-simplifier

# 更新到指定版本
cogn update code-simplifier --tag v2.0.0

# 查看模块安装信息
cogn info code-simplifier

# 删除模块
cogn remove code-simplifier
```

### 5. npx 零安装使用

```bash
# 无需安装，直接使用
npx cognitive-modules-cli add ziel-io/cognitive-modules -m code-simplifier
npx cognitive-modules-cli run code-simplifier --args "代码"
```
