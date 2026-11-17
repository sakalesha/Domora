from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import api_router
from app.config import validate_runtime_config
from app.core.logging import setup_logging
from app.exceptions import register_exception_handlers
from app.middleware import setup_cors_middleware, setup_custom_middleware


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Startup Phase
    setup_logging()
    validate_runtime_config()  # Validate runtime settings before server starts serving
    
    # Running Phase
    yield  # The app is now live and serving users

    # Shutdown Phase


def create_app() -> FastAPI:
    """Application factory for Domora FastAPI service."""
    application = FastAPI(
        title="Domora API",
        version="1.0.0",
        description="Domora Society Group-Buying & Home Services Management Platform",
        lifespan=lifespan,
    )

    # 1. Setup middleware
    setup_cors_middleware(application)
    setup_custom_middleware(application)

    # 2. Register exception handlers
    register_exception_handlers(application)

    # 3. Mount aggregated API router
    application.include_router(api_router)

    # 4. Standard Health Check
    @application.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()

__all__ = ["app", "create_app"]
