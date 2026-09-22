import pytest

from amazon_read_connector import (
    AmazonReadConnector,
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorRequest,
    ConnectorTimeoutError,
    FakeTransport,
    ReadOperation,
    RetryPolicy,
    TransportResponse,
)
from secrets_runtime.models import SecretRef


def make_ref() -> SecretRef:
    return SecretRef(provider="environment", key="AMAZON/SP_API/READ_ONLY", purpose="unit-test")


def make_request(operation: ReadOperation = ReadOperation.SPAPI_CATALOG_GET_ITEM) -> ConnectorRequest:
    return ConnectorRequest(
        operation=operation,
        seller_account_id="seller-test",
        marketplace_id="ATVPDKIKX0DER",
        resource_id="B0TEST0001",
        correlation_id="corr-001",
    )


def test_spapi_read_returns_payload_and_trace() -> None:
    transport = FakeTransport([TransportResponse(payload={"asin": "B0TEST0001"}, request_id="req-1")])
    connector = AmazonReadConnector(transport=transport, credential_ref=make_ref())
    response = connector.read(make_request())
    assert response.data == {"asin": "B0TEST0001"}
    assert response.trace.operation is ReadOperation.SPAPI_CATALOG_GET_ITEM
    assert response.trace.transport_request_id == "req-1"
    assert response.trace.mock is True
    assert response.trace.attempt_count == 1


def test_ads_read_uses_ads_family() -> None:
    transport = FakeTransport([TransportResponse(payload={"campaigns": []}, request_id="ads-1")])
    connector = AmazonReadConnector(transport=transport, credential_ref=make_ref())
    response = connector.read(make_request(ReadOperation.ADS_CAMPAIGNS_LIST))
    assert response.trace.api_family.value == "ads_api"


def test_transport_receives_secret_reference_key_not_secret_value() -> None:
    transport = FakeTransport()
    connector = AmazonReadConnector(transport=transport, credential_ref=make_ref())
    connector.read(make_request())
    sent = transport.requests[0]
    assert sent.credential_ref_key == "AMAZON/SP_API/READ_ONLY"
    assert "dummy" not in repr(sent)


def test_auth_failure_is_not_retried() -> None:
    transport = FakeTransport([ConnectorAuthError("unauthorized")])
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=make_ref(),
        retry_policy=RetryPolicy(max_attempts=3),
    )
    with pytest.raises(ConnectorAuthError):
        connector.read(make_request())
    assert len(transport.requests) == 1


def test_rate_limit_retries_then_succeeds() -> None:
    transport = FakeTransport([
        ConnectorRateLimitError("429"),
        TransportResponse(payload={"ok": True}, request_id="req-2"),
    ])
    connector = AmazonReadConnector(transport=transport, credential_ref=make_ref())
    response = connector.read(make_request())
    assert response.trace.attempt_count == 2
    assert len(transport.requests) == 2


def test_timeout_retries_until_limit_then_fails() -> None:
    transport = FakeTransport([
        ConnectorTimeoutError("timeout-1"),
        ConnectorTimeoutError("timeout-2"),
    ])
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=make_ref(),
        retry_policy=RetryPolicy(max_attempts=2),
    )
    with pytest.raises(ConnectorTimeoutError):
        connector.read(make_request())
    assert len(transport.requests) == 2


def test_trace_preserves_correlation_and_scope() -> None:
    transport = FakeTransport()
    connector = AmazonReadConnector(transport=transport, credential_ref=make_ref())
    response = connector.read(make_request())
    assert response.trace.correlation_id == "corr-001"
    assert response.trace.seller_account_id == "seller-test"
    assert response.trace.marketplace_id == "ATVPDKIKX0DER"
