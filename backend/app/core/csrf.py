from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

import app.core.security as security
from fastapi import HTTPException, Request, status

from app.core.config import CORS_ALLOWED_ORIGINS, CSRF_TOKEN_EXPIRE_SECONDS

CSRF_COOKIE_NAME = "domora_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
_CSRF_PURPOSE = "domora-csrf-v1"


def create_csrf_token(*, now: int | None = None) -> tuple[str, int]:
    issued_at = int(time.time()) if now is None else now
    expires_at = issued_at + CSRF_TOKEN_EXPIRE_SECONDS
    nonce = secrets.token_urlsafe(32)
    message = f"{_CSRF_PURPOSE}:{nonce}:{expires_at}".encode("utf-8")
    signature = hmac.new(
        security.SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return f"{nonce}.{expires_at}.{encoded_signature}", expires_at


def csrf_token_expiry(token: str) -> int | None:
    try:
        nonce, expiry_value, signature = token.split(".")
        expires_at = int(expiry_value)
    except (ValueError, AttributeError):
        return None

    if not nonce or not signature:
        return None
    return expires_at


def is_valid_csrf_token(token: str, *, now: int | None = None) -> bool:
    expires_at = csrf_token_expiry(token)
    if expires_at is None:
        return False

    current_time = int(time.time()) if now is None else now
    if expires_at <= current_time:
        return False

    nonce = token.split(".", 2)[0]
    message = f"{_CSRF_PURPOSE}:{nonce}:{expires_at}".encode("utf-8")
    expected_signature = hmac.new(
        security.SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    expected = base64.urlsafe_b64encode(expected_signature).rstrip(b"=").decode("ascii")
    supplied = token.split(".", 2)[2]
    return hmac.compare_digest(supplied, expected)


def require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin is None or origin not in CORS_ALLOWED_ORIGINS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request could not be completed",
        )


def require_csrf(request: Request) -> None:
    # Requests authenticated explicitly via Authorization: Bearer <token>
    # are immune to browser ambient-credential CSRF attacks.
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return

    require_allowed_origin(request)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)

    if (
        header_token is None
        or cookie_token is None
        or not hmac.compare_digest(header_token, cookie_token)
        or not is_valid_csrf_token(cookie_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request could not be completed",
        )
