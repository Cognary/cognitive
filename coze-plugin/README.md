# Cognitive Modules - Coze 插件集成指南

本指南介绍如何将 Cognitive Modules 作为插件集成到 [Coze](https://coze.cn) 平台。

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                         Coze 平台                                │
│                                                                  │
│   用户 ──▶ Coze Bot ──▶ Cognitive 插件 ──▶ 结构化结果            │
│                              │                                   │
└──────────────────────────────│───────────────────────────────────┘
                               │ HTTP API
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Cognitive Server                              │
│                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│   │  code-reviewer  │  │ code-simplifier │  │  其他模块...     │ │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│                      LLM Provider                                │
│              (OpenAI / Anthropic / DeepSeek)                    │
└──────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 步骤 1：部署 Cognitive API 服务

#### 方式 A：Docker 部署（推荐）

```bash
# 1. 进入插件目录
cd cognitive-demo/coze-plugin

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写 API Key

# 3. 启动服务
docker-compose up -d

# 4. 验证服务
curl http://localhost:8000/health
```

#### 方式 B：直接运行

```bash
# 1. 安装依赖
pip install cognitive-modules[server]

# 2. 设置环境变量
export COGNITIVE_API_KEY="your-secret-key"
export OPENAI_API_KEY="sk-..."
export LLM_PROVIDER="openai"

# 3. 启动服务
cogn serve --port 8000
```

#### 方式 C：云服务部署

推荐平台：
- **Railway** - 一键部署
- **Render** - 免费额度
- **阿里云函数计算** - Serverless
- **腾讯云 SCF** - Serverless

### 步骤 2：获取公网访问地址

确保您的服务有公网可访问的 HTTPS 地址，例如：
- `https://cognitive.your-domain.com`
- `https://your-app.railway.app`
- `https://your-app.onrender.com`

### 步骤 3：在 Coze 创建自定义插件

1. 登录 [Coze 控制台](https://coze.cn)
2. 进入 **插件** → **创建插件**
3. 选择 **调用已有服务**（不是 Coze IDE）
4. 上传 OpenAPI 规范文件 `openapi.yaml`
5. 配置服务器地址和认证

#### 插件配置详情

| 配置项 | 值 |
|--------|-----|
| 插件名称 | Cognitive Modules |
| 插件描述 | 结构化 AI 任务执行框架 |
| 服务器地址 | `https://your-domain.com` |
| 认证方式 | API Token |
| API Token | 您设置的 `COGNITIVE_API_KEY` |

### 步骤 4：在 Bot 中使用插件

创建或编辑 Bot，添加 Cognitive 插件，然后在对话中使用：

**用户输入**:
> 帮我审查这段代码：def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')

**Bot 调用插件**:
```json
{
  "module": "code-reviewer",
  "args": "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"
}
```

**返回结果**:
```json
{
  "ok": true,
  "data": {
    "issues": [
      {
        "severity": "critical",
        "category": "security",
        "description": "SQL 注入漏洞",
        "suggestion": "使用参数化查询"
      }
    ],
    "confidence": 0.95,
    "rationale": "检测到字符串格式化直接用于 SQL 查询构建..."
  }
}
```

## 可用模块

| 模块 | 功能 | 示例输入 |
|------|------|----------|
| `code-reviewer` | 代码审查 | 代码片段 |
| `code-simplifier` | 代码简化 | 复杂代码 |
| `task-prioritizer` | 任务排序 | 任务列表 |
| `api-designer` | API 设计 | 需求描述 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/run` | POST | 执行模块 |
| `/modules` | GET | 列出模块 |
| `/modules/{name}` | GET | 模块详情 |
| `/health` | GET | 健康检查 |

## 高级配置

### 自定义模块

在服务器上添加自定义模块：

```bash
# 创建模块
cogn init my-module

# 编辑模块
vim cognitive/modules/my-module/MODULE.md

# 验证模块
cogn validate my-module
```

### 多 LLM 支持

在请求中指定不同的 LLM：

```json
{
  "module": "code-reviewer",
  "args": "your code",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022"
}
```

### 子代理模式

启用子代理编排（需要模块支持）：

```bash
cogn run product-analyzer --args "..." --subagent
```

## 工作流集成

在 Coze 工作流中使用 Cognitive：

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│  开始节点   │───▶│ Cognitive 插件  │───▶│  条件判断   │
│  (用户输入) │    │  code-reviewer  │    │ (confidence)│
└─────────────┘    └─────────────────┘    └─────────────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         ▼                      ▼                      ▼
                   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
                   │ 高置信度    │       │ 中置信度    │       │ 低置信度    │
                   │ 直接输出    │       │ 人工复核    │       │ 重新分析    │
                   └─────────────┘       └─────────────┘       └─────────────┘
```

## 故障排除

### 常见问题

**Q: 插件调用超时**
- 检查服务器网络连接
- 确认 LLM API Key 有效
- 适当增加超时时间

**Q: 认证失败**
- 确认 `COGNITIVE_API_KEY` 设置正确
- 检查请求头格式：`Authorization: Bearer <key>`

**Q: 模块不存在**
- 运行 `cogn list` 检查已安装模块
- 使用 `cogn add` 安装需要的模块

### 查看日志

```bash
# Docker 日志
docker-compose logs -f cognitive-api

# 直接运行时
cogn serve --port 8000 2>&1 | tee cognitive.log
```

## 安全建议

1. **必须设置 API Key** - 生产环境务必配置 `COGNITIVE_API_KEY`
2. **使用 HTTPS** - 确保通信加密
3. **限制来源** - 可在反向代理层配置 IP 白名单
4. **定期轮换** - 定期更换 API Key

## 更多资源

- [Cognitive Modules 文档](../README.md)
- [Coze 插件开发指南](https://www.coze.cn/open/docs/guides/plugin)
- [OpenAPI 规范](./openapi.yaml)
