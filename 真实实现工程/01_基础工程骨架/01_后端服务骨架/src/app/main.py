from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal, Protocol

from fastapi import FastAPI, Request, Response, status
from pydantic import BaseModel


SERVICE_NAME = "amazon-intelligent-operations-runtime"
SERVICE_VERSION = "0.1.0"
IMPLEMENTATION_STAGE = "P1-BASE-REINFORCEMENT"


class DependencyHealthResponse(BaseModel):
    name: str
    status: Literal["ok", "degraded", "unavailable", "unknown"]
    checked_at: datetime
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "unavailable", "unknown"]
    service: str
    checked_at: datetime
    ready: bool
    dependencies: tuple[DependencyHealthResponse, ...] = ()
    write_capability: Literal[False] = False


class LivenessResponse(BaseModel):
    status: Literal["alive"] = "alive"
    service: str
    version: str
    write_capability: Literal[False] = False


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    service: str
    checked_at: datetime
    reason: str | None = None
    write_capability: Literal[False] = False


class VersionResponse(BaseModel):
    service: str
    version: str
    stage: str
    contract_level: str


class HealthSnapshotProvider(Protocol):
    def snapshot(self) -> Any:
        """Return a Pydantic-compatible health snapshot."""


def _coerce_health_snapshot(snapshot: Any) -> HealthResponse:
    if hasattr(snapshot, "model_dump"):
        payload = snapshot.model_dump()
    elif isinstance(snapshot, dict):
        payload = snapshot
    else:
        raise TypeError("health provider returned unsupported snapshot type")
    return HealthResponse.model_validate(payload)


def _unconfigured_health() -> HealthResponse:
    return HealthResponse(
        status="degraded",
        service=SERVICE_NAME,
        checked_at=datetime.now(UTC),
        ready=False,
        dependencies=(),
        write_capability=False,
    )


def create_app(*, health_provider: HealthSnapshotProvider | None = None) -> FastAPI:
    app = FastAPI(
        title="Amazon Intelligent Operations Runtime",
        version=SERVICE_VERSION,
    )
    app.state.health_provider = health_provider

    @app.get("/live", response_model=LivenessResponse)
    def live() -> LivenessResponse:
        return LivenessResponse(
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            write_capability=False,
        )

    @app.get("/ready", response_model=ReadinessResponse)
    def ready(request: Request, response: Response) -> ReadinessResponse:
        provider = getattr(request.app.state, "health_provider", None)
        if provider is None:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return ReadinessResponse(
                status="not_ready",
                service=SERVICE_NAME,
                checked_at=datetime.now(UTC),
                reason="health_provider_not_installed",
                write_capability=False,
            )

        snapshot = _coerce_health_snapshot(provider.snapshot())
        if not snapshot.ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="ready" if snapshot.ready else "not_ready",
            service=snapshot.service,
            checked_at=snapshot.checked_at,
            reason=None if snapshot.ready else f"health_status:{snapshot.status}",
            write_capability=False,
        )

    @app.get("/health", response_model=HealthResponse)
    def health(request: Request, response: Response) -> HealthResponse:
        provider = getattr(request.app.state, "health_provider", None)
        snapshot = _unconfigured_health() if provider is None else _coerce_health_snapshot(provider.snapshot())
        if not snapshot.ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return snapshot

    @app.get("/version", response_model=VersionResponse)
    def version() -> VersionResponse:
        return VersionResponse(
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            stage=IMPLEMENTATION_STAGE,
            contract_level="RUNTIME_FOUNDATION_REINFORCEMENT",
        )

    return app


app = create_app()
