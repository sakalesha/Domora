from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints


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


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str
    phone: str
    role: str
    society_id: str | None
    unit_label: str | None
    phone_verified: Literal[False] = False


class SocietySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    city: str


class CurrentUserResponse(UserSummary):
    society: SocietySummary | None


class AuthSessionResponse(BaseModel):
    expires_in: int


class CsrfTokenResponse(BaseModel):
    csrf_token: str
