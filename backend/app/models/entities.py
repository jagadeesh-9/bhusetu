"""
SQLAlchemy ORM models for SIH26011 database entities.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Integer,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    UniqueConstraint,
    CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from geoalchemy2 import Geometry

from backend.app.db import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ulpin_2d: Mapped[str] = mapped_column(String(14), unique=True, nullable=False, index=True)
    survey_number: Mapped[str] = mapped_column(String(64), nullable=False)
    district: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(64), nullable=False)
    village_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    area_sqm: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    geom_2d = mapped_column(Geometry(geometry_type="POLYGON", srid=32644, dimension=2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    buildings: Mapped[List["Building"]] = relationship("Building", back_populates="parcel", cascade="all, delete-orphan")
    vertical_units: Mapped[List["VerticalUnit"]] = relationship("VerticalUnit", back_populates="parcel")


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parcels.id", ondelete="RESTRICT"), nullable=False, index=True)
    building_code: Mapped[str] = mapped_column(String(32), nullable=False)
    building_name: Mapped[str] = mapped_column(String(128), nullable=False)
    total_floors_above: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_floors_below: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    footprint_2d = mapped_column(Geometry(geometry_type="POLYGON", srid=32644, dimension=2), nullable=False)
    envelope_3d = mapped_column(Geometry(geometry_type="POLYHEDRALSURFACEZ", srid=32644, dimension=3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    parcel: Mapped["Parcel"] = relationship("Parcel", back_populates="buildings")
    vertical_units: Mapped[List["VerticalUnit"]] = relationship("VerticalUnit", back_populates="building")


class VerticalUnit(Base):
    __tablename__ = "vertical_units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parcels.id", ondelete="RESTRICT"), nullable=False, index=True)
    building_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_unit_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("vertical_units.id", ondelete="RESTRICT"), nullable=True, index=True)
    prototype_ulpin_3d: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    tier_code: Mapped[str] = mapped_column(String(8), nullable=False)
    floor_code: Mapped[str] = mapped_column(String(16), nullable=False)
    unit_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_level: Mapped[str] = mapped_column(String(32), default="STOREY", nullable=False, index=True)
    flat_number: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    unit_label: Mapped[str] = mapped_column(String(64), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(32), nullable=False)
    z_min: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    z_max: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    geom_3d = mapped_column(Geometry(geometry_type="POLYHEDRALSURFACEZ", srid=32644, dimension=3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PROPOSED", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    parcel: Mapped["Parcel"] = relationship("Parcel", back_populates="vertical_units")
    building: Mapped[Optional["Building"]] = relationship("Building", back_populates="vertical_units")
    parent_unit: Mapped[Optional["VerticalUnit"]] = relationship("VerticalUnit", remote_side="VerticalUnit.id", back_populates="sub_units")
    sub_units: Mapped[List["VerticalUnit"]] = relationship("VerticalUnit", back_populates="parent_unit")
    source_evidence: Mapped[List["SourceEvidence"]] = relationship("SourceEvidence", back_populates="unit", cascade="all, delete-orphan")
    verification_audit: Mapped[List["VerificationAudit"]] = relationship("VerificationAudit", back_populates="unit")


class SourceEvidence(Base):
    __tablename__ = "source_evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vertical_units.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dataset_name: Mapped[str] = mapped_column(String(128), nullable=False)
    file_uri: Mapped[str] = mapped_column(String(256), nullable=False)
    accuracy_horizontal_m: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    accuracy_vertical_m: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    unit: Mapped["VerticalUnit"] = relationship("VerticalUnit", back_populates="source_evidence")


class VerificationAudit(Base):
    __tablename__ = "verification_audit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vertical_units.id", ondelete="RESTRICT"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    previous_status: Mapped[str] = mapped_column(String(20), nullable=False)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    reviewer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    reviewer_role: Mapped[str] = mapped_column(String(64), nullable=False)
    review_notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    integrity_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    unit: Mapped["VerticalUnit"] = relationship("VerticalUnit", back_populates="verification_audit")
