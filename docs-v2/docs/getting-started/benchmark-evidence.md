---
sidebar_position: 6
---

# Benchmark Evidence

This page answers a narrow question:

**Does Cognitive produce a more reliable merge-gate contract than raw prompting?**

## Benchmark Setup

We ran the built-in benchmark runner against the same 4 cases in 4 modes:

- `raw-text`
- `raw-schema`
- `cognitive-core`
- `cognitive-standard`

Cases:

- `incident-triage-extraction`
- `product-brief-extraction`
- `pr-review-sql-injection`
- `pr-review-input-validation`

Key metrics:

- `targetSchemaPassRate`
- `semanticPassRate`
- `manualFixRate`
- `stabilityRate`

## Gemini (`gemini-3-pro-preview`)

| Mode | schema | semantic | manual fix | stability |
|------|--------|----------|------------|-----------|
| `raw-text` | `0.00` | `0.25` | `1.00` | `0.625` |
| `raw-schema` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-core` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-standard` | `1.00` | `1.00` | `0.00` | `1.00` |

## MiniMax (`MiniMax-M2.1`)

| Mode | schema | semantic | manual fix | stability |
|------|--------|----------|------------|-----------|
| `raw-text` | `0.00` | `0.25` | `1.00` | `0.625` |
| `raw-schema` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-core` | `1.00` | `1.00` | `0.00` | `1.00` |
| `cognitive-standard` | `1.00` | `1.00` | `0.00` | `1.00` |

## What This Means

### `raw-text` is not a system interface

It can look usable, but it does not reliably satisfy a contract. In both providers above, it failed the schema baseline and required manual cleanup.

### `raw-schema` is a strong baseline

This matters. Cognitive should not be compared to weak prompting only.

The benchmark shows that a strong schema prompt can already become stable on a narrow task set.

### Cognitive's value is the contract runtime, not just JSON

`cognitive-core` and `cognitive-standard` matched the strong schema baseline while still adding:

- v2.2 envelope (`ok/meta/data|error`)
- repair and normalization
- provider downgrade handling
- policy visibility (`meta.policy`)
- publishable module format

So the value claim is not "more intelligent output". The value claim is:

**more reliable contract execution for CI, gates, and workflows.**

## Why The Results Improved

Earlier runs showed instability in free-text fields like `summary`, `title`, `customer_impact`, and `next_action`.

The current benchmark contracts were tightened to prefer canonical labels such as:

- `reject_until_security_fix`
- `reject_until_validation_added`
- `sql_injection`
- `missing_input_validation`
- `parameterized_queries`

That change removed avoidable wording drift and made stability measurable.

## Recommended Interpretation

If your goal is:

- casual prompting
- one-off analysis
- human-only reading

then Cognitive is probably too much.

If your goal is:

- PR gates
- structured extraction into a workflow
- routing by risk/confidence
- cross-provider contract stability

then Cognitive now has measured evidence behind it.

## Reproduce Locally

From `packages/cli-node`:

```bash
npm run build
npm run bench:cognitive-vs-raw -- --provider gemini --model gemini-3-pro-preview --runs 2
npm run bench:cognitive-vs-raw -- --provider minimax --model MiniMax-M2.1 --runs 2
```

The benchmark runner lives at:

- `packages/cli-node/benchmarks/cognitive-vs-raw/run.mjs`
