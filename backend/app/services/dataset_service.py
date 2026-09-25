"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.2: 3D Cadastral Dataset Management & Spatial Navigation Service

Provides parcel-level 3D spatial dataset aggregation, dynamic statistics,
dataset quality scorecard, 12-point consistency checks, neighbor queries,
and multi-attribute filtering.
"""
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.models.entities import (
    Parcel,
    Building,
    VerticalUnit,
    SourceEvidence,
    VerificationAudit
)
from backend.app.services.spatial_service import SpatialService
from backend.app.services.topology_service import TopologyService
from backend.app.schemas.responses import (
    Parcel3DOverviewResponse,
    ParcelBuildingSummary,
    ParcelUnitOverviewItem,
    DatasetStatistics,
    DatasetQualityScorecard,
    DatasetQualityScorecardItem,
    DatasetConsistencyFinding,
    UnitNeighborItem,
    VerticalUnitResponse
)

DEFAULT_SYNTHETIC_GROUND_DATUM_Z = 540.0


def get_unit_category_code(tier_code: str, unit_type: str, floor_code: str) -> str:
    tier = (tier_code or "").upper()
    u_type = (unit_type or "").upper()
    f_code = (floor_code or "").upper()

    if tier in ("UT", "SB"):
        return "UNDERGROUND"
    if tier in ("AR", "AE"):
        return "ROOFTOP_ELEVATED"
    if tier == "CM":
        return "COMMON"
    if tier == "F":
        if f_code in ("F00", "GF", "P00") or u_type == "PARKING":
            return "GROUND"
        return "UPPER_FLOORS"
    return "OTHER"


class DatasetService:
    def __init__(self, db: Session):
        self.db = db
        self.spatial_service = SpatialService(db)
        self.topology_service = TopologyService(db)

    def get_parcel_3d_overview(self, parcel_id: uuid.UUID) -> Parcel3DOverviewResponse:
        """
        Aggregates a complete 3D Cadastral Dataset Overview for a parcel, including
        child buildings, vertical units, dataset statistics, transparent quality scorecard,
        and 12-point dataset consistency findings.
        """
        # 1. Fetch parent parcel
        parcel_query = text("""
            SELECT id, ulpin_2d, survey_number, district, state, village_code, area_sqm,
                   ST_AsText(geom_2d) AS geom_2d_wkt
            FROM parcels
            WHERE id = :p_id;
        """)
        parcel_row = self.db.execute(parcel_query, {"p_id": str(parcel_id)}).mappings().first()
        if not parcel_row:
            raise LookupError(f"Parcel with ID {parcel_id} not found.")

        # 2. Fetch buildings
        buildings_query = text("""
            SELECT b.id, b.building_code, b.building_name, b.total_floors_above, b.total_floors_below,
                   ST_Area(b.footprint_2d) AS footprint_area_sqm,
                   COALESCE(MAX(vu.z_max) - MIN(vu.z_min), 0.0) AS height_m,
                   COUNT(vu.id) AS unit_count
            FROM buildings b
            LEFT JOIN vertical_units vu ON b.id = vu.building_id
            WHERE b.parcel_id = :p_id
            GROUP BY b.id, b.building_code, b.building_name, b.total_floors_above, b.total_floors_below, b.footprint_2d
            ORDER BY b.building_code;
        """)
        bldg_rows = self.db.execute(buildings_query, {"p_id": str(parcel_id)}).mappings().all()
        building_summaries: List[ParcelBuildingSummary] = [
            ParcelBuildingSummary(
                id=r["id"],
                building_code=r["building_code"],
                building_name=r["building_name"],
                total_floors_above=r["total_floors_above"],
                total_floors_below=r["total_floors_below"],
                footprint_area_sqm=round(float(r["footprint_area_sqm"]), 2),
                height_m=round(float(r["height_m"]), 2),
                unit_count=int(r["unit_count"])
            )
            for r in bldg_rows
        ]
        bldg_code_map = {str(b.id): b.building_code for b in building_summaries}

        # 3. Fetch vertical unit rows and audit parcel topology
        units_query = text("""
            SELECT vu.id, vu.building_id, vu.prototype_ulpin_3d, vu.tier_code, vu.floor_code,
                   vu.unit_sequence, vu.unit_label, vu.unit_type, vu.z_min, vu.z_max, vu.status,
                   ST_AsText(vu.geom_3d) AS geom_wkt,
                   (SELECT COUNT(*) FROM source_evidence se WHERE se.unit_id = vu.id) AS evidence_count
            FROM vertical_units vu
            WHERE vu.parcel_id = :p_id
            ORDER BY vu.z_min ASC, vu.unit_sequence ASC;
        """)
        unit_rows = self.db.execute(units_query, {"p_id": str(parcel_id)}).mappings().all()

        # Compute parcel topology using Phase 3.0 Topology Engine
        parcel_topology = self.topology_service.audit_parcel_topology(parcel_id)
        
        solid_val_map = {str(s.unit_id): s for s in parcel_topology.solid_validations}
        unit_conflict_map: Dict[str, int] = {}
        for pair in parcel_topology.pairwise_relationships:
            if pair.severity == "ERROR":
                unit_conflict_map[str(pair.unit_a_id)] = unit_conflict_map.get(str(pair.unit_a_id), 0) + 1
                unit_conflict_map[str(pair.unit_b_id)] = unit_conflict_map.get(str(pair.unit_b_id), 0) + 1

        unit_items: List[ParcelUnitOverviewItem] = []
        status_counts = {"PROPOSED": 0, "UNDER_REVIEW": 0, "VERIFIED": 0, "REJECTED": 0}
        taxonomy_counts = {
            "UNDERGROUND": 0,
            "GROUND": 0,
            "UPPER_FLOORS": 0,
            "ROOFTOP_ELEVATED": 0,
            "COMMON": 0,
            "OTHER": 0
        }
        total_volume = 0.0
        total_evidence = 0
        valid_solids_count = 0
        units_with_evidence_count = 0
        underground_with_subsurface_ev = 0
        underground_total = 0

        for r in unit_rows:
            u_id = r["id"]
            z_min = float(r["z_min"])
            z_max = float(r["z_max"])
            st = str(r["status"]).upper()
            tier = r["tier_code"]
            f_code = r["floor_code"]
            u_type = r["unit_type"]
            ev_count = int(r["evidence_count"])

            solid_val = solid_val_map.get(str(u_id))
            vol = solid_val.volume_cbm if solid_val else 0.0
            is_solid = solid_val.is_valid if solid_val else False
            c_count = unit_conflict_map.get(str(u_id), 0)

            # Statistics accumulation
            status_counts[st] = status_counts.get(st, 0) + 1
            cat = get_unit_category_code(tier, u_type, f_code)
            taxonomy_counts[cat] = taxonomy_counts.get(cat, 0) + 1
            total_volume += vol
            total_evidence += ev_count

            if is_solid:
                valid_solids_count += 1
            if ev_count > 0:
                units_with_evidence_count += 1

            if cat == "UNDERGROUND":
                underground_total += 1
                if ev_count > 0:
                    underground_with_subsurface_ev += 1

            bldg_id = r["building_id"]
            bldg_code = bldg_code_map.get(str(bldg_id)) if bldg_id else None

            unit_items.append(
                ParcelUnitOverviewItem(
                    id=u_id,
                    prototype_ulpin_3d=r["prototype_ulpin_3d"],
                    building_id=bldg_id,
                    building_code=bldg_code,
                    floor_code=f_code,
                    tier_code=tier,
                    unit_label=r["unit_label"],
                    unit_type=u_type,
                    z_min=z_min,
                    z_max=z_max,
                    height_m=round(z_max - z_min, 2),
                    volume_cbm=round(vol, 2),
                    status=st,
                    is_solid_valid=is_solid,
                    evidence_count=ev_count,
                    conflict_count=c_count
                )
            )

        total_units_count = len(unit_items)

        statistics = DatasetStatistics(
            total_units=total_units_count,
            total_buildings=len(building_summaries),
            status_counts=status_counts,
            taxonomy_counts=taxonomy_counts,
            total_modeled_volume_cbm=round(total_volume, 2),
            total_evidence_records=total_evidence
        )

        # 4. Compute 3D Dataset Quality Scorecard
        conflict_free_units_count = sum(1 for u in unit_items if u.conflict_count == 0)
        total_vc_stacks = len(parcel_topology.vertical_continuity_analysis)
        valid_vc_stacks = sum(1 for vc in parcel_topology.vertical_continuity_analysis if vc.severity == "INFO")

        scorecard_items: List[DatasetQualityScorecardItem] = [
            DatasetQualityScorecardItem(
                category="GEOMETRY",
                metric_name="SFCGAL Valid Solid Geometries",
                count=valid_solids_count,
                total=total_units_count,
                severity="INFO" if valid_solids_count == total_units_count else "ERROR",
                details=f"{valid_solids_count}/{total_units_count} units are valid watertight 3-manifold solids."
            ),
            DatasetQualityScorecardItem(
                category="TOPOLOGY",
                metric_name="Conflict-Free Vertical Units",
                count=conflict_free_units_count,
                total=total_units_count,
                severity="INFO" if conflict_free_units_count == total_units_count else "WARNING",
                details=f"{conflict_free_units_count}/{total_units_count} units have zero positive-volume collisions."
            ),
            DatasetQualityScorecardItem(
                category="EVIDENCE",
                metric_name="Units with Multi-Source Evidence",
                count=units_with_evidence_count,
                total=total_units_count,
                severity="INFO" if units_with_evidence_count == total_units_count else "WARNING",
                details=f"{units_with_evidence_count}/{total_units_count} vertical units have linked sensor/engineering records."
            ),
            DatasetQualityScorecardItem(
                category="VERTICAL_CONTINUITY",
                metric_name="Continuous Storey Interfaces",
                count=valid_vc_stacks,
                total=total_vc_stacks,
                severity="INFO" if valid_vc_stacks == total_vc_stacks else "WARNING",
                details=f"{valid_vc_stacks}/{total_vc_stacks} vertical floor transitions verified contiguous."
            ),
        ]

        if underground_total > 0:
            scorecard_items.append(
                DatasetQualityScorecardItem(
                    category="SUBSURFACE",
                    metric_name="Subsurface Documentation",
                    count=underground_with_subsurface_ev,
                    total=underground_total,
                    severity="INFO" if underground_with_subsurface_ev == underground_total else "WARNING",
                    details=f"{underground_with_subsurface_ev}/{underground_total} subsurface units supported by BIM/CAD/survey documentation."
                )
            )

        err_count = sum(1 for s in scorecard_items if s.severity == "ERROR")
        warn_count = sum(1 for s in scorecard_items if s.severity == "WARNING")
        if err_count > 0:
            overall_quality = "CRITICAL_ISSUES"
        elif warn_count > 0:
            overall_quality = "ATTENTION_REQUIRED"
        else:
            overall_quality = "HEALTHY"

        quality_scorecard = DatasetQualityScorecard(
            overall_quality=overall_quality,
            geometry_valid_solids=valid_solids_count,
            geometry_total=total_units_count,
            topology_conflict_free_units=conflict_free_units_count,
            topology_total_units=total_units_count,
            evidence_supported_units=units_with_evidence_count,
            evidence_total_units=total_units_count,
            vertical_continuity_valid_stacks=valid_vc_stacks,
            vertical_continuity_total_stacks=total_vc_stacks,
            scorecard_items=scorecard_items
        )

        # 5. 12-Point Dataset Consistency Audit
        consistency_findings = self._audit_parcel_dataset_consistency(parcel_id, unit_rows, parcel_topology)

        return Parcel3DOverviewResponse(
            parcel_id=parcel_row["id"],
            parcel_ulpin_2d=parcel_row["ulpin_2d"],
            survey_number=parcel_row["survey_number"],
            district=parcel_row["district"],
            state=parcel_row["state"],
            village_code=parcel_row["village_code"],
            area_sqm=round(float(parcel_row["area_sqm"]), 2),
            crs="EPSG:32644",
            geom_2d_wkt=parcel_row["geom_2d_wkt"],
            buildings=building_summaries,
            units=unit_items,
            statistics=statistics,
            quality_scorecard=quality_scorecard,
            consistency_findings=consistency_findings
        )

    def _audit_parcel_dataset_consistency(
        self,
        parcel_id: uuid.UUID,
        unit_rows: List[Any],
        parcel_topology: Any
    ) -> List[DatasetConsistencyFinding]:
        """
        Executes a 12-point dataset consistency audit on the parcel.
        """
        findings: List[DatasetConsistencyFinding] = []

        # Check 1: Orphan vertical units (no parcel)
        orphan_query = text("SELECT id FROM vertical_units WHERE parcel_id IS NULL;")
        orphan_rows = self.db.execute(orphan_query).mappings().all()
        orphan_ids = [r["id"] for r in orphan_rows]
        findings.append(
            DatasetConsistencyFinding(
                check_id="ORPHAN_UNITS_CHECK",
                check_name="Orphan Vertical Units",
                status="PASS" if len(orphan_ids) == 0 else "ERROR",
                details="Zero orphan vertical units detected." if len(orphan_ids) == 0 else f"{len(orphan_ids)} orphan unit(s) found.",
                affected_unit_ids=orphan_ids
            )
        )

        # Check 2: Invalid Z ranges (z_max <= z_min)
        invalid_z_ids = [r["id"] for r in unit_rows if float(r["z_max"]) <= float(r["z_min"])]
        findings.append(
            DatasetConsistencyFinding(
                check_id="INVALID_Z_RANGE_CHECK",
                check_name="Elevation Range Consistency (Z_max > Z_min)",
                status="PASS" if len(invalid_z_ids) == 0 else "ERROR",
                details="All units exhibit valid positive Z height intervals." if len(invalid_z_ids) == 0 else f"{len(invalid_z_ids)} unit(s) with inverted Z ranges.",
                affected_unit_ids=invalid_z_ids
            )
        )

        # Check 3: Duplicate Prototype 3D Unit IDs
        ulpins = [r["prototype_ulpin_3d"] for r in unit_rows]
        has_dup_ulpin = len(ulpins) != len(set(ulpins))
        findings.append(
            DatasetConsistencyFinding(
                check_id="DUPLICATE_ID_CHECK",
                check_name="Prototype 3D Unit ID Uniqueness",
                status="PASS" if not has_dup_ulpin else "ERROR",
                details="All prototype 3D Unit IDs are strictly unique within the parcel." if not has_dup_ulpin else "Duplicate Prototype 3D Unit IDs detected.",
                affected_unit_ids=[]
            )
        )

        # Check 4: Duplicate Sequence Allocation
        seqs = [r["unit_sequence"] for r in unit_rows]
        has_dup_seq = len(seqs) != len(set(seqs))
        findings.append(
            DatasetConsistencyFinding(
                check_id="SEQUENCE_ALLOCATION_CHECK",
                check_name="Atomic Unit Sequence Allocation",
                status="PASS" if not has_dup_seq else "WARNING",
                details="Unit sequences are uniquely allocated." if not has_dup_seq else "Non-unique unit sequence allocation detected.",
                affected_unit_ids=[]
            )
        )

        # Check 5: Geometry SRID Consistency
        srid_query = text("""
            SELECT id, ST_SRID(geom_3d) AS srid FROM vertical_units WHERE parcel_id = :p_id;
        """)
        srid_rows = self.db.execute(srid_query, {"p_id": str(parcel_id)}).mappings().all()
        mismatched_srid_ids = [r["id"] for r in srid_rows if r["srid"] != 32644]
        findings.append(
            DatasetConsistencyFinding(
                check_id="SRID_CONSISTENCY_CHECK",
                check_name="Analytical Spatial Reference (EPSG:32644)",
                status="PASS" if len(mismatched_srid_ids) == 0 else "ERROR",
                details="All 3D geometries anchored in canonical EPSG:32644 CRS." if len(mismatched_srid_ids) == 0 else f"{len(mismatched_srid_ids)} unit(s) with mismatched SRID.",
                affected_unit_ids=mismatched_srid_ids
            )
        )

        # Check 6: SFCGAL Solid Closure & Watertightness
        invalid_solid_ids = [s.unit_id for s in parcel_topology.solid_validations if not s.is_valid]
        findings.append(
            DatasetConsistencyFinding(
                check_id="SOLID_WATERTIGHTNESS_CHECK",
                check_name="SFCGAL 3-Manifold Solid Watertightness",
                status="PASS" if len(invalid_solid_ids) == 0 else "ERROR",
                details="All units validated as closed SFCGAL solids." if len(invalid_solid_ids) == 0 else f"{len(invalid_solid_ids)} non-solid or non-watertight unit(s).",
                affected_unit_ids=invalid_solid_ids
            )
        )

        # Check 7: Parcel Footprint Boundary Containment
        outside_containment_ids = [
            c.unit_id for c in parcel_topology.containment_findings if c.status != "CONTAINED"
        ]
        findings.append(
            DatasetConsistencyFinding(
                check_id="PARCEL_CONTAINMENT_CHECK",
                check_name="Parcel Boundary Containment",
                status="PASS" if len(outside_containment_ids) == 0 else "WARNING",
                details="All unit footprint projections are contained within the parcel." if len(outside_containment_ids) == 0 else f"{len(outside_containment_ids)} unit(s) extend beyond parcel footprint.",
                affected_unit_ids=outside_containment_ids
            )
        )

        # Check 8: 3D Volumetric Overlap Collisions
        conflict_ids = set()
        for p in parcel_topology.pairwise_relationships:
            if p.relationship_code == "POSITIVE_VOLUME_OVERLAP":
                conflict_ids.add(p.unit_a_id)
                conflict_ids.add(p.unit_b_id)
        findings.append(
            DatasetConsistencyFinding(
                check_id="VOLUMETRIC_OVERLAP_CHECK",
                check_name="Positive-Volume 3D Spatial Collision",
                status="PASS" if len(conflict_ids) == 0 else "WARNING",
                details="Zero volumetric spatial collisions detected." if len(conflict_ids) == 0 else f"{len(conflict_ids)} unit(s) involved in positive-volume collisions.",
                affected_unit_ids=list(conflict_ids)
            )
        )

        # Check 9: Duplicate Spatial Representation
        dup_geom_ids = set()
        for p in parcel_topology.pairwise_relationships:
            if p.relationship_code == "DUPLICATE_SPATIAL_REPRESENTATION":
                dup_geom_ids.add(p.unit_a_id)
                dup_geom_ids.add(p.unit_b_id)
        findings.append(
            DatasetConsistencyFinding(
                check_id="DUPLICATE_GEOMETRY_CHECK",
                check_name="Duplicate Spatial Representation",
                status="PASS" if len(dup_geom_ids) == 0 else "ERROR",
                details="No duplicate volumetric representations detected." if len(dup_geom_ids) == 0 else f"{len(dup_geom_ids)} duplicate geometry pair(s) detected.",
                affected_unit_ids=list(dup_geom_ids)
            )
        )

        # Check 10: Missing Source Evidence
        no_evidence_ids = [r["id"] for r in unit_rows if int(r["evidence_count"]) == 0]
        findings.append(
            DatasetConsistencyFinding(
                check_id="SOURCE_EVIDENCE_ATTACHMENT_CHECK",
                check_name="Multi-Source Evidence Attachment",
                status="PASS" if len(no_evidence_ids) == 0 else "WARNING",
                details="All units have linked source evidence datasets." if len(no_evidence_ids) == 0 else f"{len(no_evidence_ids)} unit(s) missing supporting evidence.",
                affected_unit_ids=no_evidence_ids
            )
        )

        # Check 11: Subsurface Sensor Differentiation
        subsurface_units = [r for r in unit_rows if r["tier_code"] in ("SB", "UT") or float(r["z_max"]) <= 0.0]
        unsupported_subsurface = [r["id"] for r in subsurface_units if int(r["evidence_count"]) == 0]
        findings.append(
            DatasetConsistencyFinding(
                check_id="SUBSURFACE_DOCUMENTATION_CHECK",
                check_name="Subsurface Sensor Documentation",
                status="PASS" if len(unsupported_subsurface) == 0 else "WARNING",
                details="All subsurface units supported by appropriate engineering/BIM/survey records." if len(unsupported_subsurface) == 0 else f"{len(unsupported_subsurface)} subsurface unit(s) lack supporting engineering records.",
                affected_unit_ids=unsupported_subsurface
            )
        )

        # Check 12: Lifecycle State Machine Consistency
        valid_statuses = {"PROPOSED", "UNDER_REVIEW", "VERIFIED", "REJECTED"}
        invalid_status_ids = [r["id"] for r in unit_rows if str(r["status"]).upper() not in valid_statuses]
        findings.append(
            DatasetConsistencyFinding(
                check_id="LIFECYCLE_STATUS_CHECK",
                check_name="Lifecycle State Machine Conformity",
                status="PASS" if len(invalid_status_ids) == 0 else "ERROR",
                details="All units conform to canonical lifecycle states (PROPOSED, UNDER_REVIEW, VERIFIED, REJECTED)." if len(invalid_status_ids) == 0 else f"{len(invalid_status_ids)} unit(s) with invalid status.",
                affected_unit_ids=invalid_status_ids
            )
        )

        return findings

    def get_unit_neighbors(self, unit_id: uuid.UUID) -> List[UnitNeighborItem]:
        """
        Retrieves all adjoining or intersecting peer units for a vertical unit,
        leveraging Phase 3.0 TopologyService.
        """
        topology_report = self.topology_service.audit_unit_topology(unit_id)
        neighbors: List[UnitNeighborItem] = []

        for rel in topology_report.peer_relationships:
            # Query neighbor unit metadata
            n_row = self.db.query(VerticalUnit).filter(VerticalUnit.id == rel.unit_b_id).first()
            if not n_row:
                continue

            neighbors.append(
                UnitNeighborItem(
                    neighbor_id=n_row.id,
                    neighbor_ulpin_3d=n_row.prototype_ulpin_3d,
                    floor_code=n_row.floor_code,
                    tier_code=n_row.tier_code,
                    relationship_code=rel.relationship_code,
                    overlap_volume_cbm=rel.overlap_volume_cbm,
                    shared_z_interval=rel.shared_z_interval,
                    has_surface_contact=rel.has_surface_contact,
                    severity=rel.severity,
                    description=rel.description
                )
            )

        return neighbors

    def filter_parcel_units(
        self,
        parcel_id: uuid.UUID,
        tier: Optional[str] = None,
        status: Optional[str] = None,
        floor: Optional[str] = None,
        search: Optional[str] = None,
        unit_level: Optional[str] = None,
        parent_unit_id: Optional[uuid.UUID] = None,
        include_subunits: bool = False
    ) -> List[VerticalUnitResponse]:
        """
        Filters vertical units for a parcel by tier, lifecycle status, floor code, unit_level, or search term.
        By default, returns STOREY-level units unless include_subunits is True or unit_level/parent_unit_id is specified.
        """
        all_units = self.spatial_service.get_vertical_units_for_parcel(parcel_id)
        filtered = all_units

        # Hierarchy filtering: by default, show STOREY level units
        if unit_level:
            u_lvl = unit_level.strip().upper()
            filtered = [u for u in filtered if u.unit_level.upper() == u_lvl]
        elif parent_unit_id:
            filtered = [u for u in filtered if u.parent_unit_id == parent_unit_id]
        elif not include_subunits:
            filtered = [u for u in filtered if u.unit_level == "STOREY" or u.parent_unit_id is None]

        if tier:
            t_upper = tier.strip().upper()
            filtered = [u for u in filtered if u.tier_code.upper() == t_upper]

        if status:
            s_upper = status.strip().upper()
            filtered = [u for u in filtered if u.status.upper() == s_upper]

        if floor:
            f_upper = floor.strip().upper()
            filtered = [u for u in filtered if u.floor_code.upper() == f_upper]

        if search:
            q = search.strip().lower()
            filtered = [
                u for u in filtered
                if (
                    q in u.prototype_ulpin_3d.lower()
                    or q in u.unit_label.lower()
                    or q in u.floor_code.lower()
                    or q in u.unit_type.lower()
                    or q in u.tier_code.lower()
                    or (u.flat_number and q in u.flat_number.lower())
                )
            ]

        return filtered
