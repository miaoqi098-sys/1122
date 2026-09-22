from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

import httpx


@dataclass(frozen=True)
class AdsHttpResponse:
    status_code: int
    payload: Any
    headers: Mapping[str, str]


class AdsHttpTimeout(RuntimeError):
    pass


class AdsHttpClient(Protocol):
    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        json_body: Mapping[str, Any],
        timeout_seconds: float,
    ) -> AdsHttpResponse:
        ...


class HttpxAdsHttpClient:
    """Minimal Ads API HTTP adapter. Redirects remain disabled."""

    def post_json(
        self,
        url: str,
        *,
        headers: Mapping[str, str],
        json_body: Mapping[str, Any],
        timeout_seconds: float,
    ) -> AdsHttpResponse:
        try:
            response = httpx.post(
                url,
                headers=dict(headers),
                json=dict(json_body),
                timeout=timeout_seconds,
                follow_redirects=False,
            )
        except httpx.TimeoutException as exc:
            raise AdsHttpTimeout("Amazon Ads API request timed out") from exc

        try:
            payload: Any = response.json()
        except ValueError:
            payload = None

        return AdsHttpResponse(
            status_code=response.status_code,
            payload=payload,
            headers={key.lower(): value for key, value in response.headers.items()},
        )
