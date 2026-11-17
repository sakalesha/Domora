from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import (
    ACCESS_COOKIE_NAME,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    APP_ENV,
)
from app.core.csrf import (
    CSRF_COOKIE_NAME,
    create_csrf_token,
    csrf_token_expiry,
    is_valid_csrf_token,
    require_allowed_origin,
    require_csrf,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import (
    AuthSessionResponse,
    CsrfTokenResponse,
    CurrentUserResponse,
    LoginRequest,
    SignupRequest,
    UserSummary,
)
from app.services.user_service import (
    DuplicateAccountError,
    InvalidCredentialsError,
    InvalidInviteCodeError,
    authenticate_user,
    create_resident,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _secure_cookie() -> bool:
    """Determine whether cookies must enforce the HTTPS Secure flag based on current environment."""
    return APP_ENV not in {"development", "test"}


def _is_username_or_phone_conflict(error: IntegrityError) -> bool:
    """
    Inspect a database IntegrityError to detect if it was triggered by a unique
    constraint violation on the user's username or phone number.
    """
    original = error.orig
    constraint_name = getattr(getattr(original, "diag", None), "constraint_name", None)
    if constraint_name in {"users_username_key", "users_phone_key"}:
        return True

    message = str(original).lower()
    return "unique constraint failed: users.username" in message or "unique constraint failed: users.phone" in message


@router.get(
    "/csrf",
    response_model=CsrfTokenResponse,
    dependencies=[Depends(require_allowed_origin)],
)
def read_csrf_token(request: Request, response: Response) -> CsrfTokenResponse:
    """
    Issue or rotate an HMAC-signed CSRF token for the client session.

    Validates incoming origin, generates a signed token containing a cryptographic
    nonce and expiration timestamp, attaches it as an HttpOnly cookie, and returns
    the token in the response payload for inclusion in HTTP mutation headers (X-CSRF-Token).
    """
    token = request.cookies.get(CSRF_COOKIE_NAME)
    if token is None or not is_valid_csrf_token(token):
        token, expires_at = create_csrf_token()
    else:
        expires_at = csrf_token_expiry(token)
        if expires_at is None:
            raise RuntimeError("A valid CSRF token did not contain an expiry")

    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=max(0, expires_at - int(time.time())),
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path="/",
    )
    return CsrfTokenResponse(csrf_token=token)


@router.post(
    "/signup",
    response_model=UserSummary,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    request: SignupRequest,
    session: Session = Depends(get_db),
    _: None = Depends(require_csrf),
) -> UserSummary:
    """
    Register a new resident user with society affiliation.

    Validates the society invite code, hashes the account password, verifies
    uniqueness of username and phone number, and persists the resident user record.
    Requires a valid CSRF token in the request header.
    """
    try:
        user = create_resident(session, **request.model_dump())
    except InvalidInviteCodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid invite code",
        ) from None
    except DuplicateAccountError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or phone number is already in use",
        ) from None

    try:
        session.commit()
        session.refresh(user)
    except IntegrityError as error:
        session.rollback()
        if _is_username_or_phone_conflict(error):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or phone number is already in use",
            ) from None
        raise
    except SQLAlchemyError:
        session.rollback()
        raise

    return UserSummary.model_validate(user)


@router.post("/login", response_model=AuthSessionResponse)
def login(
    request: LoginRequest,
    response: Response,
    session: Session = Depends(get_db),
    _: None = Depends(require_csrf),
) -> AuthSessionResponse:
    """
    Authenticate a user by username and password.

    Verifies credentials against the password hash (using constant-time dummy verification
    on lookup misses to thwart timing attacks), generates a signed JWT access token,
    and sets it in an HttpOnly session cookie. Requires CSRF protection.
    """
    try:
        user = authenticate_user(
            session,
            username=request.username,
            password=request.password,
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from None

    expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=create_access_token(user.id),
        max_age=expires_in,
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path="/",
    )
    return AuthSessionResponse(expires_in=expires_in)


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    """
    Retrieve profile details, role, and society affiliation for the currently authenticated user.
    """
    return CurrentUserResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def logout(_: None = Depends(require_csrf)) -> Response:
    """
    Terminate the current user session.

    Clears the HttpOnly authentication access token and CSRF cookies by setting their
    expiration to zero. Requires CSRF protection.
    """
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    for cookie_name in (ACCESS_COOKIE_NAME, CSRF_COOKIE_NAME):
        response.delete_cookie(
            key=cookie_name,
            path="/",
            secure=_secure_cookie(),
            httponly=True,
            samesite="lax",
        )
    return response
