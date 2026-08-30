from __future__ import annotations

from collections import deque
from typing import Protocol

from .models import TransportRequest, TransportResponse


class ConnectorTransportError(RuntimeError):
    pass


class ConnectorAuthError(ConnectorTransportError):
    pass


class ConnectorRateLimitError(ConnectorTransportError):
    pass


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
