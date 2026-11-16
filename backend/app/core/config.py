from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")

_database_url = make_url(os.getenv("DATABASE_URL", "sqlite:///./domora.db"))
if _database_url.drivername in {"postgres", "postgresql"}:
    _database_url = _database_url.set(drivername="postgresql+psycopg")

DATABASE_URL: URL = _database_url
SECRET_KEY = os.getenv("SECRET_KEY", "local-dev-secret")
APP_ENV = os.getenv("APP_ENV", "development")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
ACCESS_COOKIE_NAME = "domora_access"
CSRF_TOKEN_EXPIRE_SECONDS = 24 * 60 * 60
CORS_ALLOWED_ORIGINS = tuple(
    dict.fromkeys(
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173",
        ).split(",")
        if origin.strip()
    )
)


def _is_exact_origin(origin: str) -> bool:
    parsed = urlsplit(origin)
    try:
        parsed.port
    except ValueError:
        return False

    return (
        parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
        and parsed.username is None
        and parsed.password is None
        and not parsed.path
        and not parsed.query
        and not parsed.fragment
    )


def validate_runtime_config(
    *,
    app_env: str = APP_ENV,
    secret_key: str = SECRET_KEY,
    token_expiry_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
    cors_allowed_origins: tuple[str, ...] = CORS_ALLOWED_ORIGINS,
) -> None:
    if token_expiry_minutes != 24 * 60:
        raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be 1440 for 24 hour sessions")

    if "*" in cors_allowed_origins or any(
        not _is_exact_origin(origin) for origin in cors_allowed_origins
    ):
        raise RuntimeError("CORS_ALLOWED_ORIGINS must contain exact HTTP or HTTPS origins")

    if app_env not in {"development", "test"} and not cors_allowed_origins:
        raise RuntimeError(
            "Production-like environments require at least one exact CORS_ALLOWED_ORIGINS value"
        )

    if app_env not in {"development", "test"} and (
        secret_key in {"", "local-dev-secret", "change-me-in-production"}
        or len(secret_key) < 32
    ):
        raise RuntimeError(
            "Production-like environments require a non-default SECRET_KEY of at least 32 characters"
        )
