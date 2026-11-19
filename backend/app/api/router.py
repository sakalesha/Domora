from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.ops import router as ops_router
from app.api.v1.orders import router as orders_router
from app.api.v1.resident import router as resident_router
from app.api.v1.router import v1_router
from app.api.v1.users import router as users_router
from app.api.v2.router import v2_router

# All API routes standardized under /api prefix
api_router = APIRouter(prefix="/api")

# 1. Versioned routes (/api/v1/* and /api/v2/*)
api_router.include_router(v1_router)
api_router.include_router(v2_router)

# 2. Top-level API endpoints (/api/auth, /api/ops, /api/orders, /api/resident, /api/users)
api_router.include_router(auth_router)
api_router.include_router(ops_router)
api_router.include_router(orders_router)
api_router.include_router(resident_router)
api_router.include_router(users_router)

__all__ = ["api_router"]
