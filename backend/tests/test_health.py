from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_is_available_without_external_services():
    with TestClient(create_app(Settings())) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_debug_is_off_by_default():
    assert create_app(Settings()).debug is False


def test_environment_config_is_validated(monkeypatch):
    monkeypatch.setenv("ALU_APP_NAME", "Test Universe")
    monkeypatch.setenv("ALU_DEBUG", "true")
    app = create_app()
    assert app.title == "Test Universe"
    assert app.debug is True
