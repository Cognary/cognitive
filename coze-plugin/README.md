# Cognitive Modules - Coze 插件集成指南

本指南介绍如何将 Cognitive Modules 作为插件集成到 [Coze](https://coze.cn) 平台（通过 HTTP API）。

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
└──────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 步骤 1：部署 Cognitive API 服务

#### 方式 A：Docker 部署（推荐）

```bash
cd cognitive-demo/coze-plugin
cp .env.example .env
# 编辑 .env 文件，填写 API Key
docker-compose up -d
curl http://localhost:8000/health
```

#### 方式 B：直接运行

```bash
npm install -g cogn@2.2.7

export COGNITIVE_API_KEY="your-secret-key"
export OPENAI_API_KEY="sk-..."

npx cogn@2.2.12 serve --port 8000
```

### 步骤 2：获取公网访问地址

确保服务有公网 HTTPS 地址，例如：
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
| API Token | `COGNITIVE_API_KEY` |

### 步骤 4：在 Bot 中使用插件

**用户输入**:
> 帮我审查这段代码：def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')

**Bot 调用插件**:
```json
{
  "module": "code-reviewer",
  "args": "def login(u,p): return db.query(f'SELECT * FROM users WHERE name={u}')"
}
```

**返回结果（v2.2）**:
```json
{
  "ok": true,
  "meta": {
    "confidence": 0.95,
    "risk": "high",
    "explain": "Detected SQL injection"
  },
  "data": {
    "issues": [
      {
        "severity": "critical",
        "category": "security",
        "description": "SQL 注入漏洞",
        "suggestion": "使用参数化查询"
      }
    ],
    "rationale": "检测到字符串格式化直接用于 SQL 查询构建..."
  }
}
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/run` | POST | 执行模块 |
| `/modules` | GET | 列出模块 |
| `/modules/{name}` | GET | 模块详情 |
| `/health` | GET | 健康检查 |

## 高级配置

### 自定义模块

```bash
npx cogn@2.2.12 init my-module
# 编辑 module.yaml / prompt.md / schema.json
npx cogn@2.2.12 validate my-module --v22
```

### 多 LLM 支持

```json
{
  "module": "code-reviewer",
  "args": "your code",
  "provider": "anthropic",
  "model": "claude-sonnet-4.5"
}
```

## 故障排除

**Q: 认证失败**
- 确认 `COGNITIVE_API_KEY` 设置正确
- 请求头需包含 `Authorization: Bearer <key>`

**Q: 模块不存在**
- 运行 `npx cogn@2.2.12 list` 检查已安装模块
- 使用 `npx cogn@2.2.12 add` 安装需要的模块

### 查看日志

```bash
# Docker 日志
docker-compose logs -f cognitive-api

# 直接运行
npx cogn@2.2.12 serve --port 8000 2>&1 | tee cognitive.log
```

## 安全建议

1. **必须设置 API Key**
2. **使用 HTTPS**
3. **限制来源**（反向代理层）
4. **定期轮换**

## 更多资源

- [Cognitive Modules 文档](../README.md)
- [Coze 插件开发指南](https://www.coze.cn/open/docs/guides/plugin)
- [OpenAPI 规范](./openapi.yaml)
