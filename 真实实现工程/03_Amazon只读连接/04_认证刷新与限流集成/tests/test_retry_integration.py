from __future__ import annotations

import pytest

from amazon_read_connector import (
    AmazonReadConnector,
    ConnectorRateLimitError,
    ConnectorRequest,
    ConnectorTimeoutError,
    FakeTransport,
    ReadOperation,
    RetryPolicy,
    TransportResponse,
)
from auth_rate_limit import ExponentialRetryDelayPolicy
from secrets_runtime import SecretRef


class FakeSleeper:
    def __init__(self) -> None:
        self.calls: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.calls.append(seconds)


def _credential_ref() -> SecretRef:
    return SecretRef(
        provider="environment",
        key="AMAZON/TEST/ACCESS_TOKEN",
        purpose="P3 retry integration test only",
    )


def _request() -> ConnectorRequest:
    return ConnectorRequest(
        operation=ReadOperation.SPAPI_INVENTORY_GET_SUMMARIES,
        seller_account_id="seller-test",
        marketplace_id="ATVPDKIKX0DER",
        correlation_id="corr-retry-test",
    )


def test_retry_after_is_honored_and_bounded() -> None:
    sleeper = FakeSleeper()
    transport = FakeTransport(
        outcomes=[
            ConnectorRateLimitError(retry_after_seconds=9.0),
            TransportResponse(payload={"ok": True}, request_id="req-2", status_code=200),
        ]
    )
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=_credential_ref(),
        retry_policy=RetryPolicy(max_attempts=2),
        retry_delay_policy=ExponentialRetryDelayPolicy(base_delay_seconds=0.5, max_delay_seconds=3.0),
        sleeper=sleeper,
    )

    response = connector.read(_request())

    assert sleeper.calls == [3.0]
    assert response.trace.attempt_count == 2
    assert response.data == {"ok": True}


def test_timeout_uses_exponential_backoff() -> None:
    sleeper = FakeSleeper()
    transport = FakeTransport(
        outcomes=[
            ConnectorTimeoutError("first timeout"),
            ConnectorTimeoutError("second timeout"),
            TransportResponse(payload={"ok": True}, request_id="req-3", status_code=200),
        ]
    )
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=_credential_ref(),
        retry_policy=RetryPolicy(max_attempts=3),
        retry_delay_policy=ExponentialRetryDelayPolicy(base_delay_seconds=0.25, max_delay_seconds=2.0),
        sleeper=sleeper,
    )

    response = connector.read(_request())

    assert sleeper.calls == [0.25, 0.5]
    assert response.trace.attempt_count == 3


def test_final_retry_failure_does_not_sleep_after_last_attempt() -> None:
    sleeper = FakeSleeper()
    transport = FakeTransport(
        outcomes=[
            ConnectorRateLimitError(retry_after_seconds=1.5),
            ConnectorRateLimitError(retry_after_seconds=1.5),
        ]
    )
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=_credential_ref(),
        retry_policy=RetryPolicy(max_attempts=2),
        retry_delay_policy=ExponentialRetryDelayPolicy(base_delay_seconds=0.25, max_delay_seconds=2.0),
        sleeper=sleeper,
    )

    with pytest.raises(ConnectorRateLimitError):
        connector.read(_request())

    assert sleeper.calls == [1.5]
    assert len(transport.requests) == 2


def test_delay_policy_rejects_invalid_configuration() -> None:
    with pytest.raises(ValueError):
        ExponentialRetryDelayPolicy(base_delay_seconds=2.0, max_delay_seconds=1.0)
