from __future__ import annotations

from typing import Sequence
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_ops_user
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import CurrentUserResponse, UserResponse
from app.schemas.ops import VendorReferenceResponse
from app.services.user_service import list_vendors

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
    """Fetch profile of currently authenticated user."""
    return CurrentUserResponse.model_validate(current_user)


@router.get("/vendors", response_model=list[VendorReferenceResponse])
def get_vendors(
    _: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Sequence[User]:
    """Fetch active service vendors."""
    return list_vendors(session)


@router.get("", response_model=list[UserResponse])
def list_all_users(
    _: User = Depends(require_ops_user),
    session: Session = Depends(get_db),
) -> Sequence[User]:
    """List all registered platform users (Ops only)."""
    return UserRepository(session).list_all()
