from __future__ import annotations

# Backward compatibility re-export from app.services.user_service and app.core.security
from app.core.security import hash_password, verify_password, verify_unknown_user_password
from app.services.user_service import (
    DuplicateAccountError,
    InvalidCredentialsError,
    InvalidInviteCodeError,
    authenticate_user,
    create_resident,
)

__all__ = [
    "DuplicateAccountError",
    "InvalidCredentialsError",
    "InvalidInviteCodeError",
    "authenticate_user",
    "create_resident",
    "hash_password",
    "verify_password",
    "verify_unknown_user_password",
]
