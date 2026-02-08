# cogn

Cognitive Modules Node.js CLI 的短名别名包。文档统一使用明确入口 `npx cogn@2.2.11 ...`，避免本机 PATH 上存在其他同名命令导致的错觉。

## 一行代码使用

```bash
# 零安装运行
npx cogn@2.2.11 run code-reviewer --args "def login(u,p): pass"

# 列出模块
npx cogn@2.2.11 list

# 查看帮助
npx cogn@2.2.11 --help
```

## 全局安装

```bash
npm install -g cogn@2.2.11

# 然后使用（推荐仍保持 npx 入口，避免命令名冲突）
npx cogn@2.2.11 run code-reviewer --args "..."
```

## 更多信息

- GitHub: https://github.com/Cognary/cognitive
- 文档: https://cognary.github.io/cognitive/

## 发布前检查

```bash
npm run pack:check
```
