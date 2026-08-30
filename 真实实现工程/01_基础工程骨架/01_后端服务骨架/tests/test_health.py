from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_read_only_runtime() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["stage"] == "P1-01"
    assert payload["write_capability"] is False


def test_version_exposes_contract_level() -> None:
    client = TestClient(create_app())

    response = client.get("/version")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "amazon-intelligent-operations-runtime"
    assert payload["contract_level"] == "STATIC_CONTRACT_VERIFIED"
