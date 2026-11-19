from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.csrf import require_csrf
from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
from app.schemas.booking import (
    ResidentBookingDetail,
    ResidentBookingItem,
    ResidentBookingLeaveResponse,
)
from app.schemas.resident import ResidentCampDetail, ResidentCampListItem
from app.services import camp_resident

router = APIRouter(prefix="/resident", tags=["resident"])
require_resident_user = require_role("resident")


@router.get("/camps", response_model=list[ResidentCampListItem])
def list_society_camps(
    status: str | None = Query(default=None, description="Optional camp status filter"),
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> list[ResidentCampListItem]:
    """
    List all camps available to the resident's residential society.
    
    Returns real-time participant counts, spots remaining, current provisional
    discounted price, and next-tier savings motivation.
    """
    try:
        return camp_resident.list_resident_camps(db, current_user, status_filter=status)
    except camp_resident.ResidentSocietyRequiredError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/camps/{camp_id}", response_model=ResidentCampDetail)
def get_society_camp_detail(
    camp_id: str,
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> ResidentCampDetail:
    """
    Get detailed breakdown of a specific camp for the resident's society.
    
    Includes the full stepped pricing ladder, provisional pricing disclaimer (Decision P1),
    and aggregate participant count without exposing neighbour names (Decision P6).
    Enforces strict society isolation (returns 404 for camps belonging to other societies).
    """
    try:
        return camp_resident.get_resident_camp_detail(db, current_user, camp_id)
    except camp_resident.ResidentCampNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except camp_resident.ResidentSocietyRequiredError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/camps/{camp_id}/join",
    response_model=ResidentBookingDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
def join_camp_endpoint(
    camp_id: str,
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> ResidentBookingDetail:
    """
    Join an open group-buying camp in the resident's residential society.

    Uses row-level locking to guarantee no overbooking under concurrent join requests.
    Enforces Rule 1 (at most one active booking per resident), Rule 3 (society isolation),
    and Rule 9 (join deadline).
    """
    try:
        booking = camp_resident.join_camp(db, current_user, camp_id)
        db.commit()
        return booking
    except camp_resident.ResidentCampNotFoundError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (camp_resident.CampClosedError, camp_resident.JoinDeadlinePassedError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except (camp_resident.CampOvercapacityError, camp_resident.DuplicateBookingError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except camp_resident.ResidentSocietyRequiredError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/camps/{camp_id}/leave",
    response_model=ResidentBookingLeaveResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_csrf)],
)
def leave_camp_endpoint(
    camp_id: str,
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> ResidentBookingLeaveResponse:
    """
    Leave (cancel) the resident's active booking in a camp.

    Enforces the 24-hour cutoff rule: cancellations are permitted only if at least
    24 hours remain before the camp service window starts.
    """
    try:
        leave_result = camp_resident.leave_camp(db, current_user, camp_id)
        db.commit()
        return leave_result
    except camp_resident.BookingNotFoundError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except camp_resident.LateCancellationError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/bookings", response_model=list[ResidentBookingItem])
def list_resident_bookings_endpoint(
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> list[ResidentBookingItem]:
    """
    List all bookings for the currently authenticated resident in reverse chronological order.
    """
    return camp_resident.list_resident_bookings(db, current_user)


@router.get("/bookings/{booking_id}", response_model=ResidentBookingDetail)
def get_resident_booking_endpoint(
    booking_id: str,
    current_user: User = Depends(require_resident_user),
    db: Session = Depends(get_db),
) -> ResidentBookingDetail:
    """
    Retrieve full details for a specific booking belonging to the resident.
    """
    try:
        return camp_resident.get_resident_booking(db, current_user, booking_id)
    except camp_resident.BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
