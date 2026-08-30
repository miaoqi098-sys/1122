from __future__ import annotations

from dataclasses import dataclass

from secrets_runtime.models import SecretRef

from .models import ConnectorRequest, ConnectorResponse, SourceTrace, TransportRequest
from .policy import api_family_for, assert_read_only_operation
from .transport import (
    ConnectorAuthError,
    ConnectorRateLimitError,
    ConnectorTimeoutError,
    ConnectorTransport,
)


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3

    def __post_init__(self) -> None:
        if self.max_attempts < 1 or self.max_attempts > 5:
            raise ValueError("max_attempts must be between 1 and 5")


class AmazonReadConnector:
    """Read-only connector boundary. It never reveals or persists credential values."""

    def __init__(
        self,
        *,
        transport: ConnectorTransport,
        credential_ref: SecretRef,
        retry_policy: RetryPolicy | None = None,
        mock_transport: bool = True,
    ) -> None:
        self._transport = transport
        self._credential_ref = credential_ref
        self._retry_policy = retry_policy or RetryPolicy()
        self._mock_transport = mock_transport

    def read(self, request: ConnectorRequest) -> ConnectorResponse:
        assert_read_only_operation(request.operation)
        api_family = api_family_for(request.operation)
        transport_request = TransportRequest(
            api_family=api_family,
            operation=request.operation,
            seller_account_id=request.seller_account_id,
            marketplace_id=request.marketplace_id,
            resource_id=request.resource_id,
            params=request.params,
            correlation_id=request.correlation_id,
            credential_ref_key=self._credential_ref.key,
        )

        attempt = 0
        while attempt < self._retry_policy.max_attempts:
            attempt += 1
            try:
                result = self._transport.send(transport_request)
                return ConnectorResponse(
                    data=result.payload,
                    trace=SourceTrace(
                        api_family=api_family,
                        operation=request.operation,
                        seller_account_id=request.seller_account_id,
                        marketplace_id=request.marketplace_id,
                        correlation_id=request.correlation_id,
                        transport_request_id=result.request_id,
                        rate_limit=result.rate_limit,
                        response_status_code=result.status_code,
                        attempt_count=attempt,
                        mock=self._mock_transport,
                    ),
                )
            except ConnectorAuthError:
                raise
            except (ConnectorRateLimitError, ConnectorTimeoutError):
                if attempt >= self._retry_policy.max_attempts:
                    raise

        raise RuntimeError("connector retry loop terminated unexpectedly")
