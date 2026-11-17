from __future__ import annotations

from typing import Annotated
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.schemas.user import CurrentUserResponse, SocietySummary, UserSummary


class AuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SignupRequest(AuthRequest):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
    unit_label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
    invite_code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class LoginRequest(AuthRequest):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class AuthSessionResponse(BaseModel):
    expires_in: int


class CsrfTokenResponse(BaseModel):
    csrf_token: str


__all__ = [
    "AuthRequest",
    "AuthSessionResponse",
    "CsrfTokenResponse",
    "CurrentUserResponse",
    "LoginRequest",
    "SignupRequest",
    "SocietySummary",
    "UserSummary",
]
