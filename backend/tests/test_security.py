from datetime import datetime, timedelta, timezone

import jwt
import pytest

import app.core.security as security
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_is_not_plaintext_and_can_be_verified():
    password = "correct horse battery staple"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash) is True
    assert verify_password("incorrect password", password_hash) is False


def test_access_token_contains_subject_and_no_role_claim():
    token = create_access_token("19e7f610-7133-4f2e-b355-37878f670c7e")

    claims = decode_access_token(token)

    assert claims["sub"] == "19e7f610-7133-4f2e-b355-37878f670c7e"
    assert "exp" in claims
    assert "iat" in claims
    assert "role" not in claims


def test_access_token_rejects_bad_signature():
    tampered_token = jwt.encode(
        {"sub": "19e7f610-7133-4f2e-b355-37878f670c7e", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "different-secret-with-at-least-32-characters",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(tampered_token)


def test_access_token_rejects_expired_token():
    token = jwt.encode(
        {
            "sub": "19e7f610-7133-4f2e-b355-37878f670c7e",
            "iat": datetime.now(timezone.utc) - timedelta(days=2),
            "exp": datetime.now(timezone.utc) - timedelta(days=1),
        },
        security.SECRET_KEY,
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


def test_access_token_rejects_non_allowlisted_algorithm():
    token = jwt.encode(
        {
            "sub": "19e7f610-7133-4f2e-b355-37878f670c7e",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "test-only-secret-key-with-at-least-64-characters-required-for-hs512-tests",
        algorithm="HS512",
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)
