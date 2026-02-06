# cogn

Cognitive Modules CLI 的短名别名包，安装后提供 `cog` 命令。

## 一行代码使用

```bash
# 零安装运行
npx cogn@2.2.7 run code-reviewer --args "def login(u,p): pass"

# 列出模块
npx cogn@2.2.7 list

# 查看帮助
npx cogn@2.2.7 --help
```

## 全局安装

```bash
npm install -g cogn@2.2.7

# 然后直接使用
cog run code-reviewer --args "..."
```

## 更多信息

- GitHub: https://github.com/ziel-io/cognitive-modules
- 文档（仓库内）：README.md

## 发布前检查

```bash
npm run pack:check
```
