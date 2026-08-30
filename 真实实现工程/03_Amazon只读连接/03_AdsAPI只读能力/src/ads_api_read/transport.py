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

from .http import AdsHttpClient, AdsHttpTimeout
from .models import AdsProfileResolver
from .routing import build_post_target


class AdsApiHttpError(ConnectorTransportError):
    def __init__(self, status_code: int, request_id: str | None = None) -> None:
        super().__init__(f"Amazon Ads API request failed with HTTP {status_code}")
        self.status_code = status_code
        self.request_id = request_id


def _parse_retry_after(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if parsed >= 0 else None


class AdsApiReadTransport:
    """Semantic read-only Amazon Ads transport.

    Sponsored Products list operations use HTTP POST, but this transport only
    accepts operations already represented by the shared ReadOperation enum.
    """

    def __init__(
        self,
        *,
        http_client: AdsHttpClient,
        secret_provider: SecretProvider,
        access_token_ref: SecretRef,
        client_id: str,
        profile_resolver: AdsProfileResolver,
        timeout_seconds: float = 10.0,
    ) -> None:
        if not client_id.strip():
            raise ValueError("Amazon Ads API client_id is required")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self._http_client = http_client
        self._secret_provider = secret_provider
        self._access_token_ref = access_token_ref
        self._client_id = client_id
        self._profile_resolver = profile_resolver
        self._timeout_seconds = timeout_seconds

    def send(self, request: TransportRequest) -> TransportResponse:
        if request.api_family is not AmazonApiFamily.ADS_API:
            raise ValueError("AdsApiReadTransport only accepts ADS_API requests")
        if request.credential_ref_key != self._access_token_ref.key:
            raise ValueError("transport credential reference does not match connector reference")

        profile = self._profile_resolver.resolve(
            seller_account_id=request.seller_account_id,
            marketplace_id=request.marketplace_id,
        )
        url, json_body, media_type = build_post_target(request, profile)

        secret = self._secret_provider.resolve(self._access_token_ref)
        access_token = secret.reveal_for_authorized_client()
        headers = {
            "authorization": f"Bearer {access_token}",
            "amazon-advertising-api-clientid": self._client_id,
            "amazon-advertising-api-scope": profile.profile_id,
            "accept": media_type,
            "content-type": media_type,
        }

        try:
            response = self._http_client.post_json(
                url,
                headers=headers,
                json_body=json_body,
                timeout_seconds=self._timeout_seconds,
            )
        except AdsHttpTimeout as exc:
            raise ConnectorTimeoutError("Amazon Ads API request timed out") from exc

        request_id = (
            response.headers.get("amazon-advertising-api-requestid")
            or response.headers.get("x-amzn-requestid")
        )
        rate_limit = response.headers.get("x-amzn-ratelimit-limit")

        if response.status_code in {401, 403}:
            raise ConnectorAuthError(
                f"Amazon Ads API authorization failed with HTTP {response.status_code}"
            )
        if response.status_code == 429:
            raise ConnectorRateLimitError(
                "Amazon Ads API rate limit exceeded",
                retry_after_seconds=_parse_retry_after(response.headers.get("retry-after")),
            )
        if response.status_code < 200 or response.status_code >= 300:
            raise AdsApiHttpError(response.status_code, request_id=request_id)

        return TransportResponse(
            payload=response.payload,
            request_id=request_id,
            rate_limit=rate_limit,
            status_code=response.status_code,
        )
