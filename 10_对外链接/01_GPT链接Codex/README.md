# AmazonAgent GPT → GitHub → Codex task delivery

## Current production path

```text
GPT
  → GitHub branch: codex-dispatch
  → .codex-bridge/inbox/current.json
  → Windows Scheduled Task: AmazonAgent-Codex-TaskRunner
  → Codex CLI
  → Local execution
  → .codex-bridge/results/<task_id>.json
  → GPT
```

The Windows task runner is deliberately small: it discovers a task, checks for a terminal GitHub result, starts Codex for a new task, and enforces a hard timeout. It does not interpret business instructions or run arbitrary shell payloads.

## Active components

| Component | Status | Responsibility |
| --- | --- | --- |
| `.codex-bridge/task-schema.json` | KEEP | Allowlisted task/result contract and forbidden payload fields. |
| `.codex-bridge/inbox/current.json` | KEEP | Single current task written by GPT on `codex-dispatch`. |
| `.codex-bridge/results/` | KEEP | Authoritative terminal task results written by Codex; the runner writes only bounded failure fallbacks when Codex cannot. |
| `.codex-runner/run-task.ps1` | KEEP | One-minute, short-lived Windows task entry point; `local_readonly_test` is hard-limited to 120 seconds and external tasks to 300 seconds. |
| `.codex-runner/codex-task-prompt.md` | KEEP | Fixed instructions for Codex to self-read, execute, and write back. |
| GitHub CLI (`gh`) | KEEP | Local authenticated GitHub read/write transport. |

## Security and idempotency

- Task types are allowlisted: `local_readonly_test` and `website_online`.
- GitHub task JSON may not contain commands, shells, credentials, tokens, passwords, API keys, or private keys.
- The GitHub result file is the idempotency authority. A terminal result prevents a repeat execution.
- Local state is only a cache; it is never the source of truth.
- Cloudflare or R2 credentials are represented only by `secret_source: local_sensitive_workbook`; no credential values belong in this repository.
- The runner never starts interactive OAuth or a browser login flow.

## Legacy recovery components

The previous Gateway, MCP polling, Codex App Server adapter, and controlled bridge worker are retained under [`legacy`](legacy/README.md) only for diagnosis or manual recovery. They are **not** part of the production task path and their scheduled tasks are disabled after the new runner is validated.
