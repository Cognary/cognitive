---
sidebar_position: 5
---

# Killer Use Case: PR Review Gate (CI)

If you want Cognitive to spread, you need one workflow that is obviously better than ad-hoc prompting.
This is that workflow: **turn AI code review into a verifiable merge-gate contract**, and use it to block risky PRs in CI.

You get:

- A stable v2.2 envelope (`ok/meta/data|error`) every run.
- `meta.risk` and `meta.confidence` for routing.
- Post-validation and policy diagnostics (`meta.policy.*`) when providers differ.

## 5-Minute Local Demo

```bash
export GEMINI_API_KEY=sk-xxx

cat <<'EOF' | npx cogn@2.2.14 pipe --module pr-risk-gate --pretty --profile standard --provider gemini --model gemini-3-pro-preview
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

What to look for:

- `meta.risk` is set (`none|low|medium|high`) and should be `high` here
- `meta.explain` is short (max 280 chars)
- `data.decision` is canonical (for example `reject_until_security_fix`)
- `data.findings[]` uses stable labels such as `sql_injection` and `parameterized_queries`
- `data.rationale` stays long-form for audit

## CI Gate: Block High Risk, Allow Low Risk

In a PR workflow, you typically:

1. Compute a diff (`git diff base...head`)
2. Run `pr-risk-gate` on the diff
3. Fail the job if `meta.risk === "high"` or `data.blocking === true`

We now ship a copy-paste template:

- Module: `cognitive/modules/pr-risk-gate`
- Workflow + script: `templates/use-cases/pr-review-gate`

### Recommended Policy Defaults

- Use `--profile standard` for day-to-day.
- Use `--profile certified` for high-stakes repos (stricter gates).
- Leave `--structured auto` on (best cross-provider stability).

Example:

```bash
npx cogn@2.2.14 pipe --module pr-risk-gate --pretty --profile standard --structured auto
```

## Why This Works (And “Just Prompting” Doesn’t)

- CI needs a machine-readable contract. Free-form text is brittle.
- Providers have different schema/JSON mode behavior. Cognitive normalizes to one contract and records decisions.
- `meta.risk` + canonical `data.decision` gives you a routing primitive: allow, require review, block.
- The contract is benchmarked against raw prompting. `raw-text` fails; `core` and `standard` stay stable.

See also:

- [Benchmark Evidence](./benchmark-evidence)
