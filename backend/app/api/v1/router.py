from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.ops import router as ops_router
from app.api.v1.orders import router as orders_router
from app.api.v1.resident import router as resident_router
from app.api.v1.users import router as users_router

v1_router = APIRouter(prefix="/v1")

v1_router.include_router(auth_router)
v1_router.include_router(ops_router)
v1_router.include_router(orders_router)
v1_router.include_router(resident_router)
v1_router.include_router(users_router)

__all__ = ["auth_router", "ops_router", "orders_router", "resident_router", "users_router", "v1_router"]
