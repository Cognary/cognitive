# Cognitive Modules - Coze 插件服务（Node.js）

FROM node:18-alpine

WORKDIR /app

# Install CLI
RUN npm install -g cogn@2.2.5

EXPOSE 8000

CMD ["cog", "serve", "--host", "0.0.0.0", "--port", "8000"]
