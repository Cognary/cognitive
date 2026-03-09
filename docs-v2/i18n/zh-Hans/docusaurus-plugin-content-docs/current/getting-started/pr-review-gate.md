---
sidebar_position: 5
---

# Killer Use Case：PR 风险门禁（CI）

如果要让 Cognitive 真正传播，就需要一个明显优于临时 Prompt 的工作流。
这个场景就是：**把 AI 代码审查变成可验证的 merge gate contract**，并在 CI 里阻断高风险 PR。

你能得到：

- 每次都返回稳定的 v2.2 envelope（`ok/meta/data|error`）
- `meta.risk` 和 `meta.confidence` 用于路由
- `data.decision`、`data.blocking`、`data.findings[]` 作为真正的 gate artifact
- provider 差异由 runtime 处理，策略记录在 `meta.policy.*`

## 5 分钟本地演示

```bash
export GEMINI_API_KEY=sk-xxx

cat <<'EOF' | npx cogn@2.2.16 pipe --module pr-risk-gate --pretty --profile standard --provider gemini --model gemini-3-pro-preview
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

重点看：

- `meta.risk` 应该是 `high`
- `data.decision` 应该是类似 `reject_until_security_fix` 的 canonical label
- `data.findings[]` 应该使用稳定标签，如 `sql_injection`、`parameterized_queries`
- `data.rationale` 保留长文本，便于审计

## CI 门禁：阻断高风险 PR

典型流程：

1. 计算 PR diff（`git diff base...head`）
2. 用 `pr-risk-gate` 跑 diff
3. 如果 `meta.risk === "high"` 或 `data.blocking === true`，直接 fail job

仓库里已经附了可直接复制的模板：

- 模块：`cognitive/modules/pr-risk-gate`
- Workflow + 脚本：`templates/use-cases/pr-review-gate`

## 推荐默认策略

- 日常仓库：`--profile standard`
- 高风险仓库：`--profile certified`
- 保持 `--structured auto` 开启，runtime 会做最稳妥的 provider 降级

示例：

```bash
npx cogn@2.2.16 pipe --module pr-risk-gate --pretty --profile standard --structured auto
```

## 为什么它比“直接 Prompt”更可靠

- CI 需要机器可读合同，自由文本不可依赖
- provider 的 JSON/schema 能力不一致，Cognitive 会统一合同并记录降级原因
- `meta.risk` + `data.decision` 可以直接驱动 allow / review / block
- 这个合同已经通过 benchmark 对比过 `raw-text`、`raw-schema`、`cognitive-core`、`cognitive-standard`

另见：

- [Benchmark 证据](./benchmark-evidence)
