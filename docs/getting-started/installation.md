# 安装

## 使用 pip 安装

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

## 验证安装

```bash
cog --version
# 输出: cog version 0.1.0

cog doctor
```

`cog doctor` 会显示环境状态：

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

## 从源码安装

```bash
git clone https://github.com/leizii/cognitive-modules.git
cd cognitive-modules

# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v
```

## 下一步

- [配置 LLM](llm-config.md) - 配置 AI 后端
- [第一个模块](first-module.md) - 创建你的第一个模块
