# HTTP API

Cognitive Modules 提供 HTTP API 服务，方便集成到工作流平台（Coze、n8n、Dify 等）。

## 安装

=== "Node.js (npm) - 推荐"

    ```bash
    # 全局安装
    npm install -g cogn

    # 或使用 npx
    npx cogn --help
    ```

=== "Python (pip)"

    ```bash
    pip install cognitive-modules[server]
    ```

## 启动服务

=== "Node.js"

    ```bash
    # 启动 API 服务
    cog serve --port 8000

    # 或指定 host
    cog serve --host 0.0.0.0 --port 8000
    ```

=== "Python"

    ```bash
    # 启动 API 服务
    cogn serve --port 8000

    # 或指定 host
    cogn serve --host 0.0.0.0 --port 8000
    ```

服务启动后，访问：

- API 文档：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/` | API 信息 |
| GET | `/health` | 健康检查 |
| GET | `/modules` | 列出所有模块 |
| GET | `/modules/{name}` | 获取模块详情 |
| POST | `/run` | 运行模块 |

## 运行模块

### 请求

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "module": "code-reviewer",
    "args": "def login(u,p): return db.query(f\"SELECT * FROM users WHERE name={u}\")"
  }'
```

### 响应

```json
{
  "ok": true,
  "data": {
    "issues": [
      {
        "type": "security",
        "severity": "critical",
        "description": "SQL 注入漏洞"
      }
    ],
    "confidence": 0.95,
    "rationale": "检测到字符串拼接 SQL"
  },
  "module": "code-reviewer",
  "provider": "openai"
}
```

### 指定 LLM 提供商

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "module": "code-reviewer",
    "args": "your code",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022"
  }'
```

## 工作流集成示例

### n8n

1. 添加 **HTTP Request** 节点
2. 配置：
   - Method: `POST`
   - URL: `http://localhost:8000/run`
   - Body Content Type: `JSON`
   - Body:
     ```json
     {
       "module": "code-reviewer",
       "args": "{{ $json.code }}"
     }
     ```

### Coze / Dify

使用 HTTP 插件或代码块调用 API：

```python
import requests

response = requests.post(
    "http://your-server:8000/run",
    json={
        "module": "code-reviewer",
        "args": input_code
    }
)
result = response.json()
```

### Make / Zapier

1. 使用 HTTP 模块
2. POST 到 `/run` 端点
3. 解析 JSON 响应

## Docker 部署

```dockerfile
FROM python:3.11-slim

RUN pip install cognitive-modules[server,openai]

ENV OPENAI_API_KEY=your-key

EXPOSE 8000

CMD ["cogn", "serve", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t cognitive-api .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-xxx cognitive-api
```

## 环境变量

服务启动前需要配置 LLM API Key：

```bash
export OPENAI_API_KEY=sk-xxx
# 或
export ANTHROPIC_API_KEY=sk-xxx

cogn serve
```

## 健康检查

```bash
curl http://localhost:8000/health
```

响应：

```json
{
  "status": "healthy",
  "version": "1.3.0",
  "providers": {
    "openai": true,
    "anthropic": false,
    "minimax": false,
    "deepseek": false
  }
}
```
