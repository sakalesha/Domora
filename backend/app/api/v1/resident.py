from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models.user import User
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
