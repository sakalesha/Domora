from __future__ import annotations

from app.api.v1.router import (
    auth_router,
    ops_router,
    orders_router,
    users_router,
    v1_router,
)

__all__ = [
    "auth_router",
    "ops_router",
    "orders_router",
    "users_router",
    "v1_router",
]
