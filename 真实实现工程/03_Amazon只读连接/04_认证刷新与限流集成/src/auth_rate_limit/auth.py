from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any, Mapping, Protocol

import httpx
from pydantic import SecretStr

from secrets_runtime import SecretProvider, SecretRef, SecretValue


LWA_TOKEN_ENDPOINT = "https://api.amazon.com/auth/o2/token"


class LwaRefreshError(RuntimeError):
    """Sanitized refresh failure. Never include OAuth response bodies or secrets."""


@dataclass(frozen=True)
class LwaTokenHttpResponse:
    status_code: int
    payload: Mapping[str, Any] | None


class LwaTokenHttpClient(Protocol):
    def post_form(
        self,
        url: str,
        *,
        form: Mapping[str, str],
        timeout_seconds: float,
    ) -> LwaTokenHttpResponse:
        ...


class HttpxLwaTokenHttpClient:
    def post_form(
        self,
        url: str,
        *,
        form: Mapping[str, str],
        timeout_seconds: float,
    ) -> LwaTokenHttpResponse:
        if url != LWA_TOKEN_ENDPOINT:
            raise ValueError("LWA token client only permits the fixed Amazon token endpoint")
        try:
            response = httpx.post(
                url,
                data=dict(form),
                headers={"content-type": "application/x-www-form-urlencoded"},
                timeout=timeout_seconds,
                follow_redirects=False,
            )
        except httpx.TimeoutException as exc:
            raise LwaRefreshError("LWA token refresh timed out") from exc

        try:
            payload = response.json()
        except ValueError:
            payload = None
        if payload is not None and not isinstance(payload, dict):
            payload = None
        return LwaTokenHttpResponse(status_code=response.status_code, payload=payload)


class Clock(Protocol):
    def now(self) -> float:
        ...


class SystemMonotonicClock:
    def now(self) -> float:
        return monotonic()


class AccessTokenProvider(Protocol):
    def get_access_token(self) -> SecretStr:
        ...


@dataclass(frozen=True)
class _CachedAccessToken:
    value: SecretStr
    refresh_at: float


class CachedLwaAccessTokenProvider:
    """Refresh-on-demand LWA access token provider with in-process caching."""

    def __init__(
        self,
        *,
        http_client: LwaTokenHttpClient,
        secret_provider: SecretProvider,
        refresh_token_ref: SecretRef,
        client_secret_ref: SecretRef,
        client_id: str,
        clock: Clock | None = None,
        refresh_skew_seconds: float = 60.0,
        timeout_seconds: float = 10.0,
    ) -> None:
        if not client_id.strip():
            raise ValueError("LWA client_id is required")
        if refresh_skew_seconds < 0:
            raise ValueError("refresh_skew_seconds must be non-negative")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self._http_client = http_client
        self._secret_provider = secret_provider
        self._refresh_token_ref = refresh_token_ref
        self._client_secret_ref = client_secret_ref
        self._client_id = client_id
        self._clock = clock or SystemMonotonicClock()
        self._refresh_skew_seconds = refresh_skew_seconds
        self._timeout_seconds = timeout_seconds
        self._cached: _CachedAccessToken | None = None
        self._lock = Lock()

    def get_access_token(self) -> SecretStr:
        now = self._clock.now()
        cached = self._cached
        if cached is not None and now < cached.refresh_at:
            return cached.value

        with self._lock:
            now = self._clock.now()
            cached = self._cached
            if cached is not None and now < cached.refresh_at:
                return cached.value
            refreshed = self._refresh(now)
            self._cached = refreshed
            return refreshed.value

    def _refresh(self, now: float) -> _CachedAccessToken:
        refresh_token = self._secret_provider.resolve(
            self._refresh_token_ref
        ).reveal_for_authorized_client()
        client_secret = self._secret_provider.resolve(
            self._client_secret_ref
        ).reveal_for_authorized_client()

        response = self._http_client.post_form(
            LWA_TOKEN_ENDPOINT,
            form={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": self._client_id,
                "client_secret": client_secret,
            },
            timeout_seconds=self._timeout_seconds,
        )

        if response.status_code != 200:
            raise LwaRefreshError(
                f"LWA token refresh failed with HTTP {response.status_code}"
            )
        payload = response.payload or {}
        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in")
        if not isinstance(access_token, str) or not access_token:
            raise LwaRefreshError("LWA token response missing access_token")
        if not isinstance(expires_in, (int, float)) or expires_in <= 0:
            raise LwaRefreshError("LWA token response missing valid expires_in")

        refresh_at = now + max(1.0, float(expires_in) - self._refresh_skew_seconds)
        return _CachedAccessToken(value=SecretStr(access_token), refresh_at=refresh_at)


class RefreshingAccessTokenSecretProvider:
    """Adapts a dynamic AccessTokenProvider to the existing SecretProvider contract."""

    def __init__(self, *, access_token_ref: SecretRef, provider: AccessTokenProvider) -> None:
        self._access_token_ref = access_token_ref
        self._provider = provider

    def resolve(self, ref: SecretRef) -> SecretValue:
        if ref != self._access_token_ref:
            raise ValueError("dynamic provider only resolves its configured access-token ref")
        return SecretValue(ref=ref, value=self._provider.get_access_token())
