import json
import logging

import pytest

from observability.health import ServiceHealth
from observability.logging import JsonFormatter, REDACTED, redact_mapping


def test_redacts_sensitive_keys_recursively() -> None:
    payload = {
        "token": "abc",
        "nested": {"client_secret": "def", "safe": "ok"},
    }
    redacted = redact_mapping(payload)
    assert redacted["token"] == REDACTED
    assert redacted["nested"]["client_secret"] == REDACTED
    assert redacted["nested"]["safe"] == "ok"


def test_json_formatter_emits_safe_context() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord("test", logging.INFO, __file__, 1, "hello", (), None)
    record.safe_context = {"authorization": "Bearer secret", "product_id": "prd_1"}
    data = json.loads(formatter.format(record))
    assert data["context"]["authorization"] == REDACTED
    assert data["context"]["product_id"] == "prd_1"


def test_service_health_rejects_write_capability() -> None:
    health = ServiceHealth(status="ok", service="runtime", write_capability=True)
    with pytest.raises(ValueError):
        health.assert_read_only()
