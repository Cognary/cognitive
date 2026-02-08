---
sidebar_position: 4
---

# Killer Use Cases

"Making it simpler" helps onboarding, but "making it necessary" drives adoption.
Below are use cases where Cognitive's contracts and auditability are hard to replace with ad-hoc prompting.

## 1) High-Risk Decisions With Routing (Human-in-the-Loop)

When an AI output can cause production impact, you want:

- A strict output envelope (always the same shape).
- Explicit `risk` and `confidence` for routing.
- Schema validation to block malformed payloads.

Example pattern:

1. `tier: exec` or `tier: decision`
2. Enforce `meta.explain` (short) + `data.rationale` (long)
3. Route results by `meta.risk`:
   - `low`: auto-apply / auto-merge
   - `medium`: require review
   - `high`: block + escalate

## 2) IDE-Native Workflows (MCP) With Streaming

For tools like Cursor / Claude Code, the ideal experience is:

- The tool gets streaming events (progress) and a final envelope (result).
- The runtime enforces the same schema/policy rules as CLI and HTTP.

Recommended transport split:

- MCP/HTTP: SSE streaming
- CLI: NDJSON streaming

The important invariant is parity: the same module, policies, and final envelope regardless of transport.

## 3) Composable Multi-Step Workflows (Composition)

Composition becomes a "protocol feature" when:

- Each step emits a validated envelope.
- The router/aggregator consumes typed outputs (not free-form text).
- You can audit intermediate states and failures.

This is the boundary where Cognitive is no longer "a CLI tool", but "a workflow contract system".

## 4) PR Review Gate (CI)

Turn AI code review into a CI gate:

- Run `code-reviewer` on the PR diff
- Block merges when `meta.risk === "high"`

Start here:

- `getting-started/pr-review-gate`
