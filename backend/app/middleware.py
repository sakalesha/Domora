from __future__ import annotations

import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.config import CORS_ALLOWED_ORIGINS


class ProcessTimeMiddleware(BaseHTTPMiddleware):
    """Add X-Process-Time (Total time backend spent to process the request) header to all HTTP responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response


def setup_cors_middleware(app: FastAPI) -> None:
    """Configure CORS middleware with validated origins."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(CORS_ALLOWED_ORIGINS),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
    )


def setup_custom_middleware(app: FastAPI) -> None:
    """Attach custom application middleware."""
    app.add_middleware(ProcessTimeMiddleware)
