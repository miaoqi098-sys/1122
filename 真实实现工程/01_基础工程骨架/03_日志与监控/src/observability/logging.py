from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any


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


def _is_sensitive_key(key: str) -> bool:
    normalized = key.strip().lower()
    return any(fragment in normalized for fragment in SENSITIVE_KEY_FRAGMENTS)


def redact_mapping(value: Mapping[str, Any]) -> dict[str, Any]:
    redacted: dict[str, Any] = {}
    for key, item in value.items():
        if _is_sensitive_key(str(key)):
            redacted[str(key)] = REDACTED
        elif isinstance(item, Mapping):
            redacted[str(key)] = redact_mapping(item)
        elif isinstance(item, list):
            redacted[str(key)] = [
                redact_mapping(entry) if isinstance(entry, Mapping) else entry
                for entry in item
            ]
        else:
            redacted[str(key)] = item
    return redacted


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        safe_context = getattr(record, "safe_context", None)
        if isinstance(safe_context, Mapping):
            payload["context"] = redact_mapping(safe_context)

        correlation_id = getattr(record, "correlation_id", None)
        if correlation_id:
            payload["correlation_id"] = str(correlation_id)

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_json_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
