# 1122 Codex Workflow

## Manual Cloud Trigger Model

ChatGPT defines business requirements.

GitHub stores:
- specifications
- tasks
- acceptance criteria
- code

User starts Codex Cloud manually.

Codex:
1. Reads AGENTS.md.
2. Reads the task specification.
3. Implements changes.
4. Runs tests.
5. Creates a Pull Request.

No local gateway.
No Windows worker.
No API key automation.
