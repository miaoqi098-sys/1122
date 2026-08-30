from collections import deque

import pytest

from auth_rate_limit import (
    LWA_TOKEN_ENDPOINT,
    CachedLwaAccessTokenProvider,
    LwaRefreshError,
    LwaTokenHttpResponse,
    RefreshingAccessTokenSecretProvider,
)
from secrets_runtime import EnvironmentSecretProvider, SecretRef


class FakeClock:
    def __init__(self, now=0.0):
        self.value = float(now)

    def now(self):
        return self.value

    def advance(self, seconds):
        self.value += seconds


class FakeLwaHttpClient:
    def __init__(self, outcomes):
        self.outcomes = deque(outcomes)
        self.calls = []

    def post_form(self, url, *, form, timeout_seconds):
        self.calls.append(
            {"url": url, "form": dict(form), "timeout_seconds": timeout_seconds}
        )
        return self.outcomes.popleft()


def _ref(key, purpose):
    return SecretRef(provider="environment", key=key, purpose=purpose)


def _build_provider(http, clock):
    refresh_ref = _ref("AMAZON/LWA/REFRESH_TOKEN", "LWA refresh token")
    secret_ref = _ref("AMAZON/LWA/CLIENT_SECRET", "LWA client secret")
    provider = CachedLwaAccessTokenProvider(
        http_client=http,
        secret_provider=EnvironmentSecretProvider(
            {
                refresh_ref.key: "dummy-refresh-token",
                secret_ref.key: "dummy-client-secret",
            }
        ),
        refresh_token_ref=refresh_ref,
        client_secret_ref=secret_ref,
        client_id="dummy-client-id",
        clock=clock,
        refresh_skew_seconds=10,
        timeout_seconds=4,
    )
    return provider


def test_access_token_is_refreshed_once_then_cached_until_refresh_window():
    clock = FakeClock()
    http = FakeLwaHttpClient(
        [
            LwaTokenHttpResponse(
                status_code=200,
                payload={"access_token": "token-one", "expires_in": 100, "token_type": "bearer"},
            ),
            LwaTokenHttpResponse(
                status_code=200,
                payload={"access_token": "token-two", "expires_in": 100, "token_type": "bearer"},
            ),
        ]
    )
    provider = _build_provider(http, clock)

    assert provider.get_access_token().get_secret_value() == "token-one"
    assert provider.get_access_token().get_secret_value() == "token-one"
    assert len(http.calls) == 1

    clock.advance(90)
    assert provider.get_access_token().get_secret_value() == "token-two"
    assert len(http.calls) == 2

    first_call = http.calls[0]
    assert first_call["url"] == LWA_TOKEN_ENDPOINT
    assert first_call["form"] == {
        "grant_type": "refresh_token",
        "refresh_token": "dummy-refresh-token",
        "client_id": "dummy-client-id",
        "client_secret": "dummy-client-secret",
    }


def test_refresh_failure_is_sanitized_and_does_not_expose_payload():
    clock = FakeClock()
    http = FakeLwaHttpClient(
        [
            LwaTokenHttpResponse(
                status_code=400,
                payload={"error_description": "dummy-refresh-token must never appear"},
            )
        ]
    )

    with pytest.raises(LwaRefreshError) as exc_info:
        _build_provider(http, clock).get_access_token()

    text = str(exc_info.value)
    assert "400" in text
    assert "dummy-refresh-token" not in text


def test_malformed_success_response_fails_closed():
    clock = FakeClock()
    http = FakeLwaHttpClient(
        [LwaTokenHttpResponse(status_code=200, payload={"expires_in": 3600})]
    )

    with pytest.raises(LwaRefreshError, match="access_token"):
        _build_provider(http, clock).get_access_token()


def test_dynamic_secret_provider_only_resolves_configured_access_token_ref():
    clock = FakeClock()
    http = FakeLwaHttpClient(
        [
            LwaTokenHttpResponse(
                status_code=200,
                payload={"access_token": "token-one", "expires_in": 3600},
            )
        ]
    )
    token_provider = _build_provider(http, clock)
    access_ref = _ref("AMAZON/SPAPI/ACCESS_TOKEN", "dynamic access token")
    dynamic = RefreshingAccessTokenSecretProvider(
        access_token_ref=access_ref,
        provider=token_provider,
    )

    assert dynamic.resolve(access_ref).reveal_for_authorized_client() == "token-one"

    with pytest.raises(ValueError, match="configured access-token ref"):
        dynamic.resolve(_ref("AMAZON/ADS/ACCESS_TOKEN", "other access token"))
