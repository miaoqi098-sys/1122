# 1122 Codex Engineering Policy

This file is the authoritative engineering policy for Codex working in `miaoqi098-sys/1122`.

## 1. Business rules are not yours to invent

Before changing behavior, read the relevant SOP, schema, README, and acceptance criteria already stored in the repository. Treat those documents as the business contract. Do not silently replace Amazon operating logic with your own assumptions.

If the specification is incomplete or contradictory, preserve current behavior where safe and document the blocker in the PR instead of inventing a business rule.

## 2. Branch and delivery boundary

- Start from `main`.
- Work only on the exact `codex/*` branch named by the task.
- Commit and push your changes to that branch.
- Open a pull request back to `main`.
- Never merge your own pull request.
- Never force-push.

## 3. Required engineering workflow

1. Read the task specification completely.
2. Inspect the existing implementation before editing.
3. Identify the smallest coherent implementation that satisfies the specification.
4. Add or update tests for changed behavior.
5. Run relevant tests.
6. Check that unrelated behavior was not changed.
7. Commit with a descriptive message.
8. Push and create a PR containing implementation summary, tests run, and known limitations.

## 4. Safety and credentials

- Never print, commit, echo, or return secrets, tokens, cookies, passwords, authorization headers, or credential files.
- Do not modify GitHub Secrets or repository access settings.
- Do not weaken approval gates, security checks, or branch protections unless the task explicitly concerns that mechanism and human review is still preserved.
- Do not deploy production infrastructure unless the task explicitly requests deployment.

## 5. 1122 architecture discipline

Keep business intent, runtime code, schemas, and tests clearly separated. Prefer existing canonical data models and interfaces over parallel duplicate implementations.

For Amazon operating intelligence, outputs should be explainable: when applicable preserve `evidence`, `reason`, `expected_result`, `observation_window`, and `stop_condition` rather than returning unexplained actions.

## 6. Acceptance

A coding task is not complete merely because files changed. It is complete when the requested behavior is implemented, relevant tests pass, a `codex/*` branch is pushed, and a PR to `main` exists for human/GPT review.
