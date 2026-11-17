from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.ops import router as ops_router

api_router = APIRouter()

# Mount routers at root level
api_router.include_router(auth_router)
api_router.include_router(ops_router)

# Also mount under /api prefix for transparent handling of Vercel service rewrites
api_router.include_router(auth_router, prefix="/api")
api_router.include_router(ops_router, prefix="/api")
