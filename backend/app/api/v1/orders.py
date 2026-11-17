from __future__ import annotations

from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.csrf import require_csrf
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.repositories.order_repo import OrderRepository
from app.schemas.order import BookingCreateRequest, BookingResponse
from app.services.order_service import (
    AlreadyBookedError,
    BookingNotFoundError,
    CampCapacityExceededError,
    CampNotOpenError,
    cancel_order,
    create_order,
    list_resident_orders,
)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    request: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
    _: None = Depends(require_csrf),
) -> BookingResponse:
    """Create a new booking/order for a camp."""
    try:
        booking = create_order(
            session,
            camp_id=request.camp_id,
            resident=current_user,
            slot_starts_at=request.slot_starts_at,
        )
        return BookingResponse.model_validate(booking)
    except CampNotOpenError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AlreadyBookedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except CampCapacityExceededError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("", response_model=list[BookingResponse])
def get_my_orders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Sequence[BookingResponse]:
    """List all orders / bookings created by the logged in resident."""
    bookings = list_resident_orders(session, current_user.id)
    return [BookingResponse.model_validate(b) for b in bookings]


@router.get("/{order_id}", response_model=BookingResponse)
def get_order_by_id(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> BookingResponse:
    """Fetch order by ID (owner or ops only)."""
    booking = OrderRepository(session).get_by_id(order_id)
    if booking is None or (booking.resident_id != current_user.id and current_user.role != "ops"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return BookingResponse.model_validate(booking)


@router.post("/{order_id}/cancel", response_model=BookingResponse)
def cancel_order_endpoint(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
    _: None = Depends(require_csrf),
) -> BookingResponse:
    """Cancel an active order / booking."""
    try:
        booking = cancel_order(session, order_id, current_user.id)
        return BookingResponse.model_validate(booking)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
