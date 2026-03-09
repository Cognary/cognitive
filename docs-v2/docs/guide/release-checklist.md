---
sidebar_position: 9
---

# Release Checklist

Use this checklist after publishing a new npm version of Cognitive.

## Fast path

From `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node`:

```bash
npm run release:smoke
```

This verifies:

- `cognitive-modules-cli@<version>` exists on npm
- `cogn@<version>` exists on npm
- both bin mappings are correct
- `npx cogn@<version> --version` works
- `npx cognitive-modules-cli@<version> --version` works
- `cog providers` still exposes the stable provider surface
- `core run --stdin` returns a valid v2.2 envelope
- `pr-risk-gate` blocks a known SQL injection diff when a compatible API key is configured

## Manual checklist

### 1. Confirm npm versions

```bash
npm view cognitive-modules-cli@<version> version
npm view cogn@<version> version
```

Expected:

- both commands print `<version>`

### 2. Confirm bin mappings

```bash
npm view cognitive-modules-cli@<version> bin
npm view cogn@<version> bin
```

Expected:

- `cognitive-modules-cli` exposes `bin.js`
- `cogn` exposes `bin.js`

### 3. Confirm CLI entrypoints

```bash
npx cogn@<version> --version
npx cognitive-modules-cli@<version> --version
```

Expected:

- both commands print `Cognitive Runtime v<version>`

### 4. Confirm stable provider surface

```bash
npx cogn@<version> providers --pretty
```

Expected stable providers:

- `openai`
- `anthropic`
- `gemini`
- `minimax`
- `deepseek`
- `qwen`

### 5. Confirm `core` smoke path

```bash
cat <<'EOF' | npx cogn@<version> core run --stdin --args "hello" --pretty
Please return a valid v2.2 envelope (meta + data). Put the answer in data.result.
EOF
```

Expected:

- `ok: true`
- `version: "2.2"`
- response includes both `meta` and `data`

### 6. Confirm PR Risk Gate smoke path

Example with Gemini:

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

Expected:

- `ok: true`
- `data.decision = reject_until_security_fix`
- `data.blocking = true`
- at least one finding with `finding_type = sql_injection`

## Notes

- `release:smoke` skips the PR Risk Gate example if the required provider API key is missing.
- Use `--provider minimax --model MiniMax-M2.1` in the script if you want a MiniMax-based gate smoke instead of Gemini.
