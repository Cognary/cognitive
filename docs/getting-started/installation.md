# 安装

## Python (pip)

```bash
# 基础安装
pip install cognitive-modules

# 带 OpenAI 支持
pip install cognitive-modules[openai]

# 带 Anthropic 支持
pip install cognitive-modules[anthropic]

# 全部 LLM 支持
pip install cognitive-modules[all]
```

## Node.js (npm)

```bash
# 全局安装
npm install -g cogn

# 或 npx 零安装使用（推荐）
npx cogn --help
```

## 命令对照

| 平台 | 包名 | 命令 |
|------|------|------|
| pip | `cognitive-modules` | `cogn` |
| npm | `cogn` | `cog` |

## 验证安装

=== "Node.js (cog) - 推荐"

    ```bash
    cog --version
    # 输出: Cognitive Runtime v1.3.0

    cog doctor
    ```

=== "Python (cogn)"

    ```bash
    cogn --version
    # 输出: cog version 0.5.1

    cogn doctor
    ```

`cogn doctor` / `cog doctor` 会显示环境状态：

```
Cognitive Modules - Environment Check

            LLM Providers             
┏━━━━━━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━┓
┃ Provider  ┃ Installed ┃ Configured ┃
┡━━━━━━━━━━━╇━━━━━━━━━━━╇━━━━━━━━━━━━┩
│ openai    │ ✓         │ ✓          │
│ anthropic │ ✗         │ –          │
│ minimax   │ ✓         │ –          │
│ ollama    │ ✗         │ –          │
└───────────┴───────────┴────────────┘

Installed Modules: 5
```

## 安装模块

安装 CLI 后，可以从 GitHub 添加模块：

=== "Python (cogn)"

    ```bash
    # 从 GitHub 安装模块（推荐）
    cogn add ziel-io/cognitive-modules -m code-simplifier

    # 安装指定版本
    cogn add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

    # 查看已安装模块
    cogn list
    ```

=== "Node.js (cog)"

    ```bash
    # 从 GitHub 安装模块（推荐）
    cog add ziel-io/cognitive-modules -m code-simplifier

    # 安装指定版本
    cog add ziel-io/cognitive-modules -m code-reviewer --tag v1.0.0

    # 查看已安装模块
    cog list
    ```

=== "npx (零安装)"

    ```bash
    # 无需安装，直接使用
    npx cogn add ziel-io/cognitive-modules -m code-simplifier
    ```

### 版本管理

```bash
# 更新模块到最新版本
cogn update code-simplifier  # 或 cog update

# 更新到指定版本
cogn update code-simplifier --tag v2.0.0

# 查看可用版本
cogn versions ziel-io/cognitive-modules

# 删除模块
cogn remove code-simplifier
```

### 模块存放位置

模块按优先级从以下位置加载：

1. `./cognitive/modules/` - 项目本地
2. `~/.cognitive/modules/` - 用户全局（`cogn add` / `cog add` 安装位置）
3. 包内置模块

### 其他安装方式

```bash
# Git 仓库
cogn install github:user/repo/path/to/module

# 公共注册表
cogn install registry:module-name

# 本地路径
cogn install ./path/to/module
```

## 从源码安装

```bash
git clone https://github.com/ziel-io/cognitive-modules.git
cd cognitive-modules

# 安装开发依赖
pip install ".[dev]"

# 运行测试
pytest tests/ -v
```

## 下一步

- [配置 LLM](llm-config.md) - 配置 AI 后端
- [第一个模块](first-module.md) - 创建你的第一个模块
