from __future__ import annotations

from fastapi import APIRouter

v2_router = APIRouter(prefix="/v2", tags=["v2"])

__all__ = ["v2_router"]
