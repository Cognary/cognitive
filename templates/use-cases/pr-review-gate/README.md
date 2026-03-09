# PR Review Gate (Template)

This template shows the primary Cognitive use case: a PR workflow that returns a **stable merge-gate contract** and blocks merges on high risk.

## Files

- `cognitive/modules/pr-risk-gate/`: the module to vendor into your repo
- `.github/workflows/cognitive-pr-risk-gate.yml`: GitHub Actions workflow
- `scripts/check-risk.mjs`: fails CI if `meta.risk === "high"`

## Setup

1. Copy `cognitive/modules/pr-risk-gate/` into your repo under `./cognitive/modules/pr-risk-gate/`.
2. Copy `.github/workflows/cognitive-pr-risk-gate.yml` into your repo workflow directory.
3. Copy `scripts/check-risk.mjs` into your repo.
4. Add an API key as GitHub Actions secret:
   - `GEMINI_API_KEY` (default in the template)
5. Open a PR. The workflow will compute the diff, run `pr-risk-gate`, and fail the job when the decision is blocking.

## Customize

- Change provider/model:
  - edit the `env:` block in the workflow
  - or pass `--provider/--model` in the command
- Change the threshold:
  - edit `scripts/check-risk.mjs`
- Change the decision taxonomy:
  - edit `./cognitive/modules/pr-risk-gate/schema.json`
