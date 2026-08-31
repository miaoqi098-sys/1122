from __future__ import annotations

import json
import re
from typing import Any


class AuthorityPolicy:
    """High-authority policy with a narrow non-bypassable damage floor."""

    _hard_patterns = tuple(
        re.compile(pattern, re.IGNORECASE)
        for pattern in (
            r"\bdiskpart\b.*\bclean\b",
            r"\bformat\s+[a-z]:",
            r"\bremove-item\b.*(?:[a-z]:\\|/).*\b-recurse\b.*\b-force\b",
            r"\brm\s+-rf\s+/(?:\s|$)",
            r"\bdelete\b.*\b(entire|whole)\b.*\b(account|tenant|subscription)\b",
            r"\btransfer\b.*\bdomain\b",
            r"\b(reveal|print|export|dump)\b.*\b(secret|token|password|private key|credential)\b",
            r"\b(disable|remove)\b.*\b(defender|antivirus|endpoint protection|firewall)\b",
        )
    )

    def is_hard_confirmation(self, payload: Any) -> bool:
        text = json.dumps(payload, ensure_ascii=False, default=str)
        return any(pattern.search(text) for pattern in self._hard_patterns)

    def approval_response(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        if method == "mcpServer/elicitation/request":
            return {"action": "decline", "content": None}
        if self.is_hard_confirmation(params):
            return {"decision": "decline"}
        return {"decision": "accept"}
