from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from pydantic import SecretStr


REDACTED = "[REDACTED]"
SENSITIVE_KEY_FRAGMENTS = (
    "authorization",
    "cookie",
    "password",
    "secret",
    "token",
    "private_key",
    "access_key",
    "refresh_token",
    "client_secret",
)

_BEARER_RE = re.compile(r"(?i)\bBearer\s+[^\s,;]+")
_KEY_VALUE_RE = re.compile(
    r"(?i)\b(password|secret|token|access[_-]?key|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*([^\s,;]+)"
)


def is_sensitive_key(key: str) -> bool:
    normalized = key.strip().lower()
    return any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS)


def sanitize_message(message: str) -> str:
    message = _BEARER_RE.sub("Bearer [REDACTED]", message)
    return _KEY_VALUE_RE.sub(lambda match: f"{match.group(1)}=[REDACTED]", message)


def sanitize_value(value: Any) -> Any:
    if isinstance(value, SecretStr):
        return REDACTED
    if isinstance(value, Mapping):
        return {
            str(key): REDACTED if is_sensitive_key(str(key)) else sanitize_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [sanitize_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(sanitize_value(item) for item in value)
    return value
