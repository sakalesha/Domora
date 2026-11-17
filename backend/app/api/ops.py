from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.ops_schemas import (
    CampAssignVendorRequest,
    CampCreateRequest,
    CampDetailResponse,
    CampListItemResponse,
    ServiceReferenceResponse,
    SocietyReferenceResponse,
    VendorReferenceResponse,
)
from app.core.csrf import require_csrf
from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.domain import User
from app.services import camp_ops

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/societies", response_model=list[SocietyReferenceResponse])
def get_societies(
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> list[SocietyReferenceResponse]:
    societies = camp_ops.list_societies(db)
    return [SocietyReferenceResponse.model_validate(s) for s in societies]


@router.get("/services", response_model=list[ServiceReferenceResponse])
def get_services(
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> list[ServiceReferenceResponse]:
    services = camp_ops.list_services(db)
    return [ServiceReferenceResponse.model_validate(s) for s in services]


@router.get("/vendors", response_model=list[VendorReferenceResponse])
def get_vendors(
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> list[VendorReferenceResponse]:
    vendors = camp_ops.list_active_vendors(db)
    return [VendorReferenceResponse.model_validate(v) for v in vendors]


@router.post(
    "/camps",
    response_model=CampDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
def create_camp_endpoint(
    payload: CampCreateRequest,
    current_user: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> CampDetailResponse:
    try:
        created = camp_ops.create_camp(db, current_user.id, payload)
        return camp_ops.get_camp_detail(db, created.id)
    except camp_ops.InvalidCampParameterError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except (camp_ops.SocietyNotFoundError, camp_ops.ServiceNotFoundError, camp_ops.VendorNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/camps", response_model=list[CampListItemResponse])
def list_camps_endpoint(
    society_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> list[CampListItemResponse]:
    return camp_ops.list_camps(db, society_id=society_id, status_filter=status)


@router.get("/camps/{camp_id}", response_model=CampDetailResponse)
def get_camp_endpoint(
    camp_id: str,
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> CampDetailResponse:
    try:
        return camp_ops.get_camp_detail(db, camp_id)
    except camp_ops.CampNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch(
    "/camps/{camp_id}/vendor",
    response_model=CampDetailResponse,
    dependencies=[Depends(require_csrf)],
)
def assign_vendor_endpoint(
    camp_id: str,
    payload: CampAssignVendorRequest,
    _: User = Depends(require_role("ops")),
    db: Session = Depends(get_db),
) -> CampDetailResponse:
    try:
        camp_ops.assign_vendor(db, camp_id, payload.vendor_id)
        return camp_ops.get_camp_detail(db, camp_id)
    except camp_ops.CampNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except camp_ops.VendorNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except camp_ops.InvalidCampStateError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
