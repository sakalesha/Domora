import pytest
from fastapi import FastAPI

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, validate_runtime_config
from app.main import create_app


def test_access_token_lifetime_cannot_be_zero_or_negative():
    with pytest.raises(RuntimeError, match="ACCESS_TOKEN_EXPIRE_MINUTES"):
        validate_runtime_config(token_expiry_minutes=0)


def test_access_token_lifetime_must_be_one_day():
    with pytest.raises(RuntimeError, match="1440"):
        validate_runtime_config(token_expiry_minutes=60)


def test_access_token_lifetime_is_one_day():
    assert ACCESS_TOKEN_EXPIRE_MINUTES == 24 * 60


def test_production_requires_exact_cors_origins():
    with pytest.raises(RuntimeError, match="CORS_ALLOWED_ORIGINS"):
        validate_runtime_config(
            app_env="production",
            secret_key="test-production-secret-key-with-at-least-32-bytes",
            cors_allowed_origins=(),
        )


def test_cors_rejects_wildcard_origins():
    with pytest.raises(RuntimeError, match="exact HTTP or HTTPS origins"):
        validate_runtime_config(cors_allowed_origins=("*",))


def test_production_rejects_default_secret():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_runtime_config(app_env="production", secret_key="local-dev-secret")


def test_development_allows_local_secret():
    validate_runtime_config(app_env="development", secret_key="local-dev-secret")


def test_app_factory_exposes_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
