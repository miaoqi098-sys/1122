from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from runtime_security import REDACTED, sanitize_message, sanitize_value


def redact_mapping(value: Mapping[str, Any]) -> dict[str, Any]:
    sanitized = sanitize_value(value)
    if not isinstance(sanitized, dict):
        raise TypeError("redact_mapping expects a mapping")
    return sanitized


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": sanitize_message(record.getMessage()),
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
