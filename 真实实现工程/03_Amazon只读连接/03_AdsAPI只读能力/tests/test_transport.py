from collections import deque

import pytest

from amazon_read_connector import (
    AmazonReadConnector,
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorRequest,
    ConnectorTimeoutError,
    ReadOperation,
)
from ads_api_read import (
    AdsApiHttpError,
    AdsApiReadTransport,
    AdsHttpResponse,
    AdsHttpTimeout,
    AdsProfile,
    AdsRegion,
    StaticAdsProfileResolver,
)
from secrets_runtime import EnvironmentSecretProvider, SecretRef


class FakeAdsHttpClient:
    def __init__(self, outcomes):
        self._outcomes = deque(outcomes)
        self.calls = []

    def post_json(self, url, *, headers, json_body, timeout_seconds):
        self.calls.append(
            {
                "url": url,
                "headers": dict(headers),
                "json_body": dict(json_body),
                "timeout_seconds": timeout_seconds,
            }
        )
        outcome = self._outcomes.popleft()
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _token_ref() -> SecretRef:
    return SecretRef(
        provider="environment",
        key="AMAZON/ADS/ACCESS_TOKEN",
        purpose="Amazon Ads API access token",
    )


def _resolver() -> StaticAdsProfileResolver:
    return StaticAdsProfileResolver(
        (
            AdsProfile(
                profile_id="profile-123",
                seller_account_id="seller-1",
                marketplace_id="ATVPDKIKX0DER",
                region=AdsRegion.NA,
            ),
        )
    )


def _transport(http_client) -> AdsApiReadTransport:
    return AdsApiReadTransport(
        http_client=http_client,
        secret_provider=EnvironmentSecretProvider(
            {"AMAZON/ADS/ACCESS_TOKEN": "dummy-access-token"}
        ),
        access_token_ref=_token_ref(),
        client_id="dummy-client-id",
        profile_resolver=_resolver(),
        timeout_seconds=4.0,
    )


def _connector(http_client, *, max_attempts=3):
    from amazon_read_connector import RetryPolicy

    return AmazonReadConnector(
        transport=_transport(http_client),
        credential_ref=_token_ref(),
        retry_policy=RetryPolicy(max_attempts=max_attempts),
        mock_transport=True,
    )


def _request(operation=ReadOperation.ADS_CAMPAIGNS_LIST):
    return ConnectorRequest(
        operation=operation,
        seller_account_id="seller-1",
        marketplace_id="ATVPDKIKX0DER",
        params={"stateFilter": {"include": ["ENABLED"]}},
        correlation_id="corr-ads-1",
    )


def test_ads_transport_builds_scoped_read_request_and_trace():
    http = FakeAdsHttpClient(
        [
            AdsHttpResponse(
                status_code=200,
                payload={"campaigns": [{"campaignId": "1"}]},
                headers={
                    "amazon-advertising-api-requestid": "ads-request-1",
                    "x-amzn-ratelimit-limit": "10.0",
                },
            )
        ]
    )

    response = _connector(http).read(_request())

    call = http.calls[0]
    assert call["url"] == "https://advertising-api.amazon.com/sp/campaigns/list"
    assert call["json_body"] == {"stateFilter": {"include": ["ENABLED"]}}
    assert call["headers"]["authorization"] == "Bearer dummy-access-token"
    assert call["headers"]["amazon-advertising-api-clientid"] == "dummy-client-id"
    assert call["headers"]["amazon-advertising-api-scope"] == "profile-123"
    assert call["headers"]["content-type"] == "application/vnd.spCampaign.v3+json"
    assert response.data["campaigns"][0]["campaignId"] == "1"
    assert response.trace.transport_request_id == "ads-request-1"
    assert response.trace.rate_limit == "10.0"
    assert response.trace.response_status_code == 200
    assert response.trace.mock is True


def test_auth_failure_fails_closed_without_retry():
    http = FakeAdsHttpClient(
        [AdsHttpResponse(status_code=401, payload={"message": "no"}, headers={})]
    )

    with pytest.raises(ConnectorAuthError):
        _connector(http).read(_request())

    assert len(http.calls) == 1


def test_rate_limit_is_retried_by_connector_with_bound():
    http = FakeAdsHttpClient(
        [
            AdsHttpResponse(status_code=429, payload={}, headers={}),
            AdsHttpResponse(status_code=200, payload={"campaigns": []}, headers={}),
        ]
    )

    response = _connector(http, max_attempts=2).read(_request())
    assert response.data == {"campaigns": []}
    assert response.trace.attempt_count == 2
    assert len(http.calls) == 2


def test_timeout_maps_to_connector_timeout_and_is_bounded():
    http = FakeAdsHttpClient([AdsHttpTimeout("timeout"), AdsHttpTimeout("timeout")])

    with pytest.raises(ConnectorTimeoutError):
        _connector(http, max_attempts=2).read(_request())

    assert len(http.calls) == 2


def test_non_2xx_error_is_sanitized():
    http = FakeAdsHttpClient(
        [
            AdsHttpResponse(
                status_code=500,
                payload={"secret": "must-not-enter-exception"},
                headers={"amazon-advertising-api-requestid": "ads-request-500"},
            )
        ]
    )

    with pytest.raises(AdsApiHttpError) as exc_info:
        _connector(http).read(_request())

    text = str(exc_info.value)
    assert "500" in text
    assert "must-not-enter-exception" not in text


def test_missing_profile_mapping_fails_before_http_call():
    http = FakeAdsHttpClient([])
    transport = AdsApiReadTransport(
        http_client=http,
        secret_provider=EnvironmentSecretProvider(
            {"AMAZON/ADS/ACCESS_TOKEN": "dummy-access-token"}
        ),
        access_token_ref=_token_ref(),
        client_id="dummy-client-id",
        profile_resolver=StaticAdsProfileResolver(()),
    )
    connector = AmazonReadConnector(
        transport=transport,
        credential_ref=_token_ref(),
    )

    with pytest.raises(LookupError, match="profile mapping"):
        connector.read(_request())

    assert http.calls == []


def test_spapi_operation_is_rejected_by_shared_read_policy_family_boundary():
    http = FakeAdsHttpClient([])

    with pytest.raises(ValueError, match="ADS_API"):
        _connector(http).read(
            ConnectorRequest(
                operation=ReadOperation.SPAPI_CATALOG_GET_ITEM,
                seller_account_id="seller-1",
                marketplace_id="ATVPDKIKX0DER",
                resource_id="B000TEST",
                correlation_id="corr-spapi",
            )
        )
