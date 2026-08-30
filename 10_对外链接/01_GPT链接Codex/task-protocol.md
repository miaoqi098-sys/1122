# Active task protocol

The canonical contract is [`C:\AmazonAgent\.codex-bridge\task-schema.json`](../../.codex-bridge/task-schema.json).

## Task lifecycle

1. GPT writes exactly one declared task to `.codex-bridge/inbox/current.json` on `codex-dispatch`.
2. `AmazonAgent-Codex-TaskRunner` sees the task once per minute; a current-user, non-interactive logon bootstrap starts the same one-shot runner at user logon when Windows denies the standard user an `ONLOGON` task trigger.
3. The runner exits immediately if `.codex-bridge/results/<task_id>.json` already has a terminal status.
4. For a new valid task, the runner launches Codex CLI with the fixed task prompt.
5. Codex independently re-reads the task, performs only its allowlisted task type, and writes its structured terminal result to GitHub.
6. GPT reads that result and decides the next task.

## Terminal statuses

`SUCCESS`, `FAILED`, `TIMEOUT`, `CANCELLED`, `AUTH_REQUIRED`, `BLOCKED`, and `PASS` are terminal. No terminal task is re-run.

## Runner limits

- `local_readonly_test`: 120 seconds, including scheduled execution.
- External-platform work: 300 seconds (the scheduled runner default).
- On runner timeout, the runner attempts to write a non-secret `TIMEOUT` result.

The protocol never uses the legacy Gateway endpoint, MCP polling, local `bridge-state.json`, or user-to-Codex message relay.
