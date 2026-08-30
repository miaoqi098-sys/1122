from __future__ import annotations

import pytest

from amazon_read_connector import (
    READ_ALLOWLIST,
    ConnectorRequest,
    ReadOperation,
    RetryPolicy,
    SourceTrace,
    TransportRequest,
)
from auth_rate_limit import ExponentialRetryDelayPolicy


FORBIDDEN_WRITE_MARKERS = {
    "create",
    "update",
    "delete",
    "archive",
    "pause",
    "enable",
    "bid",
    "budget",
}


def test_read_allowlist_contains_only_explicit_read_operations() -> None:
    assert set(ReadOperation) == set(READ_ALLOWLIST)
    for operation in READ_ALLOWLIST:
        normalized = operation.value.lower()
        assert not any(marker in normalized for marker in FORBIDDEN_WRITE_MARKERS)
        assert normalized.endswith(("get_item", "get_summaries", ".list"))


def test_connector_models_do_not_expose_secret_value_fields() -> None:
    model_field_sets = [
        set(ConnectorRequest.model_fields),
        set(TransportRequest.model_fields),
        set(SourceTrace.model_fields),
    ]
    forbidden_names = {"secret", "token", "password", "client_secret", "refresh_token", "access_token"}
    for fields in model_field_sets:
        lowered = {field.lower() for field in fields}
        assert lowered.isdisjoint(forbidden_names)


def test_retry_policy_is_hard_bounded_to_five_attempts() -> None:
    assert RetryPolicy(max_attempts=5).max_attempts == 5
    with pytest.raises(ValueError):
        RetryPolicy(max_attempts=6)


def test_retry_delay_policy_has_hard_maximum() -> None:
    policy = ExponentialRetryDelayPolicy(base_delay_seconds=1.0, max_delay_seconds=4.0)
    from amazon_read_connector import ConnectorTimeoutError

    assert policy.delay_seconds(error=ConnectorTimeoutError(), attempt=1) == 1.0
    assert policy.delay_seconds(error=ConnectorTimeoutError(), attempt=2) == 2.0
    assert policy.delay_seconds(error=ConnectorTimeoutError(), attempt=3) == 4.0
    assert policy.delay_seconds(error=ConnectorTimeoutError(), attempt=4) == 4.0
