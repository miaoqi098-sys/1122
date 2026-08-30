# Legacy recovery components

These assets are deliberately excluded from the production GPT → GitHub → Codex → GitHub path.

| Legacy area | Classification | Retained reason |
| --- | --- | --- |
| `gateway-runtime` | LEGACY_BACKUP | Diagnostics and recovery reference for the former local Gateway/MCP implementation. |
| `controlled-github-bridge` | LEGACY_BACKUP | Historical Worker-based task polling implementation. |
| `gateway-recovery` | LEGACY_BACKUP | Former Gateway installation and recovery scripts. |
| `codex-app-server-adapter` | LEGACY_BACKUP | Historical App Server integration guidance. |
| `long-lived-gateway-architecture` | LEGACY_BACKUP | Historical architecture record. |
| `gateway-gpt-entry` | LEGACY_BACKUP | Historical GPT entry manifest and documentation. |
| `long-term-session-auth` | LEGACY_BACKUP | Historical authentication/session design. |
| `legacy-task-specs` | LEGACY_BACKUP | Historical task and dialogue specifications. |
| `authority-policy` | LEGACY_BACKUP | Historical Gateway authority policy. |

Do not activate these components as part of the scheduled task flow. They may be inspected for recovery only after confirming that the active `.codex-runner` and `.codex-bridge` route is unavailable.
