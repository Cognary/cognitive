# TypeScript Runtime

除了 Python CLI，Cognitive Modules 还提供了独立的 TypeScript 运行时 `cognitive-runtime`。

## 安装

```bash
npm install -g cognitive-runtime
```

## 使用

```bash
# 运行模块
cog run code-reviewer --args "def foo(): pass" --pretty

# 列出可用模块
cog list

# 管道模式
echo '{"code": "x = 1+2+3"}' | cog pipe code-simplifier

# 检查环境
cog doctor
```

## 与 Python 版本的区别

| 特性 | Python (`cognitive-modules`) | TypeScript (`cognitive-runtime`) |
|------|:----------------------------:|:--------------------------------:|
| 包管理器 | pip | npm |
| 命令 | `cog` | `cog` |
| v2 格式支持 | ✅ | ✅ |
| v1 格式支持 | ✅ | ✅ |
| 子代理编排 | ✅ | ⚠️ 开发中 |
| 模块注册表 | ✅ | ⚠️ 开发中 |

## LLM Provider 配置

TypeScript 版本支持更多 LLM Provider：

| Provider | 环境变量 | 默认模型 |
|----------|----------|----------|
| Gemini | `GEMINI_API_KEY` | gemini-2.5-flash |
| OpenAI | `OPENAI_API_KEY` | gpt-4.1 |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| MiniMax | `MINIMAX_API_KEY` | MiniMax-Text-01 |
| Moonshot | `MOONSHOT_API_KEY` | moonshot-v1-128k |
| Qwen | `QWEN_API_KEY` | qwen-max |
| Ollama | `OLLAMA_HOST` | llama3.3 |

### 自定义模型

```bash
# 通过环境变量
export COG_MODEL=gpt-4-turbo
cog run code-reviewer --args "code"

# 通过命令行参数
cog run code-reviewer --model gpt-4-turbo --args "code"
```

## 程序化 API

```typescript
import { loadModule, runModule, getProvider } from 'cognitive-runtime';

// 加载模块
const module = await loadModule('./cognitive/modules/code-simplifier');

// 获取 Provider
const provider = getProvider('openai');

// 运行模块
const result = await runModule(module, provider, {
  code: 'x = 1 + 2 + 3',
  language: 'python'
});

console.log(result.simplified);
console.log(result.confidence);
```

## 模块搜索路径

TypeScript Runtime 按以下顺序搜索模块：

1. `./cognitive/modules/`
2. `~/.cognitive/modules/`
3. 全局安装的模块

## 源码

- **npm**: [cognitive-runtime](https://www.npmjs.com/package/cognitive-runtime)
- **GitHub**: 位于 `cognitive-runtime/` 目录
