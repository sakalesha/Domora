from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class EntityNotFoundError(AppException):
    """Raised when an entity is not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class InvalidParameterError(AppException):
    """Raised when request parameters violate validation constraints."""

    def __init__(self, message: str = "Invalid parameters"):
        super().__init__(message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


class ConflictError(AppException):
    """Raised when a resource state conflict occurs."""

    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


class UnauthorizedError(AppException):
    """Raised on authentication failure."""

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(AppException):
    """Raised when user lacks permission."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom exception handlers on FastAPI application."""

    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )
