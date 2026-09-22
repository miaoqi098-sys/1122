import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from configuration import RuntimeSettings
from observability.health import DependencyHealth, ServiceHealth
from runtime_health import RuntimeHealthProvider, StaticDependencyProbe
from runtime_integration import build_application


class ExplodingProbe:
    name = "exploding"

    def check(self) -> DependencyHealth:
        raise RuntimeError("secret-ish internal failure detail")


def test_runtime_health_without_dependencies_is_ready_and_read_only() -> None:
    provider = RuntimeHealthProvider(RuntimeSettings())
    snapshot = provider.snapshot()

    assert snapshot.status == "ok"
    assert snapshot.ready is True
    assert snapshot.write_capability is False
    assert snapshot.dependencies == ()


def test_degraded_dependency_fails_readiness_closed() -> None:
    provider = RuntimeHealthProvider(
        RuntimeSettings(),
        probes=(StaticDependencyProbe(name="dependency", status="degraded"),),
    )
    snapshot = provider.snapshot()

    assert snapshot.status == "degraded"
    assert snapshot.ready is False


def test_unavailable_dependency_fails_readiness_closed() -> None:
    provider = RuntimeHealthProvider(
        RuntimeSettings(),
        probes=(StaticDependencyProbe(name="dependency", status="unavailable"),),
    )
    snapshot = provider.snapshot()

    assert snapshot.status == "unavailable"
    assert snapshot.ready is False


def test_probe_exception_becomes_unavailable_without_exception_message_leak() -> None:
    provider = RuntimeHealthProvider(RuntimeSettings(), probes=(ExplodingProbe(),))
    snapshot = provider.snapshot()

    assert snapshot.status == "unavailable"
    assert snapshot.ready is False
    assert snapshot.dependencies[0].detail == "probe_failed:RuntimeError"
    assert "secret-ish" not in (snapshot.dependencies[0].detail or "")


def test_service_health_cannot_be_constructed_with_write_capability() -> None:
    with pytest.raises(ValidationError):
        ServiceHealth(
            status="ok",
            service="runtime",
            ready=True,
            write_capability=True,
        )


def test_composed_application_is_ready_with_runtime_health_provider() -> None:
    client = TestClient(build_application({"READ_ONLY_MODE": "true"}))

    live = client.get("/live")
    ready = client.get("/ready")
    health = client.get("/health")

    assert live.status_code == 200
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["write_capability"] is False
    assert health.status_code == 200
    assert health.json()["ready"] is True
    assert health.json()["write_capability"] is False
