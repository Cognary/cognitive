# Cognitive vs Raw Benchmark

This benchmark is meant to answer a practical question:

**Does Cognitive improve engineering usefulness compared with direct prompting?**

It does **not** try to prove that Cognitive makes a model "smarter".
It measures whether Cognitive makes outputs more:

- structurally valid
- schema-compliant
- stable across repeated runs
- portable across providers
- usable in CI / gates / automation

## Modes

The benchmark runs the same task through four modes:

1. `raw-text`
   Direct provider call with plain prompt instructions.
2. `raw-schema`
   Direct provider call with prompt-guided schema instructions.
3. `cognitive-core`
   Single-file Cognitive module, `--profile core`.
4. `cognitive-standard`
   v2.2 Cognitive module directory with `schema.json`, `--profile standard`.

That split is intentional:

- `raw-text` answers: how far can plain prompting get?
- `raw-schema` answers: what if we just add a better JSON prompt?
- `cognitive-core` answers: does the minimal Cognitive path already help?
- `cognitive-standard` answers: does the full contract/validation path justify its added complexity?

## Metrics

The runner writes a JSON report and a Markdown summary with these metrics:

- `valid_json_rate`
- `target_schema_pass_rate`
- `required_fields_complete_rate`
- `semantic_pass_rate`
- `manual_fix_rate`
- `stability_rate`
- `avg_latency_ms`
- `avg_total_tokens` (when the provider reports usage)

`manual_fix_rate` is a proxy: it is calculated as the share of outputs that still fail the target schema after parsing.

## Example

From `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node`:

```bash
npm run build
npm run bench:cognitive-vs-raw -- --provider gemini --model gemini-3-pro-preview --runs 3
```

The runner now prints per-attempt progress like:

```text
[bench 3/48] start case=... mode=... run=...
[bench 3/48] done ok=true json=true schema=true semantic=false latency_ms=12345
```

It also writes partial results after each attempt, so `results/latest.json` and `results/latest.md`
are available while the benchmark is still running.

If you want to inspect the suite and output paths without calling a model:

```bash
npm run bench:cognitive-vs-raw -- --provider gemini --plan
```

If you want a fast smoke run before a full suite, start with:

```bash
npm run bench:cognitive-vs-raw -- --provider gemini --case pr-review-sql-injection --runs 1
```

You can also restrict modes or cases:

```bash
npm run bench:cognitive-vs-raw -- \
  --provider deepseek \
  --model deepseek-chat \
  --modes raw-text,raw-schema,cognitive-standard \
  --case pr-review-sql-injection \
  --runs 5 \
  --timeout-ms 90000
```

## Files

- Suite: `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node/benchmarks/cognitive-vs-raw/suite.example.json`
- Runner: `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node/benchmarks/cognitive-vs-raw/run.mjs`
- Report template: `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node/benchmarks/cognitive-vs-raw/report-template.md`
- Default results dir: `/Users/lucio/Desktop/cognitve/cognitive-demo/packages/cli-node/benchmarks/cognitive-vs-raw/results`

## Interpreting results

The benchmark is useful if it shows at least one of these:

- `cognitive-standard` materially improves schema pass rate over both raw modes
- `cognitive-standard` reduces manual-fix rate
- `cognitive-core` improves stability with only modest overhead
- provider-to-provider variance is lower under Cognitive than under raw prompting

If Cognitive does **not** improve those engineering metrics, then the added protocol complexity is not earning its keep for that task.
