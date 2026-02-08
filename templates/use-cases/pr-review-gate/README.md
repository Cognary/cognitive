# PR Review Gate (Template)

This template shows a "killer use case" for Cognitive: a PR workflow that runs a structured code review and blocks merges on high risk.

## Files

- `.github/workflows/cognitive-pr-review.yml`: GitHub Actions workflow
- `scripts/check-risk.mjs`: fails CI if `meta.risk === "high"`

## Setup

1. Copy this folder into your repo.
2. Add an API key as GitHub Actions secret:
   - `DEEPSEEK_API_KEY` (recommended for the demo)
3. Open a PR. The workflow will comment-free gate the PR based on risk.

## Customize

- Change provider/model:
  - edit the `env:` block in the workflow
  - or pass `--provider/--model` in the command
- Change the threshold:
  - edit `scripts/check-risk.mjs`

