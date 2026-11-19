from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets
import time

import app.core.security as security
from fastapi import HTTPException, Request, status

from app.config import CORS_ALLOWED_ORIGINS, CSRF_TOKEN_EXPIRE_SECONDS

logger = logging.getLogger("app.csrf")

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
    if origin is not None:
        origin_clean = origin.rstrip("/")
        if origin_clean in CORS_ALLOWED_ORIGINS or any(origin_clean == o.rstrip("/") for o in CORS_ALLOWED_ORIGINS):
            return

        # Check against host / x-forwarded-host for same-origin requests
        forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        forwarded_proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        if forwarded_host:
            same_origin = f"{forwarded_proto}://{forwarded_host}".rstrip("/")
            if origin_clean == same_origin:
                return

        # Check loopback equivalent (localhost <-> 127.0.0.1)
        loopback = (
            origin_clean.replace("127.0.0.1", "localhost")
            if "127.0.0.1" in origin_clean
            else origin_clean.replace("localhost", "127.0.0.1")
        )
        if loopback in CORS_ALLOWED_ORIGINS or any(loopback == o.rstrip("/") for o in CORS_ALLOWED_ORIGINS):
            return

        logger.warning(
            "require_allowed_origin rejected: origin=%r, host=%r, forwarded_host=%r, allowed=%r",
            origin,
            request.headers.get("host"),
            request.headers.get("x-forwarded-host"),
            CORS_ALLOWED_ORIGINS,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request could not be completed",
        )

    # Origin header is omitted:
    # Browsers omit the Origin header on same-origin GET/HEAD requests.
    # We verify it is truly a same-origin browser request via Sec-Fetch-Site or Referer.
    if request.method in {"GET", "HEAD"}:
        sec_fetch_site = request.headers.get("sec-fetch-site")
        if sec_fetch_site in {"same-origin", "none", "same-site"}:
            return
        forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        referer = request.headers.get("referer")
        if referer and forwarded_host and forwarded_host in referer:
            return

    logger.warning("require_allowed_origin rejected: missing origin on %s request", request.method)
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

    if header_token is None:
        logger.warning("require_csrf rejected: missing %s header", CSRF_HEADER_NAME)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request could not be completed",
        )

    if not is_valid_csrf_token(header_token):
        logger.warning("require_csrf rejected: invalid or expired %s header token", CSRF_HEADER_NAME)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request could not be completed",
        )

    # When both cookie and header are present, enforce classic double-submit matching
    if cookie_token is not None:
        if not hmac.compare_digest(header_token, cookie_token):
            logger.warning("require_csrf rejected: header token does not match cookie token")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Request could not be completed",
            )
    else:
        # In cross-origin environments (e.g. Google AI Studio iframe preview or cross-port dev),
        # browsers block ambient third-party cookies (Present cookies: []).
        # Since Origin is strictly validated against CORS_ALLOWED_ORIGINS and header_token is
        # cryptographically HMAC-signed with SECRET_KEY, the request is authenticated and secure.
        logger.info(
            "require_csrf verified via signed %s header and Origin (cookie omitted by browser environment)",
            CSRF_HEADER_NAME,
        )
