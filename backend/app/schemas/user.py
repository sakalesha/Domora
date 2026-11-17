from __future__ import annotations

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, StringConstraints


class SocietySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    city: str


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


class CurrentUserResponse(UserSummary):
    society: SocietySummary | None = None


class UserBase(BaseModel):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
    role: str = "resident"


class UserCreate(UserBase):
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    unit_label: str | None = None
    society_id: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    unit_label: str | None = None
    is_active: bool | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    unit_label: str | None = None
    society_id: str | None = None
