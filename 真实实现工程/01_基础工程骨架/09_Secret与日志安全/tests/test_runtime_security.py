import json
import logging

import pytest
from pydantic import SecretStr

from observability.logging import JsonFormatter
from runtime_security import SecretConsumptionError, SecretUseBroker
from secrets_runtime import EnvironmentSecretProvider, SecretRef


DUMMY_SECRET = "dummy-secret-value-never-real"


def make_ref() -> SecretRef:
    return SecretRef(provider="environment", key="TEST_RUNTIME_SECRET", purpose="unit-test")


def test_secret_broker_allows_one_shot_consumption_without_returning_secret() -> None:
    broker = SecretUseBroker(EnvironmentSecretProvider({"TEST_RUNTIME_SECRET": DUMMY_SECRET}))
    result = broker.use(make_ref(), lambda value: f"length:{len(value)}")
    assert result == f"length:{len(DUMMY_SECRET)}"
    assert DUMMY_SECRET not in repr(broker)


def test_secret_broker_rejects_returning_raw_secret() -> None:
    broker = SecretUseBroker(EnvironmentSecretProvider({"TEST_RUNTIME_SECRET": DUMMY_SECRET}))
    with pytest.raises(SecretConsumptionError):
        broker.use(make_ref(), lambda value: value)


def test_secret_broker_rejects_returning_secretstr() -> None:
    broker = SecretUseBroker(EnvironmentSecretProvider({"TEST_RUNTIME_SECRET": DUMMY_SECRET}))
    with pytest.raises(SecretConsumptionError):
        broker.use(make_ref(), lambda value: SecretStr(value))


def test_log_message_redacts_bearer_and_key_value_credentials() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord(
        "test",
        logging.INFO,
        __file__,
        1,
        "request Bearer abc123 token=xyz password:supersecret",
        (),
        None,
    )
    data = json.loads(formatter.format(record))
    assert "abc123" not in data["message"]
    assert "xyz" not in data["message"]
    assert "supersecret" not in data["message"]
    assert "[REDACTED]" in data["message"]


def test_safe_context_redacts_secretstr_even_with_safe_key() -> None:
    formatter = JsonFormatter()
    record = logging.LogRecord("test", logging.INFO, __file__, 1, "hello", (), None)
    record.safe_context = {
        "credential": SecretStr(DUMMY_SECRET),
        "nested": [{"safe": SecretStr(DUMMY_SECRET)}],
    }
    data = json.loads(formatter.format(record))
    rendered = json.dumps(data)
    assert DUMMY_SECRET not in rendered
    assert data["context"]["credential"] == "[REDACTED]"
    assert data["context"]["nested"][0]["safe"] == "[REDACTED]"
