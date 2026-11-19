from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.main import create_app
from app.models.base import Base
from app.models import domain as _domain_models  # noqa: F401
from app.models.domain import User


@pytest.fixture(autouse=True)
def test_secret_key(monkeypatch):
    import app.config as config
    import app.core.csrf as csrf
    import app.core.security as security

    monkeypatch.setattr(security, "SECRET_KEY", "test-only-secret-key-with-at-least-32-bytes")
    monkeypatch.setattr(config, "CORS_ALLOW_ALL", False)
    monkeypatch.setattr(csrf, "CORS_ALLOW_ALL", False)


@pytest.fixture
def test_engine(tmp_path):
    test_engine = create_engine(
        URL.create("sqlite", database=str(tmp_path / "test.sqlite")),
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(test_engine)
    yield test_engine
    Base.metadata.drop_all(test_engine)
    test_engine.dispose()


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client(test_engine) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    application = create_app()
    application.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(application) as test_client:
            yield test_client
    finally:
        application.dependency_overrides.clear()


@pytest.fixture
def role_client(test_engine) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        with Session(test_engine) as session:
            yield session

    application = create_app()
    application.dependency_overrides[get_db] = override_get_db

    def ops_probe(current_user: User = Depends(require_role("ops"))) -> dict[str, str]:
        return {"role": current_user.role}

    application.add_api_route("/_test/ops", ops_probe, methods=["GET"])
    try:
        with TestClient(application) as test_client:
            yield test_client
    finally:
        application.dependency_overrides.clear()
