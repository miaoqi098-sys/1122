from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_only_reports_process_alive() -> None:
    client = TestClient(create_app())

    response = client.get("/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "alive"
    assert payload["write_capability"] is False


def test_unconfigured_runtime_is_not_ready_and_health_is_degraded() -> None:
    client = TestClient(create_app())

    ready = client.get("/ready")
    health = client.get("/health")

    assert ready.status_code == 503
    assert ready.json()["status"] == "not_ready"
    assert ready.json()["reason"] == "health_provider_not_installed"

    assert health.status_code == 503
    payload = health.json()
    assert payload["status"] == "degraded"
    assert payload["ready"] is False
    assert payload["write_capability"] is False


def test_version_exposes_runtime_reinforcement_contract_level() -> None:
    client = TestClient(create_app())

    response = client.get("/version")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "amazon-intelligent-operations-runtime"
    assert payload["contract_level"] == "RUNTIME_FOUNDATION_REINFORCEMENT"
