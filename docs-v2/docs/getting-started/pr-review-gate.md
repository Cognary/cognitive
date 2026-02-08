---
sidebar_position: 5
---

# Killer Use Case: PR Review Gate (CI)

If you want Cognitive to spread, you need one workflow that is obviously better than ad-hoc prompting.
This is that workflow: **turn AI code review into a verifiable contract**, and use it as a gate in CI.

You get:

- A stable v2.2 envelope (`ok/meta/data|error`) every run.
- `meta.risk` and `meta.confidence` for routing.
- Post-validation and policy diagnostics (`meta.policy.*`) when providers differ.

## 5-Minute Local Demo

```bash
export DEEPSEEK_API_KEY=sk-xxx

cat <<'EOF' | npx cogn@2.2.13 run code-reviewer --stdin --pretty
def login(u,p): pass
EOF
```

What to look for:

- `meta.risk` is set (`none|low|medium|high`)
- `meta.explain` is short (<=280 chars)
- `data` is structured and auditable (`data.rationale` is long-form)

## CI Gate: Block High Risk, Allow Low Risk

In a PR workflow, you typically:

1. Compute a diff (`git diff base...head`)
2. Run `code-reviewer` on the diff
3. Fail the job if `meta.risk === "high"`

We ship a copy-paste template:

- `templates/use-cases/pr-review-gate/`

### Recommended Policy Defaults

- Use `--profile standard` for day-to-day.
- Use `--profile certified` for high-stakes repos (stricter gates).
- Leave `--structured auto` on (best cross-provider stability).

Example:

```bash
npx cogn@2.2.13 run code-reviewer --stdin --pretty --profile standard --structured auto
```

## Why This Works (And “Just Prompting” Doesn’t)

- CI needs a machine-readable contract. Free-form text is brittle.
- Providers have different schema/JSON mode behavior. Cognitive normalizes to one contract and records decisions.
- Risk + confidence gives you a routing primitive: allow, require review, block.

