from __future__ import annotations

from amazon_read_connector import (
    AmazonApiFamily,
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorTimeoutError,
    ConnectorTransportError,
    TransportRequest,
    TransportResponse,
)
from secrets_runtime import SecretProvider, SecretRef

from .http import HttpClient, HttpClientTimeout
from .routing import build_get_target


class SpApiHttpError(ConnectorTransportError):
    def __init__(self, status_code: int, request_id: str | None = None) -> None:
        super().__init__(f"SP-API request failed with HTTP {status_code}")
        self.status_code = status_code
        self.request_id = request_id


class SpApiReadTransport:
    """GET-only SP-API transport. Access token exists only during one send call."""

    def __init__(
        self,
        *,
        http_client: HttpClient,
        secret_provider: SecretProvider,
        access_token_ref: SecretRef,
        timeout_seconds: float = 10.0,
        user_agent: str = "amazon-intelligent-operations-runtime/0.1",
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self._http_client = http_client
        self._secret_provider = secret_provider
        self._access_token_ref = access_token_ref
        self._timeout_seconds = timeout_seconds
        self._user_agent = user_agent

    def send(self, request: TransportRequest) -> TransportResponse:
        if request.api_family is not AmazonApiFamily.SP_API:
            raise ValueError("SpApiReadTransport only accepts SP_API requests")
        if request.credential_ref_key != self._access_token_ref.key:
            raise ValueError("transport credential reference does not match connector reference")

        url, params = build_get_target(request)
        secret = self._secret_provider.resolve(self._access_token_ref)
        access_token = secret.reveal_for_authorized_client()
        headers = {
            "accept": "application/json",
            "user-agent": self._user_agent,
            "x-amz-access-token": access_token,
        }

        try:
            response = self._http_client.get(
                url,
                headers=headers,
                params=params,
                timeout_seconds=self._timeout_seconds,
            )
        except HttpClientTimeout as exc:
            raise ConnectorTimeoutError("SP-API request timed out") from exc

        request_id = response.headers.get("x-amzn-requestid")
        rate_limit = response.headers.get("x-amzn-ratelimit-limit")

        if response.status_code in {401, 403}:
            raise ConnectorAuthError(f"SP-API authorization failed with HTTP {response.status_code}")
        if response.status_code == 429:
            raise ConnectorRateLimitError("SP-API rate limit exceeded")
        if response.status_code < 200 or response.status_code >= 300:
            raise SpApiHttpError(response.status_code, request_id=request_id)

        return TransportResponse(
            payload=response.payload,
            request_id=request_id,
            rate_limit=rate_limit,
            status_code=response.status_code,
        )
