from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from amazon_read_connector import (
    AmazonApiFamily,
    AmazonReadConnector,
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorRequest,
    ConnectorTimeoutError,
    ReadOperation,
    RetryPolicy,
    TransportRequest,
)
from secrets_runtime import EnvironmentSecretProvider, SecretRef
from spapi_read import HttpClientTimeout, HttpResponse, SpApiHttpError, SpApiReadTransport


DUMMY_TOKEN = "dummy-lwa-access-token-never-real"


@dataclass
class FakeHttpClient:
    outcomes: list[HttpResponse | Exception]
    calls: list[dict[str, Any]] = field(default_factory=list)

    def get(
        self,
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout_seconds: float,
    ) -> HttpResponse:
        self.calls.append(
            {
                "url": url,
                "headers": dict(headers),
                "params": dict(params),
                "timeout_seconds": timeout_seconds,
            }
        )
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def token_ref() -> SecretRef:
    return SecretRef(
        provider="environment",
        key="AMAZON/SP_API/READ_ONLY",
        purpose="unit-test-spapi-read",
    )


def request() -> TransportRequest:
    return TransportRequest(
        api_family=AmazonApiFamily.SP_API,
        operation=ReadOperation.SPAPI_CATALOG_GET_ITEM,
        seller_account_id="seller-test",
        marketplace_id="ATVPDKIKX0DER",
        resource_id="B0TEST0001",
        correlation_id="corr-spapi-1",
        credential_ref_key=token_ref().key,
    )


def transport(http: FakeHttpClient) -> SpApiReadTransport:
    return SpApiReadTransport(
        http_client=http,
        secret_provider=EnvironmentSecretProvider({token_ref().key: DUMMY_TOKEN}),
        access_token_ref=token_ref(),
        timeout_seconds=7.5,
    )


def test_success_uses_get_access_token_and_parses_response_metadata() -> None:
    http = FakeHttpClient(
        [
            HttpResponse(
                status_code=200,
                headers={
                    "x-amzn-requestid": "request-123",
                    "x-amzn-ratelimit-limit": "2.0",
                },
                payload={"asin": "B0TEST0001"},
            )
        ]
    )
    result = transport(http).send(request())

    assert result.payload == {"asin": "B0TEST0001"}
    assert result.request_id == "request-123"
    assert result.rate_limit == "2.0"
    assert result.status_code == 200
    assert http.calls[0]["url"].startswith("https://sellingpartnerapi-na.amazon.com/")
    assert http.calls[0]["headers"]["x-amz-access-token"] == DUMMY_TOKEN
    assert http.calls[0]["timeout_seconds"] == 7.5


def test_auth_failures_map_to_non_retryable_connector_auth_error() -> None:
    http = FakeHttpClient([HttpResponse(status_code=403, headers={}, payload={"errors": []})])
    with pytest.raises(ConnectorAuthError):
        transport(http).send(request())


def test_429_maps_to_rate_limit_error() -> None:
    http = FakeHttpClient([HttpResponse(status_code=429, headers={}, payload={"errors": []})])
    with pytest.raises(ConnectorRateLimitError):
        transport(http).send(request())


def test_timeout_maps_to_connector_timeout() -> None:
    http = FakeHttpClient([HttpClientTimeout("timeout")])
    with pytest.raises(ConnectorTimeoutError):
        transport(http).send(request())


def test_other_http_errors_preserve_status_without_response_body_in_exception() -> None:
    http = FakeHttpClient(
        [HttpResponse(status_code=500, headers={"x-amzn-requestid": "req-500"}, payload={"secret": DUMMY_TOKEN})]
    )
    with pytest.raises(SpApiHttpError) as exc_info:
        transport(http).send(request())
    assert exc_info.value.status_code == 500
    assert exc_info.value.request_id == "req-500"
    assert DUMMY_TOKEN not in str(exc_info.value)


def test_full_connector_retries_rate_limit_then_exposes_source_trace_metadata() -> None:
    http = FakeHttpClient(
        [
            HttpResponse(status_code=429, headers={}, payload={}),
            HttpResponse(
                status_code=200,
                headers={
                    "x-amzn-requestid": "req-after-retry",
                    "x-amzn-ratelimit-limit": "5.0",
                },
                payload={"ok": True},
            ),
        ]
    )
    sp_transport = transport(http)
    connector = AmazonReadConnector(
        transport=sp_transport,
        credential_ref=token_ref(),
        retry_policy=RetryPolicy(max_attempts=2),
        mock_transport=True,
    )
    response = connector.read(
        ConnectorRequest(
            operation=ReadOperation.SPAPI_CATALOG_GET_ITEM,
            seller_account_id="seller-test",
            marketplace_id="ATVPDKIKX0DER",
            resource_id="B0TEST0001",
            correlation_id="corr-spapi-1",
        )
    )

    assert response.data == {"ok": True}
    assert response.trace.attempt_count == 2
    assert response.trace.transport_request_id == "req-after-retry"
    assert response.trace.rate_limit == "5.0"
    assert response.trace.response_status_code == 200
    assert response.trace.mock is True
