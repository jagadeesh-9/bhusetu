"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.0: 3D Topology, Conflict Detection & Spatial Quality-Control Engine

This service acts strictly as a SPATIAL QUALITY-CONTROL AUDITOR.
It evaluates geometric closure/solidity, pairwise 3D volumetric collisions, boundary contact,
vertical continuity (gaps/overlaps), duplicate spaces, and parcel footprint containment.

DISCLAIMER:
Research Prototype Only.
Topology audit results represent spatial quality-control findings and DO NOT constitute
legal title determination, ownership rights, statutory subdivision, or government cadastral certification.
Human review remains mandatory.
"""
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.schemas.responses import (
    TopologySolidValidation,
    TopologyPairwiseRelationship,
    TopologyVerticalContinuityItem,
    TopologyContainmentFinding,
    UnitTopologyReportResponse,
    ParcelTopologyReportResponse
)


# Authoritative Numerical Quality-Control Tolerances
DEFAULT_COLLISION_TOLERANCE_CBM: float = 0.001   # 1 liter (0.001 m3) threshold for 3D volumetric interior collision
DUPLICATE_VOLUMETRIC_RATIO: float = 0.90         # >=90% overlap ratio qualifies as duplicate spatial representation
DEFAULT_SYNTHETIC_GROUND_DATUM_Z: float = 540.0  # Synthetic prototype terrestrial ground datum reference (meters)
VERTICAL_CONTINUITY_TOLERANCE_M: float = 0.05    # 5cm vertical tolerance for contiguous floor slab interfaces
ELEVATION_METADATA_TOLERANCE_M: float = 0.05     # 5cm elevation metadata vs geometric bounds tolerance


class TopologyService:
    def __init__(self, db: Session):
        self.db = db

    def validate_solid_wkt(
        self,
        geom_wkt: str,
        z_min_meta: float,
        z_max_meta: float,
        unit_id: Optional[uuid.UUID] = None,
        prototype_ulpin_3d: Optional[str] = None
    ) -> TopologySolidValidation:
        """
        Executes PostGIS/SFCGAL solid geometry checks on a 3D geometry WKT string.
        """
        query = text("""
            WITH input_geom AS (
                SELECT ST_SetSRID(ST_GeomFromText(:wkt), 32644) AS geom
            )
            SELECT
                ST_IsClosed(geom) AS is_closed,
                CG_IsSolid(CG_MakeSolid(geom)) AS is_solid,
                CG_Volume(CG_MakeSolid(geom)) AS volume_cbm,
                ST_ZMin(geom) AS z_min_geom,
                ST_ZMax(geom) AS z_max_geom
            FROM input_geom;
        """)

        try:
            row = self.db.execute(query, {"wkt": geom_wkt}).mappings().first()
            if not row:
                raise ValueError("Could not parse or validate geometry.")
            
            is_closed = bool(row["is_closed"])
            is_solid = bool(row["is_solid"])
            volume_cbm = float(row["volume_cbm"] or 0.0)
            z_min_geom = float(row["z_min_geom"] or z_min_meta)
            z_max_geom = float(row["z_max_geom"] or z_max_meta)
        except Exception as e:
            # Fallback for open or invalid geometries that fail SFCGAL parsing
            return TopologySolidValidation(
                unit_id=unit_id,
                prototype_ulpin_3d=prototype_ulpin_3d,
                is_closed=False,
                is_solid=False,
                volume_cbm=0.0,
                z_min_geom=z_min_meta,
                z_max_geom=z_max_meta,
                z_min_meta=z_min_meta,
                z_max_meta=z_max_meta,
                validity_code="INVALID_SOLID",
                is_valid=False,
                details=f"Solid geometry evaluation failed: {str(e)}"
            )

        # Classification logic
        if not is_closed:
            validity_code = "INVALID_CLOSEDNESS"
            is_valid = False
            details = "Surface is unclosed or non-watertight."
        elif not is_solid:
            validity_code = "INVALID_SOLID"
            is_valid = False
            details = "Geometry could not be reconstructed as a valid SFCGAL B-Rep solid."
        elif volume_cbm <= 0.0001:
            validity_code = "NON_POSITIVE_VOLUME"
            is_valid = False
            details = f"Solid has non-positive or degenerate volume ({volume_cbm:.4f} m³)."
        elif z_max_meta <= z_min_meta or abs(z_min_geom - z_min_meta) > 0.05 or abs(z_max_geom - z_max_meta) > 0.05:
            validity_code = "INVALID_Z_RANGE"
            is_valid = False
            details = f"Z range mismatch: metadata [{z_min_meta:.2f}m - {z_max_meta:.2f}m] vs geom [{z_min_geom:.2f}m - {z_max_geom:.2f}m]."
        else:
            validity_code = "VALID_SOLID"
            is_valid = True
            details = f"Closed watertight 3D solid verified with positive volume ({volume_cbm:.2f} m³)."

        return TopologySolidValidation(
            unit_id=unit_id,
            prototype_ulpin_3d=prototype_ulpin_3d,
            is_closed=is_closed,
            is_solid=is_solid,
            volume_cbm=round(volume_cbm, 4),
            z_min_geom=round(z_min_geom, 2),
            z_max_geom=round(z_max_geom, 2),
            z_min_meta=round(z_min_meta, 2),
            z_max_meta=round(z_max_meta, 2),
            validity_code=validity_code,
            is_valid=is_valid,
            details=details
        )

    def compare_unit_pair_db(
        self,
        unit_a_id: uuid.UUID,
        unit_a_ulpin: str,
        unit_b_id: uuid.UUID,
        unit_b_ulpin: str
    ) -> TopologyPairwiseRelationship:
        """
        Executes PostGIS/SFCGAL pairwise comparison between two persisted units in the database.
        """
        query = text("""
            SELECT
                CG_Volume(CG_MakeSolid(a.geom_3d)) AS vol_a,
                CG_Volume(CG_MakeSolid(b.geom_3d)) AS vol_b,
                CG_Volume(CG_3DIntersection(CG_MakeSolid(a.geom_3d), CG_MakeSolid(b.geom_3d))) AS overlap_vol,
                ST_3DIntersects(a.geom_3d, b.geom_3d) AS surface_intersects,
                (a.z_min < b.z_max AND a.z_max > b.z_min) AS shared_z
            FROM vertical_units a, vertical_units b
            WHERE a.id = :id_a AND b.id = :id_b;
        """)

        row = self.db.execute(query, {"id_a": str(unit_a_id), "id_b": str(unit_b_id)}).mappings().first()
        if not row:
            raise LookupError("Could not compare units.")

        vol_a = float(row["vol_a"] or 0.0)
        vol_b = float(row["vol_b"] or 0.0)
        overlap_vol = float(row["overlap_vol"] or 0.0)
        surface_intersects = bool(row["surface_intersects"])
        shared_z = bool(row["shared_z"])

        # Determine relationship code
        min_vol = min(vol_a, vol_b) if min(vol_a, vol_b) > 0 else 1.0
        overlap_ratio = overlap_vol / min_vol

        if overlap_vol > 0.001:
            if overlap_ratio >= 0.90:
                rel_code = "DUPLICATE_SPATIAL_REPRESENTATION"
                severity = "ERROR"
                desc = (
                    f"Duplicate spatial volume detected ({overlap_vol:.3f} m³ overlap, "
                    f"{overlap_ratio*100:.1f}% volumetric identity between {unit_a_ulpin} and {unit_b_ulpin})."
                )
            else:
                rel_code = "POSITIVE_VOLUME_OVERLAP"
                severity = "ERROR"
                desc = (
                    f"Volumetric 3D collision of {overlap_vol:.3f} m³ detected between {unit_a_ulpin} and {unit_b_ulpin}."
                )
        elif surface_intersects:
            rel_code = "BOUNDARY_CONTACT"
            severity = "INFO"
            desc = f"Zero-volume boundary interface contact verified between {unit_a_ulpin} and {unit_b_ulpin}."
        else:
            rel_code = "DISJOINT"
            severity = "INFO"
            desc = f"Units {unit_a_ulpin} and {unit_b_ulpin} are completely spatially disjoint."

        return TopologyPairwiseRelationship(
            unit_a_id=unit_a_id,
            unit_a_ulpin=unit_a_ulpin,
            unit_b_id=unit_b_id,
            unit_b_ulpin=unit_b_ulpin,
            relationship_code=rel_code,
            overlap_volume_cbm=round(overlap_vol, 4),
            has_surface_contact=surface_intersects,
            shared_z_interval=shared_z,
            severity=severity,
            description=desc
        )

    def evaluate_vertical_continuity(
        self,
        units_data: List[Dict[str, Any]],
        ground_datum_z: float = 540.0
    ) -> List[TopologyVerticalContinuityItem]:
        """
        Evaluates vertical continuity across storeys sorted by elevation.
        """
        # Filter above-ground floors for sequential continuity
        sorted_units = sorted(units_data, key=lambda u: float(u["z_min"]))
        continuity_items: List[TopologyVerticalContinuityItem] = []

        prev_unit = None
        for u in sorted_units:
            z_min = float(u["z_min"])
            z_max = float(u["z_max"])
            floor_code = u["floor_code"]
            tier_code = u["tier_code"]

            if prev_unit is None:
                if z_min <= ground_datum_z + 0.10 and z_max > ground_datum_z:
                    rel = "GROUND_BASE"
                    gap = 0.0
                    sev = "INFO"
                    details = f"Base terrestrial level anchoring the vertical stack at {z_min:.2f}m prototype elevation."
                elif z_max <= ground_datum_z:
                    rel = "SUBTERRANEAN_INTERFACE"
                    gap = 0.0
                    sev = "INFO"
                    details = f"Subterranean stratum below synthetic ground datum (Z: {z_min:.2f}m - {z_max:.2f}m)."
                else:
                    rel = "GROUND_BASE"
                    gap = 0.0
                    sev = "INFO"
                    details = f"Lowest observed stratum in stack at {z_min:.2f}m prototype elevation."
            else:
                prev_z_max = float(prev_unit["z_max"])
                delta = z_min - prev_z_max

                # Same-level side-by-side or cross-category coexistence (e.g. P00 vs F00 or CM01 vs F01)
                if abs(z_min - float(prev_unit["z_min"])) <= 0.05 and abs(z_max - prev_z_max) <= 0.05:
                    rel = "CONTIGUOUS"
                    gap = 0.0
                    sev = "INFO"
                    details = f"Coexisting parallel stratum sharing vertical elevation interval with {prev_unit['floor_code']}."
                elif abs(delta) <= 0.05:
                    rel = "CONTIGUOUS"
                    gap = 0.0
                    sev = "INFO"
                    details = f"Continuous vertical interface verified with lower level {prev_unit['floor_code']} (slab boundary at {z_min:.2f}m)."
                elif delta > 0.05:
                    rel = "VERTICAL_GAP"
                    gap = round(delta, 2)
                    sev = "WARNING"
                    details = f"Vertical gap of {gap:.2f}m detected between {prev_unit['floor_code']} (top: {prev_z_max:.2f}m) and {floor_code} (base: {z_min:.2f}m)."
                else: # delta < -0.05
                    rel = "VERTICAL_OVERLAP"
                    gap = round(abs(delta), 2)
                    sev = "WARNING"
                    details = f"Vertical elevation interval overlap of {gap:.2f}m with {prev_unit['floor_code']} (check horizontal XY separation)."

            continuity_items.append(
                TopologyVerticalContinuityItem(
                    unit_id=u["id"],
                    prototype_ulpin_3d=u["prototype_ulpin_3d"],
                    floor_code=floor_code,
                    z_min=z_min,
                    z_max=z_max,
                    relation_to_lower_unit=rel,
                    gap_or_overlap_m=gap if prev_unit else 0.0,
                    severity=sev,
                    details=details
                )
            )
            # Only update prev_unit if it represents a distinct vertical tier
            if tier_code not in ["CM", "AE"] or prev_unit is None:
                prev_unit = u

        return continuity_items

    def audit_parcel_topology(self, parcel_id: uuid.UUID) -> ParcelTopologyReportResponse:
        """
        Executes a complete 3D topology and spatial quality audit for all vertical units on a parcel.
        Optimized with hierarchical spatial and vertical-elevation pre-filtering.
        """
        # 1. Fetch parcel info
        p_query = text("SELECT id, ulpin_2d FROM parcels WHERE id = :p_id;")
        p_row = self.db.execute(p_query, {"p_id": str(parcel_id)}).mappings().first()
        if not p_row:
            raise LookupError(f"Parcel {parcel_id} not found.")

        parcel_ulpin = p_row["ulpin_2d"]

        # 2. Fetch all vertical units on the parcel with pre-computed solid properties in a single query
        u_query = text("""
            SELECT 
                vu.id,
                vu.prototype_ulpin_3d,
                vu.tier_code,
                vu.floor_code,
                vu.unit_label,
                vu.unit_type,
                vu.z_min,
                vu.z_max,
                vu.status,
                ST_AsText(vu.geom_3d) AS geom_wkt,
                ST_Within(ST_Envelope(vu.geom_3d), p.geom_2d) AS is_within_parcel,
                ST_IsClosed(vu.geom_3d) AS is_closed,
                CG_IsSolid(CG_MakeSolid(vu.geom_3d)) AS is_solid,
                CG_Volume(CG_MakeSolid(vu.geom_3d)) AS volume_cbm,
                ST_ZMin(vu.geom_3d) AS z_min_geom,
                ST_ZMax(vu.geom_3d) AS z_max_geom
            FROM vertical_units vu
            JOIN parcels p ON vu.parcel_id = p.id
            WHERE vu.parcel_id = :p_id AND (vu.unit_level = 'STOREY' OR vu.unit_level IS NULL)
            ORDER BY vu.unit_sequence ASC;
        """)

        units_rows = self.db.execute(u_query, {"p_id": str(parcel_id)}).mappings().all()
        units_data = [dict(r) for r in units_rows]
        n_units = len(units_data)

        solid_validations: List[TopologySolidValidation] = []
        containment_findings: List[TopologyContainmentFinding] = []
        conflict_count = 0
        warning_count = 0

        # Validate solids and containment directly using pre-queried attributes (avoiding N duplicate queries)
        for u in units_data:
            is_closed = bool(u.get("is_closed", False))
            is_solid = bool(u.get("is_solid", False))
            volume_cbm = float(u.get("volume_cbm") or 0.0)
            z_min_meta = float(u["z_min"])
            z_max_meta = float(u["z_max"])
            z_min_geom = float(u.get("z_min_geom") or z_min_meta)
            z_max_geom = float(u.get("z_max_geom") or z_max_meta)

            if not is_closed:
                validity_code = "INVALID_CLOSEDNESS"
                is_valid = False
                details = "Surface is unclosed or non-watertight."
            elif not is_solid:
                validity_code = "INVALID_SOLID"
                is_valid = False
                details = "Geometry could not be reconstructed as a valid SFCGAL B-Rep solid."
            elif volume_cbm <= 0.0001:
                validity_code = "NON_POSITIVE_VOLUME"
                is_valid = False
                details = f"Solid has non-positive or degenerate volume ({volume_cbm:.4f} m³)."
            elif z_max_meta <= z_min_meta or abs(z_min_geom - z_min_meta) > 0.05 or abs(z_max_geom - z_max_meta) > 0.05:
                validity_code = "INVALID_Z_RANGE"
                is_valid = False
                details = f"Z range mismatch: metadata [{z_min_meta:.2f}m - {z_max_meta:.2f}m] vs geom [{z_min_geom:.2f}m - {z_max_geom:.2f}m]."
            else:
                validity_code = "VALID_SOLID"
                is_valid = True
                details = f"Closed watertight 3D solid verified with positive volume ({volume_cbm:.2f} m³)."

            s_val = TopologySolidValidation(
                unit_id=u["id"],
                prototype_ulpin_3d=u["prototype_ulpin_3d"],
                is_closed=is_closed,
                is_solid=is_solid,
                volume_cbm=round(volume_cbm, 4),
                z_min_geom=z_min_geom,
                z_max_geom=z_max_geom,
                z_min_meta=z_min_meta,
                z_max_meta=z_max_meta,
                validity_code=validity_code,
                is_valid=is_valid,
                details=details
            )
            solid_validations.append(s_val)
            if not s_val.is_valid:
                conflict_count += 1

            is_within = bool(u.get("is_within_parcel", True))
            c_status = "CONTAINED" if is_within else "OUTSIDE_PARENT"
            c_sev = "INFO" if is_within else "ERROR"
            c_msg = (
                "Unit footprint projection is enclosed within parent parcel."
                if is_within
                else "Unit horizontal footprint projection extends beyond parent parcel boundary."
            )
            if not is_within:
                conflict_count += 1

            containment_findings.append(
                TopologyContainmentFinding(
                    unit_id=u["id"],
                    prototype_ulpin_3d=u["prototype_ulpin_3d"],
                    is_within_parcel=is_within,
                    is_within_building=True,
                    status=c_status,
                    severity=c_sev,
                    message=c_msg
                )
            )

        # Pairwise unit-to-unit comparison with vertical elevation pre-filtering
        pairwise_relationships: List[TopologyPairwiseRelationship] = []
        for i in range(n_units):
            for j in range(i + 1, n_units):
                u_a = units_data[i]
                u_b = units_data[j]
                z_min_a, z_max_a = float(u_a["z_min"]), float(u_a["z_max"])
                z_min_b, z_max_b = float(u_b["z_min"]), float(u_b["z_max"])

                shared_z = (z_min_a < z_max_b and z_max_a > z_min_b)

                if not shared_z:
                    # Check if touching at floor boundary slab interface
                    touches_z = (abs(z_max_a - z_min_b) <= 0.05 or abs(z_min_a - z_max_b) <= 0.05)
                    if touches_z:
                        rel = TopologyPairwiseRelationship(
                            unit_a_id=u_a["id"],
                            unit_a_ulpin=u_a["prototype_ulpin_3d"],
                            unit_b_id=u_b["id"],
                            unit_b_ulpin=u_b["prototype_ulpin_3d"],
                            relationship_code="BOUNDARY_CONTACT",
                            overlap_volume_cbm=0.0,
                            has_surface_contact=True,
                            shared_z_interval=False,
                            severity="INFO",
                            description=f"Zero-volume boundary interface contact verified between {u_a['prototype_ulpin_3d']} and {u_b['prototype_ulpin_3d']}."
                        )
                    else:
                        rel = TopologyPairwiseRelationship(
                            unit_a_id=u_a["id"],
                            unit_a_ulpin=u_a["prototype_ulpin_3d"],
                            unit_b_id=u_b["id"],
                            unit_b_ulpin=u_b["prototype_ulpin_3d"],
                            relationship_code="DISJOINT",
                            overlap_volume_cbm=0.0,
                            has_surface_contact=False,
                            shared_z_interval=False,
                            severity="INFO",
                            description=f"Units {u_a['prototype_ulpin_3d']} and {u_b['prototype_ulpin_3d']} are completely spatially disjoint."
                        )
                else:
                    # Only execute full 3D intersection DB audit if vertical elevations intersect
                    rel = self.compare_unit_pair_db(
                        unit_a_id=u_a["id"],
                        unit_a_ulpin=u_a["prototype_ulpin_3d"],
                        unit_b_id=u_b["id"],
                        unit_b_ulpin=u_b["prototype_ulpin_3d"]
                    )

                pairwise_relationships.append(rel)
                if rel.severity == "ERROR":
                    conflict_count += 1
                elif rel.severity == "WARNING":
                    warning_count += 1

        # Vertical continuity analysis
        continuity_analysis = self.evaluate_vertical_continuity(units_data)
        for cont in continuity_analysis:
            if cont.severity == "WARNING":
                warning_count += 1
            elif cont.severity == "ERROR":
                conflict_count += 1

        # Overall Status
        if conflict_count > 0:
            overall_status = "CONFLICT"
        elif warning_count > 0:
            overall_status = "REVIEW_REQUIRED"
        else:
            overall_status = "VALID"

        valid_units = sum(1 for s in solid_validations if s.is_valid)

        return ParcelTopologyReportResponse(
            parcel_id=parcel_id,
            parcel_ulpin=parcel_ulpin,
            total_units_audited=n_units,
            overall_topology_status=overall_status,
            valid_unit_count=valid_units,
            conflict_count=conflict_count,
            warning_count=warning_count,
            pairwise_relationships=pairwise_relationships,
            containment_findings=containment_findings,
            vertical_continuity_analysis=continuity_analysis,
            solid_validations=solid_validations,
            disclaimer=(
                "Topology results represent spatial quality-control findings in this research prototype. "
                "They do not constitute legal ownership, title, statutory cadastral certification, or government approval."
            ),
            audited_at=datetime.utcnow()
        )


    def audit_unit_topology(self, unit_id: uuid.UUID) -> UnitTopologyReportResponse:
        """
        Executes a focused 3D spatial quality audit for a single vertical unit.
        """
        u_query = text("""
            SELECT 
                vu.id,
                vu.parcel_id,
                vu.building_id,
                vu.parent_unit_id,
                vu.unit_level,
                vu.prototype_ulpin_3d,
                vu.tier_code,
                vu.floor_code,
                vu.unit_label,
                vu.unit_type,
                vu.z_min,
                vu.z_max,
                vu.status,
                ST_AsText(vu.geom_3d) AS geom_wkt,
                ST_Within(ST_Envelope(vu.geom_3d), p.geom_2d) AS is_within_parcel
            FROM vertical_units vu
            JOIN parcels p ON vu.parcel_id = p.id
            WHERE vu.id = :u_id;
        """)

        u_row = self.db.execute(u_query, {"u_id": str(unit_id)}).mappings().first()
        if not u_row:
            raise LookupError(f"Vertical unit {unit_id} not found.")

        parcel_id = u_row["parcel_id"]
        building_id = u_row["building_id"]
        parent_id = u_row.get("parent_unit_id")
        prototype_ulpin_3d = u_row["prototype_ulpin_3d"]
        z_min = float(u_row["z_min"])
        z_max = float(u_row["z_max"])

        # 1. Solid validation
        solid_val = self.validate_solid_wkt(
            geom_wkt=u_row["geom_wkt"],
            z_min_meta=z_min,
            z_max_meta=z_max,
            unit_id=unit_id,
            prototype_ulpin_3d=prototype_ulpin_3d
        )

        # 2. Containment
        is_within = bool(u_row.get("is_within_parcel", True))
        containment = TopologyContainmentFinding(
            unit_id=unit_id,
            prototype_ulpin_3d=prototype_ulpin_3d,
            is_within_parcel=is_within,
            is_within_building=True,
            status="CONTAINED" if is_within else "OUTSIDE_PARENT",
            severity="INFO" if is_within else "ERROR",
            message=(
                "Unit footprint projection is enclosed within parent parcel."
                if is_within
                else "Unit horizontal footprint projection extends beyond parent parcel boundary."
            )
        )

        # 3. Peer relationships
        if parent_id is not None:
            peer_query = text("""
                SELECT id, prototype_ulpin_3d FROM vertical_units
                WHERE parent_unit_id = :parent_id AND id != :u_id;
            """)
            peer_rows = self.db.execute(peer_query, {"parent_id": str(parent_id), "u_id": str(unit_id)}).mappings().all()
            all_units_query = text("""
                SELECT id, prototype_ulpin_3d, floor_code, tier_code, z_min, z_max
                FROM vertical_units WHERE parent_unit_id = :parent_id;
            """)
            all_units = [dict(r) for r in self.db.execute(all_units_query, {"parent_id": str(parent_id)}).mappings().all()]
        else:
            peer_query = text("""
                SELECT id, prototype_ulpin_3d FROM vertical_units
                WHERE parcel_id = :p_id AND (unit_level = 'STOREY' OR unit_level IS NULL) AND id != :u_id;
            """)
            peer_rows = self.db.execute(peer_query, {"p_id": str(parcel_id), "u_id": str(unit_id)}).mappings().all()
            all_units_query = text("""
                SELECT id, prototype_ulpin_3d, floor_code, tier_code, z_min, z_max
                FROM vertical_units WHERE parcel_id = :p_id AND (unit_level = 'STOREY' OR unit_level IS NULL);
            """)
            all_units = [dict(r) for r in self.db.execute(all_units_query, {"p_id": str(parcel_id)}).mappings().all()]

        peer_relationships: List[TopologyPairwiseRelationship] = []
        conflict_count = 0
        warning_count = 0

        for p in peer_rows:
            rel = self.compare_unit_pair_db(
                unit_a_id=unit_id,
                unit_a_ulpin=prototype_ulpin_3d,
                unit_b_id=p["id"],
                unit_b_ulpin=p["prototype_ulpin_3d"]
            )
            peer_relationships.append(rel)
            if rel.severity == "ERROR":
                conflict_count += 1
            elif rel.severity == "WARNING":
                warning_count += 1

        if not solid_val.is_valid or not is_within:
            conflict_count += 1

        # 4. Vertical continuity
        continuity_list = self.evaluate_vertical_continuity(all_units)
        unit_continuity = next((c for c in continuity_list if c.unit_id == unit_id), continuity_list[0])

        if unit_continuity.severity == "WARNING":
            warning_count += 1
        elif unit_continuity.severity == "ERROR":
            conflict_count += 1

        if conflict_count > 0:
            overall_status = "CONFLICT"
        elif warning_count > 0:
            overall_status = "REVIEW_REQUIRED"
        else:
            overall_status = "VALID"

        return UnitTopologyReportResponse(
            unit_id=unit_id,
            prototype_ulpin_3d=prototype_ulpin_3d,
            parcel_id=parcel_id,
            building_id=building_id,
            overall_quality_status=overall_status,
            solid_validation=solid_val,
            containment=containment,
            vertical_continuity=unit_continuity,
            peer_relationships=peer_relationships,
            conflict_count=conflict_count,
            warning_count=warning_count,
            disclaimer=(
                "Topology results represent spatial quality-control findings in this research prototype. "
                "They do not constitute legal ownership, title, statutory cadastral certification, or government approval."
            ),
            audited_at=datetime.utcnow()
        )
