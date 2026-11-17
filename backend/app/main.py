from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import CORS_ALLOWED_ORIGINS, validate_runtime_config


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    validate_runtime_config() # Validate before server start serving
    yield # The app is now live and serving users


def create_app() -> FastAPI:
    application = FastAPI(title="Domora API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(CORS_ALLOWED_ORIGINS),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
    )
    application.include_router(api_router)

    @application.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
