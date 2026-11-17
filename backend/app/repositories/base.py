from __future__ import annotations

from typing import Generic, Sequence, TypeVar
from sqlalchemy import select
from sqlalchemy.orm import Session

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """Generic repository providing standardized SQLAlchemy CRUD operations."""

    def __init__(self, model: type[ModelType], session: Session) -> None:
        self.model = model
        self.session = session

    def get_by_id(self, id: str) -> ModelType | None:
        """Fetch a single record by primary key."""
        return self.session.get(self.model, id)

    def list_all(self) -> Sequence[ModelType]:
        """Fetch all records of this model."""
        return self.session.scalars(select(self.model)).all()

    def create(self, instance: ModelType) -> ModelType:
        """Persist a new instance and flush."""
        self.session.add(instance)
        self.session.flush()
        return instance

    def delete(self, instance: ModelType) -> None:
        """Remove an instance and flush."""
        self.session.delete(instance)
        self.session.flush()
