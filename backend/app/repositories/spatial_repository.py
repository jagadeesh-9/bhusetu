"""
Repository layer for spatial queries and database retrieval.
"""
import uuid
from typing import List, Optional, Tuple, Any, Dict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, text

from backend.app.models.entities import (
    Parcel,
    Building,
    VerticalUnit,
    SourceEvidence,
    VerificationAudit
)


class SpatialRepository:
    def __init__(self, db: Session):
        self.db = db

    def check_health(self) -> Dict[str, Any]:
        """Queries PostgreSQL and PostGIS/SFCGAL versions."""
        try:
            res = self.db.execute(
                text("SELECT PostGIS_Version(), PostGIS_SFCGAL_Version();")
            ).fetchone()
            return {
                "connected": True,
                "postgis_version": res[0] if res else "unknown",
                "sfcgal_version": res[1] if res else "unknown"
            }
        except Exception:
            return {
                "connected": False,
                "postgis_version": None,
                "sfcgal_version": None
            }

    def get_parcels(self) -> List[Tuple[Parcel, str, str, int, int]]:
        """Retrieves all parcels with GeoJSON and counts."""
        stmt = (
            select(
                Parcel,
                func.ST_AsGeoJSON(Parcel.geom_2d).label("geojson"),
                func.ST_AsEWKT(Parcel.geom_2d).label("ewkt"),
                func.count(func.distinct(Building.id)).label("bldg_count"),
                func.count(func.distinct(VerticalUnit.id)).label("unit_count")
            )
            .outerjoin(Building, Building.parcel_id == Parcel.id)
            .outerjoin(VerticalUnit, VerticalUnit.parcel_id == Parcel.id)
            .group_by(Parcel.id)
        )
        return self.db.execute(stmt).all()

    def get_parcel_by_id(self, parcel_id: uuid.UUID) -> Optional[Tuple[Parcel, str, str, int, int]]:
        """Retrieves a single parcel by UUID."""
        stmt = (
            select(
                Parcel,
                func.ST_AsGeoJSON(Parcel.geom_2d).label("geojson"),
                func.ST_AsEWKT(Parcel.geom_2d).label("ewkt"),
                func.count(func.distinct(Building.id)).label("bldg_count"),
                func.count(func.distinct(VerticalUnit.id)).label("unit_count")
            )
            .outerjoin(Building, Building.parcel_id == Parcel.id)
            .outerjoin(VerticalUnit, VerticalUnit.parcel_id == Parcel.id)
            .where(Parcel.id == parcel_id)
            .group_by(Parcel.id)
        )
        return self.db.execute(stmt).first()

    def get_parcel_by_ulpin(self, ulpin: str) -> Optional[Tuple[Parcel, str, str, int, int]]:
        """Retrieves a single parcel by 14-character ULPIN string."""
        stmt = (
            select(
                Parcel,
                func.ST_AsGeoJSON(Parcel.geom_2d).label("geojson"),
                func.ST_AsEWKT(Parcel.geom_2d).label("ewkt"),
                func.count(func.distinct(Building.id)).label("bldg_count"),
                func.count(func.distinct(VerticalUnit.id)).label("unit_count")
            )
            .outerjoin(Building, Building.parcel_id == Parcel.id)
            .outerjoin(VerticalUnit, VerticalUnit.parcel_id == Parcel.id)
            .where(Parcel.ulpin_2d == ulpin)
            .group_by(Parcel.id)
        )
        return self.db.execute(stmt).first()

    def get_building_by_id(self, building_id: uuid.UUID) -> Optional[Building]:
        """Retrieves a single building by UUID."""
        stmt = select(Building).where(Building.id == building_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_buildings_by_parcel(self, parcel_id: uuid.UUID) -> List[Tuple[Building, str, str, Optional[str], int]]:
        """Retrieves buildings on a parcel with footprint GeoJSON and 3D envelope EWKT."""
        stmt = (
            select(
                Building,
                func.ST_AsGeoJSON(Building.footprint_2d).label("footprint_geojson"),
                func.ST_AsEWKT(Building.footprint_2d).label("footprint_ewkt"),
                func.ST_AsEWKT(Building.envelope_3d).label("envelope_ewkt"),
                func.count(func.distinct(VerticalUnit.id)).label("unit_count")
            )
            .outerjoin(VerticalUnit, VerticalUnit.building_id == Building.id)
            .where(Building.parcel_id == parcel_id)
            .group_by(Building.id)
        )
        return self.db.execute(stmt).all()

    def get_all_buildings(self) -> List[Tuple[Building, str, str, Optional[str], int]]:
        """Retrieves all buildings across all parcels with footprint GeoJSON and 3D envelope EWKT."""
        stmt = (
            select(
                Building,
                func.ST_AsGeoJSON(Building.footprint_2d).label("footprint_geojson"),
                func.ST_AsEWKT(Building.footprint_2d).label("footprint_ewkt"),
                func.ST_AsEWKT(Building.envelope_3d).label("envelope_ewkt"),
                func.count(func.distinct(VerticalUnit.id)).label("unit_count")
            )
            .outerjoin(VerticalUnit, VerticalUnit.building_id == Building.id)
            .group_by(Building.id)
            .order_by(Building.created_at.desc())
        )
        return self.db.execute(stmt).all()

    def get_vertical_units_by_parcel(self, parcel_id: uuid.UUID) -> List[Tuple[VerticalUnit, str]]:
        """Retrieves all vertical units for a parcel with exact 3D EWKT representation."""
        stmt = (
            select(
                VerticalUnit,
                func.ST_AsEWKT(VerticalUnit.geom_3d).label("ewkt_3d")
            )
            .where(VerticalUnit.parcel_id == parcel_id)
            .options(
                joinedload(VerticalUnit.source_evidence),
                joinedload(VerticalUnit.verification_audit)
            )
            .order_by(VerticalUnit.unit_sequence)
        )
        return self.db.execute(stmt).unique().all()

    def get_sub_units_by_parent(self, parent_unit_id: uuid.UUID) -> List[Tuple[VerticalUnit, str]]:
        """Retrieves all child sub-units (flats/circulation) for a parent storey unit."""
        stmt = (
            select(
                VerticalUnit,
                func.ST_AsEWKT(VerticalUnit.geom_3d).label("ewkt_3d")
            )
            .where(VerticalUnit.parent_unit_id == parent_unit_id)
            .options(
                joinedload(VerticalUnit.source_evidence),
                joinedload(VerticalUnit.verification_audit)
            )
            .order_by(VerticalUnit.unit_sequence)
        )
        return self.db.execute(stmt).unique().all()

    def get_vertical_unit_by_id(self, unit_id: uuid.UUID) -> Optional[Tuple[VerticalUnit, str]]:
        """Retrieves a single vertical unit with full 3D EWKT geometry and evidence/audit trails."""
        stmt = (
            select(
                VerticalUnit,
                func.ST_AsEWKT(VerticalUnit.geom_3d).label("ewkt_3d")
            )
            .where(VerticalUnit.id == unit_id)
            .options(
                joinedload(VerticalUnit.source_evidence),
                joinedload(VerticalUnit.verification_audit)
            )
        )
        return self.db.execute(stmt).unique().first()

    def allocate_unit_sequence(self) -> int:
        """Allocates next atomic sequence number from PostgreSQL sequence vertical_unit_seq."""
        return self.db.execute(text("SELECT nextval('vertical_unit_seq');")).scalar()

    def create_vertical_unit(
        self,
        parcel_id: uuid.UUID,
        building_id: Optional[uuid.UUID],
        prototype_ulpin_3d: str,
        tier_code: str,
        floor_code: str,
        unit_sequence: int,
        unit_label: str,
        unit_type: str,
        z_min: float,
        z_max: float,
        geom_wkt: str,
        initial_audit_notes: Optional[str] = None
    ) -> Optional[Tuple[VerticalUnit, str]]:
        """
        Persists a newly generated 3D vertical unit and records the initial auto-ingestion audit entry.
        """
        clean_wkt = geom_wkt.strip()
        if clean_wkt.startswith("SRID="):
            wkt_text = clean_wkt.split(";", 1)[1]
        else:
            wkt_text = clean_wkt

        unit_id = uuid.uuid4()
        insert_unit_stmt = text("""
            INSERT INTO vertical_units (
                id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
                unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
            ) VALUES (
                :id, :parcel_id, :building_id, :prototype_ulpin_3d, :tier_code, :floor_code,
                :unit_sequence, :unit_label, :unit_type, :z_min, :z_max,
                ST_SetSRID(ST_GeomFromText(:wkt_text), 32644), 'PROPOSED'
            );
        """)
        self.db.execute(
            insert_unit_stmt,
            {
                "id": unit_id,
                "parcel_id": parcel_id,
                "building_id": building_id,
                "prototype_ulpin_3d": prototype_ulpin_3d,
                "tier_code": tier_code,
                "floor_code": floor_code,
                "unit_sequence": unit_sequence,
                "unit_label": unit_label,
                "unit_type": unit_type,
                "z_min": z_min,
                "z_max": z_max,
                "wkt_text": wkt_text
            }
        )

        insert_audit_stmt = text("""
            INSERT INTO verification_audit (
                id, unit_id, action, previous_status, new_status,
                reviewer_name, reviewer_role, review_notes, integrity_hash
            ) VALUES (
                :audit_id, :unit_id, 'AUTO_INGESTION', 'PROPOSED', 'PROPOSED',
                'System Auto-Ingestion Pipeline', 'SYSTEM_VALIDATOR',
                :notes, :hash
            );
        """)
        self.db.execute(
            insert_audit_stmt,
            {
                "audit_id": uuid.uuid4(),
                "unit_id": unit_id,
                "notes": initial_audit_notes or "Automated generation and ingestion. Lifecycle initialized as PROPOSED.",
                "hash": f"syn_hash_auto_{prototype_ulpin_3d}"
            }
        )
        self.db.commit()
        return self.get_vertical_unit_by_id(unit_id)

    def transition_vertical_unit(
        self,
        unit_id: uuid.UUID,
        new_status: str,
        previous_status: str,
        action: str,
        reviewer_name: str,
        reviewer_role: str,
        review_notes: Optional[str],
        integrity_hash: Optional[str]
    ) -> Optional[Tuple[VerticalUnit, str]]:
        """
        Executes an audited state machine transition and records the action in verification_audit.
        """
        update_stmt = text("""
            UPDATE vertical_units
            SET status = :new_status, updated_at = CURRENT_TIMESTAMP
            WHERE id = :unit_id;
        """)
        self.db.execute(update_stmt, {"unit_id": unit_id, "new_status": new_status})

        audit_stmt = text("""
            INSERT INTO verification_audit (
                id, unit_id, action, previous_status, new_status,
                reviewer_name, reviewer_role, review_notes, integrity_hash
            ) VALUES (
                :audit_id, :unit_id, :action, :previous_status, :new_status,
                :reviewer_name, :reviewer_role, :review_notes, :integrity_hash
            );
        """)
        self.db.execute(
            audit_stmt,
            {
                "audit_id": uuid.uuid4(),
                "unit_id": unit_id,
                "action": action,
                "previous_status": previous_status,
                "new_status": new_status,
                "reviewer_name": reviewer_name,
                "reviewer_role": reviewer_role,
                "review_notes": review_notes,
                "integrity_hash": integrity_hash or f"syn_hash_{uuid.uuid4().hex[:14]}"
            }
        )
        self.db.commit()
        return self.get_vertical_unit_by_id(unit_id)

    def get_spatial_validation_metrics(self, unit_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Executes PostGIS/SFCGAL validation queries for a vertical unit:
        Checks closure, solid validity, positive volume, Z-bounds, 2D footprint containment,
        and evaluates volumetric intersection against all peer units on the parent parcel.
        """
        unit_query = text("""
            SELECT 
                u.id,
                u.prototype_ulpin_3d,
                u.parcel_id,
                u.z_min,
                u.z_max,
                u.status,
                ST_GeometryType(u.geom_3d) AS geom_type,
                ST_Dimension(u.geom_3d) AS dimension,
                ST_SRID(u.geom_3d) AS srid,
                ST_IsClosed(u.geom_3d) AS is_closed,
                CG_IsSolid(CG_MakeSolid(u.geom_3d)) AS is_solid,
                ROUND(CG_Volume(CG_MakeSolid(u.geom_3d))::numeric, 4) AS volume_cbm,
                ST_ZMin(u.geom_3d) AS z_min_geom,
                ST_ZMax(u.geom_3d) AS z_max_geom,
                ST_Within(ST_Envelope(u.geom_3d), p.geom_2d) AS is_within_parcel
            FROM vertical_units u
            JOIN parcels p ON u.parcel_id = p.id
            WHERE u.id = :unit_id;
        """)
        unit_row = self.db.execute(unit_query, {"unit_id": unit_id}).mappings().first()
        if not unit_row:
            return None

        # Check for 3D volumetric overlap with peer units on the same parcel
        conflicts_query = text("""
            SELECT 
                other.id AS other_id,
                other.prototype_ulpin_3d AS other_ulpin,
                ST_3DIntersects(target.geom_3d, other.geom_3d) AS boundary_intersects,
                ROUND(COALESCE(CG_Volume(CG_3DIntersection(CG_MakeSolid(target.geom_3d), CG_MakeSolid(other.geom_3d))), 0.0)::numeric, 4) AS overlap_volume
            FROM vertical_units target
            JOIN vertical_units other ON other.parcel_id = target.parcel_id AND other.id != target.id
            WHERE target.id = :unit_id;
        """)
        conflict_rows = self.db.execute(conflicts_query, {"unit_id": unit_id}).mappings().all()

        return {
            "unit": dict(unit_row),
            "peer_comparisons": [dict(r) for r in conflict_rows]
        }
