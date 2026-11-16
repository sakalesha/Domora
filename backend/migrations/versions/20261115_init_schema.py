"""Initial schema for Domora MVP.

Revision ID: 20261115_0001
Revises: 
Create Date: 2026-11-15 14:18:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20261115_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    created_at_default = (
        sa.text("clock_timestamp()")
        if op.get_bind().dialect.name == "postgresql"
        else sa.text("CURRENT_TIMESTAMP")
    )

    op.create_table(
        "societies",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("invite_code", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=created_at_default, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invite_code"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("society_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("unit_label", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=created_at_default, nullable=False),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
        sa.UniqueConstraint("username"),
        sa.CheckConstraint("role IN ('resident', 'vendor', 'ops')", name="users_role_check"),
        sa.CheckConstraint(
            "(role = 'resident' AND society_id IS NOT NULL AND unit_label IS NOT NULL) OR role <> 'resident'",
            name="users_resident_requirements_check",
        ),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "camps",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("society_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("service_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_minutes", sa.Integer(), nullable=False),
        sa.Column("min_participants", sa.Integer(), nullable=False),
        sa.Column("max_participants", sa.Integer(), nullable=False),
        sa.Column("join_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("base_price_paise", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("vendor_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("created_by", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=created_at_default, nullable=False),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("min_participants >= 1", name="camp_min_participants_check"),
        sa.CheckConstraint("max_participants >= min_participants", name="camp_max_participants_check"),
        sa.CheckConstraint("slot_minutes > 0", name="camp_slot_minutes_check"),
        sa.CheckConstraint("base_price_paise >= 0", name="camp_base_price_paise_check"),
        sa.CheckConstraint("starts_at < ends_at", name="camp_window_check"),
        sa.CheckConstraint("join_deadline < starts_at", name="camp_join_deadline_check"),
        sa.CheckConstraint(
            "status IN ('open', 'confirmed', 'in_progress', 'completed', 'cancelled')",
            name="camp_status_check",
        ),
    )

    op.create_table(
        "camp_price_tiers",
        sa.Column("camp_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("min_participants", sa.Integer(), nullable=False),
        sa.Column("discount_pct", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["camp_id"], ["camps.id"]),
        sa.PrimaryKeyConstraint("camp_id", "min_participants"),
        sa.CheckConstraint("discount_pct >= 0 AND discount_pct <= 100", name="camp_price_tier_discount_range_check"),
    )

    op.create_table(
        "bookings",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("camp_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("resident_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("quoted_price_paise", sa.Integer(), nullable=False),
        sa.Column("final_price_paise", sa.Integer(), nullable=True),
        sa.Column("slot_starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=created_at_default, nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["camp_id"], ["camps.id"]),
        sa.ForeignKeyConstraint(["resident_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('joined', 'scheduled', 'in_progress', 'completed', 'cancelled')",
            name="booking_status_check",
        ),
        sa.CheckConstraint("quoted_price_paise >= 0", name="booking_quoted_price_non_negative_check"),
        sa.CheckConstraint("final_price_paise IS NULL OR final_price_paise >= 0", name="booking_final_price_non_negative_check"),
    )
    op.create_index(
        "uq_active_booking_per_camp_resident",
        "bookings",
        ["camp_id", "resident_id"],
        unique=True,
        sqlite_where=sa.text("status != 'cancelled'"),
        postgresql_where=sa.text("status <> 'cancelled'"),
    )

    op.create_table(
        "job_records",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("booking_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("vendor_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("before_photo_path", sa.Text(), nullable=True),
        sa.Column("after_photo_path", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_id"),
        sa.CheckConstraint("after_photo_path IS NULL OR before_photo_path IS NOT NULL", name="job_before_photo_required_for_after_check"),
        sa.CheckConstraint("before_photo_path IS NOT NULL OR after_photo_path IS NULL", name="job_before_or_after_photo_check"),
    )

    if op.get_bind().dialect.name == "postgresql":
        for table_name in (
            "societies",
            "users",
            "services",
            "camps",
            "camp_price_tiers",
            "bookings",
            "job_records",
        ):
            op.execute(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table("job_records")
    op.drop_table("bookings")
    op.drop_table("camp_price_tiers")
    op.drop_table("camps")
    op.drop_table("services")
    op.drop_table("users")
    op.drop_table("societies")
