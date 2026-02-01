#!/bin/bash
# Cognitive Modules - 快速部署脚本
# 用于快速部署 Cognitive API 服务

set -e

echo "🧠 Cognitive Modules - Coze 插件部署"
echo "========================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: docker-compose 未安装"
    echo "请先安装 docker-compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "📝 创建配置文件..."
    cp .env.example .env
    echo ""
    echo "⚠️  请编辑 .env 文件配置以下内容："
    echo "   - COGNITIVE_API_KEY: API 认证密钥"
    echo "   - OPENAI_API_KEY: OpenAI API Key"
    echo "   - LLM_PROVIDER: LLM 提供商"
    echo ""
    echo "编辑完成后，重新运行此脚本。"
    exit 0
fi

# 检查必要的环境变量
source .env

if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "❌ 错误: 未配置任何 LLM API Key"
    echo "请在 .env 文件中至少配置一个 API Key"
    exit 1
fi

echo "🚀 启动服务..."
docker-compose up -d --build

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 健康检查
if curl -s http://localhost:${PORT:-8000}/health > /dev/null; then
    echo ""
    echo "✅ 服务启动成功！"
    echo ""
    echo "📍 API 地址: http://localhost:${PORT:-8000}"
    echo "📖 API 文档: http://localhost:${PORT:-8000}/docs"
    echo ""
    echo "🔗 下一步："
    echo "   1. 配置公网访问（Nginx 反向代理或云服务）"
    echo "   2. 在 Coze 控制台创建插件"
    echo "   3. 上传 openapi.yaml 文件"
    echo "   4. 配置服务器地址和 API Key"
    echo ""
    echo "📘 详细指南请查看 README.md"
else
    echo ""
    echo "❌ 服务启动失败，请检查日志："
    echo "   docker-compose logs cognitive-api"
fi
