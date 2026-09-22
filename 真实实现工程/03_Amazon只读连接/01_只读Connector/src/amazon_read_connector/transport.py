from __future__ import annotations

from collections import deque
from typing import Protocol

from .models import TransportRequest, TransportResponse


class ConnectorTransportError(RuntimeError):
    pass


class ConnectorAuthError(ConnectorTransportError):
    pass


class ConnectorRateLimitError(ConnectorTransportError):
    def __init__(
        self,
        message: str = "connector rate limit exceeded",
        *,
        retry_after_seconds: float | None = None,
    ) -> None:
        super().__init__(message)
        if retry_after_seconds is not None and retry_after_seconds < 0:
            retry_after_seconds = None
        self.retry_after_seconds = retry_after_seconds


class ConnectorTimeoutError(ConnectorTransportError):
    pass


class ConnectorTransport(Protocol):
    def send(self, request: TransportRequest) -> TransportResponse:
        ...


class FakeTransport:
    """Deterministic test transport. Never performs network I/O."""

    def __init__(self, outcomes: list[TransportResponse | Exception] | None = None) -> None:
        self._outcomes = deque(outcomes or [])
        self.requests: list[TransportRequest] = []

    def send(self, request: TransportRequest) -> TransportResponse:
        self.requests.append(request)
        if not self._outcomes:
            return TransportResponse(payload={"ok": True}, request_id="fake-request")
        outcome = self._outcomes.popleft()
        if isinstance(outcome, Exception):
            raise outcome
        return outcome
