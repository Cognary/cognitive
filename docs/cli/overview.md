# CLI 命令概览

Cognitive Modules 提供 `cog` 命令行工具。

## 安装

```bash
pip install cognitive-modules
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `cog list` | 列出已安装模块 |
| `cog info <module>` | 查看模块详情 |
| `cog run <module>` | 运行模块 |
| `cog validate <module>` | 验证模块 |
| `cog init <name>` | 创建新模块 |
| `cog add <url>` | 从 GitHub 安装模块（推荐） |
| `cog update <module>` | 更新模块到最新版本 |
| `cog versions <url>` | 查看可用版本 |
| `cog remove <module>` | 删除模块 |
| `cog install <source>` | 安装模块（兼容方式） |
| `cog uninstall <module>` | 卸载模块 |
| `cog search <query>` | 搜索注册表 |
| `cog registry` | 查看注册表 |
| `cog doctor` | 环境检查 |

## 全局选项

```bash
cog --version  # 显示版本
cog --help     # 显示帮助
```

## 常用工作流

### 1. 使用内置模块

```bash
# 查看可用模块
cog list

# 查看模块详情
cog info code-reviewer

# 运行模块
cog run code-reviewer --args "你的代码" --pretty
```

### 2. 创建自定义模块

```bash
# 创建骨架
cog init my-module -d "模块描述"

# 编辑 MODULE.md 和 schema.json
# ...

# 验证
cog validate my-module

# 全局安装
cog install ./cognitive/modules/my-module
```

### 3. 安装社区模块

```bash
# 从 GitHub 安装（推荐）
cog add ziel-io/cognitive-modules -m code-simplifier

# 安装指定版本
cog add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

# 查看可用版本
cog versions ziel-io/cognitive-modules

# 搜索注册表
cog search "code review"

# 从注册表安装
cog install registry:code-reviewer
```

### 4. 版本管理

```bash
# 更新模块到最新版本
cog update code-simplifier

# 更新到指定版本
cog update code-simplifier --tag v2.0.0

# 查看模块安装信息
cog info code-simplifier

# 删除模块
cog remove code-simplifier
```
