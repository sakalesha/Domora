import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

import app.core.security as security
from app.core.config import ACCESS_COOKIE_NAME
from app.core.csrf import CSRF_COOKIE_NAME, create_csrf_token, is_valid_csrf_token
from app.core.security import create_access_token
from app.models.domain import Society, User

ALLOWED_ORIGIN = "http://localhost:5173"


def _create_society(db_session, invite_code: str = "SUNRISE-DEMO") -> Society:
    society = Society(
        name="Sunrise Heights",
        address="1 Main Road",
        city="Bengaluru",
        invite_code=invite_code,
    )
    db_session.add(society)
    db_session.commit()
    return society


def _signup_payload(**overrides) -> dict[str, str]:
    payload = {
        "username": "resident.one",
        "password": "correct horse battery staple",
        "full_name": "Resident One",
        "phone": "+919900000001",
        "unit_label": "A-101",
        "invite_code": "sunrise-demo",
    }
    return payload | overrides


def _csrf_headers(client) -> dict[str, str]:
    response = client.get("/auth/csrf", headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 200
    return {
        "Origin": ALLOWED_ORIGIN,
        "X-CSRF-Token": response.json()["csrf_token"],
    }


def _signup(client, **overrides):
    return client.post(
        "/auth/signup",
        json=_signup_payload(**overrides),
        headers=_csrf_headers(client),
    )


def _login(client, username: str = "resident.one", password: str = "correct horse battery staple"):
    return client.post(
        "/auth/login",
        json={"username": username, "password": password},
        headers=_csrf_headers(client),
    )


def test_signup_creates_resident_and_discloses_phone_is_unverified(client, db_session):
    society = _create_society(db_session)

    response = _signup(client)

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "username": "resident.one",
        "full_name": "Resident One",
        "phone": "+919900000001",
        "role": "resident",
        "society_id": society.id,
        "unit_label": "A-101",
        "phone_verified": False,
    }
    user = db_session.scalar(select(User).where(User.username == "resident.one"))
    assert user is not None
    assert user.password_hash != "correct horse battery staple"


def test_signup_rejects_unknown_invite_code(client):
    response = _signup(client)

    assert response.status_code == 422


def test_signup_rejects_role_escalation_and_unknown_fields(client, db_session):
    _create_society(db_session)

    response = _signup(client, role="ops")

    assert response.status_code == 422
    assert "password_hash" not in response.text


def test_signup_rejects_duplicate_username_and_phone(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201

    duplicate_username = _signup(client, phone="+919900000002")
    duplicate_phone = _signup(client, username="resident.two")

    assert duplicate_username.status_code == 409
    assert duplicate_phone.status_code == 409
    assert "password_hash" not in duplicate_username.text


def test_signup_requires_csrf_token(client):
    response = client.post(
        "/auth/signup",
        json=_signup_payload(),
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 403


def test_login_sets_http_only_cookie_without_exposing_token(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201

    response = _login(client)

    assert response.status_code == 200
    assert response.json() == {"expires_in": 24 * 60 * 60}
    assert "access_token" not in response.json()
    access_cookie = next(
        cookie.lower()
        for cookie in response.headers.get_list("set-cookie")
        if cookie.startswith(f"{ACCESS_COOKIE_NAME}=")
    )
    assert "httponly" in access_cookie
    assert "samesite=lax" in access_cookie
    assert "max-age=86400" in access_cookie
    assert "path=/" in access_cookie
    assert "secure" not in access_cookie
    assert "domain=" not in access_cookie

    profile = client.get("/auth/me")
    assert profile.status_code == 200
    assert profile.json()["username"] == "resident.one"
    assert "password_hash" not in profile.text


def test_inactive_account_cannot_log_in(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201

    user = db_session.scalar(select(User).where(User.username == "resident.one"))
    user.is_active = False
    db_session.commit()

    response = _login(client)

    assert response.status_code == 401


def test_login_uses_same_unauthorized_response_for_unknown_user_and_wrong_password(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201

    wrong_password = _login(client, password="not the password")
    unknown_user = _login(client, username="unknown.user", password="not the password")

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()


def test_current_user_can_fetch_only_safe_profile_and_society_details(client, db_session):
    society = _create_society(db_session)
    assert _signup(client).status_code == 201
    assert _login(client).status_code == 200

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": response.json()["id"],
        "username": "resident.one",
        "full_name": "Resident One",
        "phone": "+919900000001",
        "role": "resident",
        "society_id": society.id,
        "unit_label": "A-101",
        "phone_verified": False,
        "society": {"id": society.id, "name": "Sunrise Heights", "city": "Bengaluru"},
    }
    assert "password_hash" not in response.text


def test_current_user_rejects_missing_cookie_and_bearer_only(client):
    missing_cookie = client.get("/auth/me")
    bearer_only = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert missing_cookie.status_code == 401
    assert bearer_only.status_code == 401


def test_current_user_rejects_expired_and_unknown_subject_cookies(client):
    non_existent_user_id = str(uuid.uuid4())
    expired_token = jwt.encode(
        {
            "sub": non_existent_user_id,
            "iat": datetime.now(timezone.utc) - timedelta(days=2),
            "exp": datetime.now(timezone.utc) - timedelta(days=1),
        },
        security.SECRET_KEY,
        algorithm="HS256",
    )
    unknown_user_token = create_access_token(non_existent_user_id)
    malformed_subject_token = create_access_token("not-a-uuid")

    for token in (expired_token, unknown_user_token, malformed_subject_token):
        response = client.get(
            "/auth/me",
            headers={"Cookie": f"{ACCESS_COOKIE_NAME}={token}"},
        )
        assert response.status_code == 401


def test_role_requirement_returns_403_for_resident_and_allows_ops(role_client, db_session):
    _create_society(db_session)
    assert _signup(role_client).status_code == 201
    assert _login(role_client).status_code == 200

    forbidden = role_client.get("/_test/ops")
    assert forbidden.status_code == 403

    resident = db_session.scalar(select(User).where(User.username == "resident.one"))
    resident.role = "ops"
    db_session.commit()

    allowed = role_client.get("/_test/ops")
    assert allowed.status_code == 200
    assert allowed.json() == {"role": "ops"}

    resident.is_active = False
    db_session.commit()
    deactivated = role_client.get("/_test/ops")
    assert deactivated.status_code == 401


def test_current_user_reloads_role_and_active_state_from_database(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201
    assert _login(client).status_code == 200

    user = db_session.scalar(select(User).where(User.username == "resident.one"))
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["role"] == "resident"

    user.role = "vendor"
    db_session.commit()
    changed_role = client.get("/auth/me")
    assert changed_role.status_code == 200
    assert changed_role.json()["role"] == "vendor"

    user.is_active = False
    db_session.commit()
    deactivated = client.get("/auth/me")
    assert deactivated.status_code == 401


def test_csrf_requires_an_allowed_origin(client):
    missing_origin = client.get("/auth/csrf")
    disallowed_origin = client.get(
        "/auth/csrf",
        headers={"Origin": "https://not-allowed.example"},
    )

    assert missing_origin.status_code == 403
    assert disallowed_origin.status_code == 403


def test_csrf_allows_browser_same_origin_get_without_origin_header(client):
    # Modern browsers omit the Origin header on same-origin GET requests,
    # sending Sec-Fetch-Site: same-origin or Referer with matching host.
    response_sec_fetch = client.get("/auth/csrf", headers={"Sec-Fetch-Site": "same-origin"})
    assert response_sec_fetch.status_code == 200
    assert "csrf_token" in response_sec_fetch.json()

    response_referer = client.get("/auth/csrf", headers={"Referer": "http://testserver/login"})
    assert response_referer.status_code == 200
    assert "csrf_token" in response_referer.json()


def test_csrf_cookie_is_http_only_signed_and_reused(client):
    first = client.get("/auth/csrf", headers={"Origin": ALLOWED_ORIGIN})
    token = first.json()["csrf_token"]
    cookie = first.headers["set-cookie"].lower()

    second = client.get("/auth/csrf", headers={"Origin": ALLOWED_ORIGIN})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["csrf_token"] == token
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age=86400" in cookie
    assert "path=/" in cookie
    assert is_valid_csrf_token(token)


def test_csrf_rejects_missing_mismatched_and_expired_tokens(client):
    first = client.get("/auth/csrf", headers={"Origin": ALLOWED_ORIGIN})
    stale_token = first.json()["csrf_token"]
    missing_header = client.post(
        "/auth/login",
        json={"username": "unknown.user", "password": "wrong"},
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert missing_header.status_code == 403

    client.cookies.clear()
    current = client.get("/auth/csrf", headers={"Origin": ALLOWED_ORIGIN})
    current_token = current.json()["csrf_token"]
    mismatched = client.post(
        "/auth/login",
        json={"username": "unknown.user", "password": "wrong"},
        headers={"Origin": ALLOWED_ORIGIN, "X-CSRF-Token": stale_token},
    )
    accepted = client.post(
        "/auth/login",
        json={"username": "unknown.user", "password": "wrong"},
        headers={"Origin": ALLOWED_ORIGIN, "X-CSRF-Token": current_token},
    )

    expired_token, _ = create_csrf_token(now=1)
    client.cookies.clear()
    client.cookies.set(CSRF_COOKIE_NAME, expired_token)
    expired = client.post(
        "/auth/login",
        json={"username": "unknown.user", "password": "wrong"},
        headers={"Origin": ALLOWED_ORIGIN, "X-CSRF-Token": expired_token},
    )

    assert mismatched.status_code == 403
    assert accepted.status_code == 401
    assert expired.status_code == 403


def test_csrf_rejects_disallowed_origin_on_signup(client):
    valid_headers = _csrf_headers(client)
    valid_headers["Origin"] = "https://not-allowed.example"

    response = client.post(
        "/auth/signup",
        json=_signup_payload(),
        headers=valid_headers,
    )

    assert response.status_code == 403


def test_cors_preflight_allows_only_required_headers_for_exact_origin(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "x-csrf-token" in response.headers["access-control-allow-headers"].lower()


def test_logout_clears_access_and_csrf_cookies(client, db_session):
    _create_society(db_session)
    assert _signup(client).status_code == 201
    assert _login(client).status_code == 200
    headers = _csrf_headers(client)

    response = client.post("/auth/logout", headers=headers)

    assert response.status_code == 204
    cleared_cookies = [cookie.lower() for cookie in response.headers.get_list("set-cookie")]
    assert any(cookie.startswith(f"{ACCESS_COOKIE_NAME}=") and "max-age=0" in cookie for cookie in cleared_cookies)
    assert any(cookie.startswith(f"{CSRF_COOKIE_NAME}=") and "max-age=0" in cookie for cookie in cleared_cookies)
    assert client.cookies.get(ACCESS_COOKIE_NAME) is None
    assert client.cookies.get(CSRF_COOKIE_NAME) is None
