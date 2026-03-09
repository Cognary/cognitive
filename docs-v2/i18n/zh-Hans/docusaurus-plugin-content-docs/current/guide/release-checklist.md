---
sidebar_position: 9
---

# 发布验收清单

每次发布新的 Cognitive npm 版本后，都按这份清单验收。

## 快速路径

在 `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node` 下执行：

```bash
npm run release:smoke
```

这会校验：

- `cognitive-modules-cli@<version>` 已发布到 npm
- `cogn@<version>` 已发布到 npm
- 两个包的 bin 映射正确
- `npx cogn@<version> --version` 正常
- `npx cognitive-modules-cli@<version> --version` 正常
- `cog providers` 仍然只暴露稳定 provider 面
- `core run --stdin` 返回合法 v2.2 envelope
- 当环境里存在可用 API key 时，`pr-risk-gate` 能阻断已知 SQL 注入 diff

## 手动清单

### 1. 确认 npm 版本

```bash
npm view cognitive-modules-cli@<version> version
npm view cogn@<version> version
```

期望：

- 两条命令都输出 `<version>`

### 2. 确认 bin 映射

```bash
npm view cognitive-modules-cli@<version> bin
npm view cogn@<version> bin
```

期望：

- `cognitive-modules-cli` 指向 `bin.js`
- `cogn` 指向 `bin.js`

### 3. 确认 CLI 入口

```bash
npx cogn@<version> --version
npx cognitive-modules-cli@<version> --version
```

期望：

- 都输出 `Cognitive Runtime v<version>`

### 4. 确认稳定 provider 面

```bash
npx cogn@<version> providers --pretty
```

期望稳定 provider：

- `openai`
- `anthropic`
- `gemini`
- `minimax`
- `deepseek`
- `qwen`

### 5. 确认 `core` 冒烟路径

```bash
cat <<'EOF' | npx cogn@<version> core run --stdin --args "hello" --pretty
Please return a valid v2.2 envelope (meta + data). Put the answer in data.result.
EOF
```

期望：

- `ok: true`
- `version: "2.2"`
- 输出同时包含 `meta` 和 `data`

### 6. 确认 PR 风险门禁冒烟

Gemini 示例：

```bash
cat <<'EOF' | npx cogn@<version> pipe --module pr-risk-gate --pretty --profile standard --provider gemini --model gemini-3-pro-preview
diff --git a/auth.py b/auth.py
@@
-def login(user, password):
-    query = "SELECT * FROM users WHERE name = ? AND password = ?"
-    return db.execute(query, (user, password)).fetchone()
+def login(user, password):
+    query = f"SELECT * FROM users WHERE name = '{user}' AND password = '{password}'"
+    return db.execute(query).fetchone()
EOF
```

期望：

- `ok: true`
- `data.decision = reject_until_security_fix`
- `data.blocking = true`
- 至少一个 finding 的 `finding_type = sql_injection`

## 备注

- 如果环境里没有对应 provider 的 API key，`release:smoke` 会跳过 `pr-risk-gate` 冒烟。
- 如果要改成 MiniMax 路径，可以在脚本中传 `--provider minimax --model MiniMax-M2.1`。
