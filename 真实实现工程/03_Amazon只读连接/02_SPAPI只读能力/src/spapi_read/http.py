from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import httpx


@dataclass(frozen=True)
class HttpResponse:
    status_code: int
    headers: dict[str, str]
    payload: Any


class HttpClient(Protocol):
    def get(
        self,
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout_seconds: float,
    ) -> HttpResponse:
        ...


class HttpClientTimeout(TimeoutError):
    pass


class HttpxHttpClient:
    """Production-capable GET-only adapter; tests inject a fake implementation."""

    def get(
        self,
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any],
        timeout_seconds: float,
    ) -> HttpResponse:
        try:
            with httpx.Client(timeout=timeout_seconds, follow_redirects=False) as client:
                response = client.get(url, headers=headers, params=params)
        except httpx.TimeoutException as exc:
            raise HttpClientTimeout("SP-API HTTP request timed out") from exc

        try:
            payload: Any = response.json()
        except ValueError:
            payload = {"raw_text": response.text}

        return HttpResponse(
            status_code=response.status_code,
            headers={key.lower(): value for key, value in response.headers.items()},
            payload=payload,
        )
