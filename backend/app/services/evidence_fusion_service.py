"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.5: Multi-Source Evidence Fusion & Confidence-Aware Candidate Assessment

Provides an explainable, rule-based evidence-fusion layer that evaluates multiple
spatial source records for a 3D vertical unit, performs cross-source agreement comparisons,
detects geometric/provenance conflicts, enforces underground sensor safety, and generates
transparent, decomposable confidence dimensions for human reviewers.
"""
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.models.entities import VerticalUnit, Parcel, Building, SourceEvidence
from backend.app.services.topology_service import TopologyService
from backend.app.services.fusion_tolerances import (
    HEIGHT_AGREEMENT_TOLERANCE_M,
    HEIGHT_DISCREPANCY_TOLERANCE_M,
    ELEVATION_Z_ALIGNMENT_TOLERANCE_M,
    FOOTPRINT_AREA_RATIO_AGREEMENT_MIN,
    FOOTPRINT_AREA_RATIO_AGREEMENT_MAX,
    FOOTPRINT_AREA_RATIO_CONFLICT_MIN,
    FOOTPRINT_AREA_RATIO_CONFLICT_MAX,
    HORIZONTAL_POSITION_TOLERANCE_M,
    VOLUMETRIC_OVERLAP_TOLERANCE_CBM,
    SOURCE_CAPABILITIES
)
from backend.app.schemas.evidence_fusion import (
    UnitEvidenceFusionResponse,
    EvidenceDimensionBreakdown,
    EvaluatedSourceRecord,
    AgreementComparisonItem,
    ConflictNoticeItem,
    EvidenceDimensionLevel,
    SourcePresenceLevel,
    AgreementStatus,
    ConflictSeverity,
    ConflictCode
)


class EvidenceFusionService:
    """
    Explainable, rule-based evidence assessment engine for 3D vertical units.
    Evaluates evidence source capabilities, measurement agreement, provenance quality,
    and subterranean safety. Does not make legal determinations.
    """

    def __init__(self, db: Session):
        self.db = db
        self.topology_service = TopologyService(db)

    def fuse_unit_evidence(self, unit_id: uuid.UUID) -> UnitEvidenceFusionResponse:
        """
        Computes a transparent, explainable multi-source evidence fusion dossier
        for the given vertical unit.
        """
        # 1. Fetch unit record and basic geometry properties
        sql = text("""
            SELECT 
                u.id,
                u.parcel_id,
                u.building_id,
                u.prototype_ulpin_3d,
                u.tier_code,
                u.floor_code,
                u.unit_sequence,
                u.unit_label,
                u.unit_type,
                u.z_min,
                u.z_max,
                u.status,
                u.created_at,
                ST_Area(ST_Envelope(u.geom_3d)) AS footprint_area_sqm,
                ST_Perimeter(ST_Envelope(u.geom_3d)) AS footprint_perimeter_m,
                ST_ZMin(u.geom_3d) AS geom_z_min,
                ST_ZMax(u.geom_3d) AS geom_z_max,
                CG_Volume(CG_MakeSolid(u.geom_3d)) AS volume_cbm,
                ST_IsClosed(u.geom_3d) AS is_closed,
                ST_X(ST_Centroid(ST_Envelope(u.geom_3d))) AS centroid_x,
                ST_Y(ST_Centroid(ST_Envelope(u.geom_3d))) AS centroid_y
            FROM vertical_units u
            WHERE u.id = :unit_id
        """)


        row = self.db.execute(sql, {"unit_id": unit_id}).mappings().first()
        if not row:
            raise LookupError(f"Vertical unit with ID {unit_id} not found.")

        is_underground = row["tier_code"] in ("SB", "UT")
        unit_height = float(row["z_max"]) - float(row["z_min"])
        geom_height = float(row["geom_z_max"]) - float(row["geom_z_min"])
        footprint_area = float(row["footprint_area_sqm"] or 0.0)

        # 2. Fetch linked source evidence records
        evidence_records: List[SourceEvidence] = (
            self.db.query(SourceEvidence)
            .filter(SourceEvidence.unit_id == unit_id)
            .order_by(SourceEvidence.created_at.asc())
            .all()
        )

        # 3. Fetch 3D Topology Audit Report (read-only)
        topology_report = None
        try:
            topology_report = self.topology_service.audit_unit_topology(unit_id)
        except Exception:
            topology_report = None

        # 4. Evaluate each source record against capability profile
        evaluated_sources: List[EvaluatedSourceRecord] = []
        for ev in evidence_records:
            cap = SOURCE_CAPABILITIES.get(ev.source_type, {
                "sensor_category": "SPATIAL_DATASET",
                "supports_geometry": True,
                "supports_height": False,
                "supports_vertical_extent": False,
                "supports_crs": True,
                "supports_underground": False,
                "supports_provenance": False,
                "notes": "Unrecognized or custom spatial evidence source."
            })

            h_acc = float(ev.accuracy_horizontal_m) if ev.accuracy_horizontal_m is not None else None
            v_acc = float(ev.accuracy_vertical_m) if ev.accuracy_vertical_m is not None else None
            meta = ev.metadata_json or {}
            crs = str(meta.get("crs") or meta.get("srid") or "EPSG:32644")
            sha256 = meta.get("sha256_fingerprint") or meta.get("sha256_hash") or meta.get("file_hash")

            # Determine individual provenance quality
            if sha256 and h_acc is not None and v_acc is not None and h_acc <= 0.10 and v_acc <= 0.10:
                prov_lvl: EvidenceDimensionLevel = "HIGH"
            elif h_acc is not None and v_acc is not None and h_acc <= 0.30 and v_acc <= 0.30:
                prov_lvl = "MEDIUM"
            elif h_acc is not None or v_acc is not None or sha256:
                prov_lvl = "LOW"
            else:
                prov_lvl = "UNKNOWN"

            # Supported claims
            supported: List[str] = []
            unsupported: List[str] = []

            if cap["supports_geometry"]:
                supported.append("3D Footprint & Spatial Envelope")
            if cap["supports_height"]:
                supported.append("Vertical Height / Elevation Extent")
            if cap["supports_crs"]:
                supported.append(f"Geodetic Reference Frame ({crs})")
            if cap["supports_provenance"]:
                supported.append("Dataset Provenance & Lineage")

            if is_underground:
                if cap["supports_underground"]:
                    supported.append("Subterranean Structural / Utility Geometry")
                else:
                    unsupported.append("Subterranean Geometry (Airborne/Surface sensor cannot penetrate underground)")

            evaluated_sources.append(
                EvaluatedSourceRecord(
                    id=ev.id,
                    source_type=ev.source_type,
                    dataset_name=ev.dataset_name,
                    file_uri=ev.file_uri,
                    accuracy_horizontal_m=h_acc,
                    accuracy_vertical_m=v_acc,
                    sensor_category=cap["sensor_category"],
                    crs=crs,
                    sha256_hash=sha256,
                    provenance_quality=prov_lvl,
                    supported_claims=supported,
                    unsupported_claims=unsupported,
                    is_synthetic=True,
                    created_at=ev.created_at
                )
            )

        # 5. Cross-Source Measurement Agreement & Comparisons
        comparisons: List[AgreementComparisonItem] = []
        conflicts: List[ConflictNoticeItem] = []
        underground_warnings: List[str] = []
        reviewer_attention: List[str] = []

        # Compare extracted unit height against source metadata heights
        height_sources: List[Tuple[str, float]] = []
        footprint_sources: List[Tuple[str, float]] = []

        for ev in evidence_records:
            meta = ev.metadata_json or {}
            # Check for height in metadata
            src_height = None
            if "measured_height_m" in meta:
                src_height = float(meta["measured_height_m"])
            elif "floor_height_m" in meta:
                src_height = float(meta["floor_height_m"])
            elif "height_interval_m" in meta:
                src_height = float(meta["height_interval_m"])

            if src_height is not None:
                height_sources.append((ev.source_type, src_height))

            # Check for footprint area in metadata
            src_area = None
            if "footprint_area_sqm" in meta:
                src_area = float(meta["footprint_area_sqm"])
            elif "area_sqm" in meta:
                src_area = float(meta["area_sqm"])

            if src_area is not None:
                footprint_sources.append((ev.source_type, src_area))

        # Always include reconstructed geometry height as baseline
        height_sources.append(("RECONSTRUCTED_SOLID", unit_height))
        if footprint_area > 0:
            footprint_sources.append(("RECONSTRUCTED_FOOTPRINT", footprint_area))

        # Pairwise Height Comparisons
        for i in range(len(height_sources)):
            for j in range(i + 1, len(height_sources)):
                src_a_name, val_a = height_sources[i]
                src_b_name, val_b = height_sources[j]
                diff = abs(val_a - val_b)

                if diff <= HEIGHT_AGREEMENT_TOLERANCE_M:
                    c_status: AgreementStatus = "AGREEMENT"
                    c_notes = f"Height difference {diff:.3f}m is within prototype agreement tolerance (≤ {HEIGHT_AGREEMENT_TOLERANCE_M}m)."
                elif diff <= HEIGHT_DISCREPANCY_TOLERANCE_M:
                    c_status = "MINOR_DISCREPANCY"
                    c_notes = f"Height difference {diff:.3f}m exceeds agreement threshold (0.15m) but is within discrepancy limit (≤ {HEIGHT_DISCREPANCY_TOLERANCE_M}m)."
                    reviewer_attention.append(f"Minor vertical height discrepancy of {diff:.2f}m between {src_a_name} and {src_b_name}.")
                else:
                    c_status = "CONFLICT"
                    c_notes = f"Height difference {diff:.3f}m exceeds maximum tolerance threshold ({HEIGHT_DISCREPANCY_TOLERANCE_M}m)."
                    conflicts.append(
                        ConflictNoticeItem(
                            code="HEIGHT_CONFLICT",
                            severity="ERROR",
                            affected_attribute="vertical_height_m",
                            source_a=src_a_name,
                            source_b=src_b_name,
                            measured_values={src_a_name: val_a, src_b_name: val_b, "diff_m": round(diff, 3)},
                            configured_tolerance=f"≤ {HEIGHT_DISCREPANCY_TOLERANCE_M}m",
                            recommendation="Human reviewer must inspect vertical elevation schedule and cross-sectional profile."
                        )
                    )
                    reviewer_attention.append(f"Significant height conflict ({diff:.2f}m) detected between {src_a_name} and {src_b_name}.")

                comparisons.append(
                    AgreementComparisonItem(
                        measurement_name="Vertical Floor Height",
                        source_a_type=src_a_name,
                        source_a_val=round(val_a, 3),
                        source_b_type=src_b_name,
                        source_b_val=round(val_b, 3),
                        difference=round(diff, 3),
                        tolerance=HEIGHT_AGREEMENT_TOLERANCE_M,
                        unit_of_measure="m",
                        status=c_status,
                        notes=c_notes
                    )
                )

        # Pairwise Footprint Area Comparisons
        for i in range(len(footprint_sources)):
            for j in range(i + 1, len(footprint_sources)):
                src_a_name, val_a = footprint_sources[i]
                src_b_name, val_b = footprint_sources[j]
                if val_b > 0 and val_a > 0:
                    ratio = val_a / val_b
                    diff_area = abs(val_a - val_b)
                    if FOOTPRINT_AREA_RATIO_AGREEMENT_MIN <= ratio <= FOOTPRINT_AREA_RATIO_AGREEMENT_MAX:
                        fp_status: AgreementStatus = "AGREEMENT"
                        fp_notes = f"Footprint area ratio {ratio:.3f} is within acceptable agreement range ({FOOTPRINT_AREA_RATIO_AGREEMENT_MIN}-{FOOTPRINT_AREA_RATIO_AGREEMENT_MAX})."
                    elif FOOTPRINT_AREA_RATIO_CONFLICT_MIN <= ratio <= FOOTPRINT_AREA_RATIO_CONFLICT_MAX:
                        fp_status = "MINOR_DISCREPANCY"
                        fp_notes = f"Footprint area ratio {ratio:.3f} shows moderate horizontal variation."
                        reviewer_attention.append(f"Minor footprint area variation ({diff_area:.2f} m²) between {src_a_name} and {src_b_name}.")
                    else:
                        fp_status = "CONFLICT"
                        fp_notes = f"Footprint area ratio {ratio:.3f} exceeds horizontal tolerance boundaries."
                        conflicts.append(
                            ConflictNoticeItem(
                                code="FOOTPRINT_CONFLICT",
                                severity="ERROR",
                                affected_attribute="footprint_area_sqm",
                                source_a=src_a_name,
                                source_b=src_b_name,
                                measured_values={src_a_name: val_a, src_b_name: val_b, "ratio": round(ratio, 3)},
                                configured_tolerance=f"Ratio between {FOOTPRINT_AREA_RATIO_CONFLICT_MIN} and {FOOTPRINT_AREA_RATIO_CONFLICT_MAX}",
                                recommendation="Review 2D boundary polygons and check for cantilevers, balconies, or setback variations."
                            )
                        )
                        reviewer_attention.append(f"Footprint area conflict between {src_a_name} and {src_b_name} (ratio: {ratio:.2f}).")

                    comparisons.append(
                        AgreementComparisonItem(
                            measurement_name="Footprint Area",
                            source_a_type=src_a_name,
                            source_a_val=round(val_a, 2),
                            source_b_type=src_b_name,
                            source_b_val=round(val_b, 2),
                            difference=round(diff_area, 2),
                            tolerance=round(FOOTPRINT_AREA_RATIO_AGREEMENT_MAX, 2),
                            unit_of_measure="m²",
                            status=fp_status,
                            notes=fp_notes
                        )
                    )

        # 6. Additional Checks: Elevation Consistency, CRS, Provenance, Underground Safety, Topology
        # Check Z-range consistency
        z_min = float(row["z_min"])
        z_max = float(row["z_max"])
        geom_z_min = float(row["geom_z_min"])
        geom_z_max = float(row["geom_z_max"])

        if z_min >= z_max:
            conflicts.append(
                ConflictNoticeItem(
                    code="Z_RANGE_CONFLICT",
                    severity="ERROR",
                    affected_attribute="z_bounds",
                    source_a="UNIT_METADATA",
                    measured_values={"z_min": z_min, "z_max": z_max},
                    recommendation="Inverted Z-bounds detected (z_min >= z_max). Must be corrected before review."
                )
            )
        elif abs(z_min - geom_z_min) > ELEVATION_Z_ALIGNMENT_TOLERANCE_M or abs(z_max - geom_z_max) > ELEVATION_Z_ALIGNMENT_TOLERANCE_M:
            conflicts.append(
                ConflictNoticeItem(
                    code="Z_RANGE_CONFLICT",
                    severity="WARNING",
                    affected_attribute="z_bounds",
                    source_a="UNIT_METADATA",
                    source_b="RECONSTRUCTED_SOLID",
                    measured_values={
                        "metadata": {"z_min": z_min, "z_max": z_max},
                        "geometry": {"z_min": geom_z_min, "z_max": geom_z_max}
                    },
                    configured_tolerance=f"≤ {ELEVATION_Z_ALIGNMENT_TOLERANCE_M}m",
                    recommendation="Reconstructed 3D geometry bounding box differs slightly from nominal metadata elevation."
                )
            )

        # Check Provenance & CRS Completeness across sources
        has_missing_provenance = False
        has_uncertain_crs = False
        for es in evaluated_sources:
            if es.provenance_quality in ("LOW", "UNKNOWN"):
                has_missing_provenance = True
            if not es.crs or es.crs.upper() not in ("EPSG:32644", "UTM ZONE 44N"):
                has_uncertain_crs = True

        if has_missing_provenance:
            conflicts.append(
                ConflictNoticeItem(
                    code="PROVENANCE_INCOMPLETE",
                    severity="WARNING",
                    affected_attribute="provenance_metadata",
                    source_a="SOURCE_EVIDENCE",
                    recommendation="One or more evidence sources lack complete SHA-256 fingerprint or precision accuracy records."
                )
            )

        if has_uncertain_crs:
            conflicts.append(
                ConflictNoticeItem(
                    code="CRS_UNCERTAIN",
                    severity="WARNING",
                    affected_attribute="coordinate_reference_system",
                    source_a="SOURCE_EVIDENCE",
                    recommendation="Source CRS differs from canonical analytical frame EPSG:32644. Verification required."
                )
            )

        # Underground Sensor Safety Assessment
        if is_underground:
            subsurface_sources = [
                s for s in evaluated_sources
                if SOURCE_CAPABILITIES.get(s.source_type, {}).get("supports_underground", False)
            ]
            lidar_only = len(evaluated_sources) > 0 and all(
                s.source_type in ("LIDAR_POINTCLOUD", "DRONE_PHOTOGRAMMETRY") for s in evaluated_sources
            )

            if lidar_only or len(subsurface_sources) == 0:
                warning_msg = (
                    "NO_UNDERGROUND_LIDAR_EVIDENCE: Airborne optical LiDAR and photogrammetry cannot detect subterranean geometry. "
                    "Subterranean units require plan-provided layout drawings, structural BIM/IFC models, or subsurface engineering surveys."
                )
                underground_warnings.append(warning_msg)
                conflicts.append(
                    ConflictNoticeItem(
                        code="UNDERGROUND_EVIDENCE_MISSING",
                        severity="ERROR" if len(subsurface_sources) == 0 else "WARNING",
                        affected_attribute="subterranean_geometry",
                        source_a="SOURCE_EVIDENCE",
                        recommendation="Attach plan-provided layout drawings or structural BIM/CAD models to support subterranean unit registration."
                    )
                )
                reviewer_attention.append("Underground unit lacks direct subterranean engineering evidence.")
            else:
                subsurface_names = ", ".join(s.source_type for s in subsurface_sources)
                underground_warnings.append(
                    f"Subterranean geometry supported by {subsurface_names}. Conforms with subsurface evidence safety protocol."
                )

        # Check 3D Topology Findings
        topology_summary_dict: Optional[Dict[str, Any]] = None
        if topology_report:
            topology_summary_dict = {
                "is_solid_valid": topology_report.solid_validation.is_valid,
                "is_watertight": topology_report.solid_validation.is_closed,
                "volume_cbm": topology_report.solid_validation.volume_cbm,
                "conflict_count": topology_report.conflict_count,
                "warning_count": topology_report.warning_count
            }

            for peer_rel in topology_report.peer_relationships:
                if peer_rel.severity == "ERROR":
                    conflicting_ulpin = (
                        peer_rel.unit_b_ulpin if peer_rel.unit_a_id == unit_id else peer_rel.unit_a_ulpin
                    )
                    conflicts.append(
                        ConflictNoticeItem(
                            code="TOPOLOGY_CONFLICT",
                            severity="ERROR",
                            affected_attribute="3d_topology",
                            source_a="SFCGAL_TOPOLOGY_ENGINE",
                            source_b=conflicting_ulpin,
                            measured_values={"overlap_volume_cbm": peer_rel.overlap_volume_cbm},
                            recommendation=f"Resolve 3D topological conflict: {peer_rel.description}"
                        )
                    )
                    reviewer_attention.append(f"Topology Error: {peer_rel.description}")


        # 7. Evaluate Decomposable Confidence Dimensions
        # Dimension 1: Source Presence
        source_count = len(evaluated_sources)
        if source_count == 0:
            src_presence_lvl: SourcePresenceLevel = "NONE"
            src_presence_reason = "No linked source evidence records found for this unit."
        elif source_count == 1:
            src_presence_lvl = "LIMITED"
            src_presence_reason = f"Single source evidence record ({evaluated_sources[0].source_type}) available."
        elif source_count == 2:
            src_presence_lvl = "ADEQUATE"
            src_presence_reason = f"Dual spatial sources available: {evaluated_sources[0].source_type} and {evaluated_sources[1].source_type}."
        else:
            src_presence_lvl = "MULTI_SOURCE"
            src_presence_reason = f"Multi-source evidence available across {source_count} distinct spatial datasets."

        # Dimension 2: Provenance Quality
        if source_count == 0:
            prov_dim_lvl: EvidenceDimensionLevel = "UNKNOWN"
            prov_dim_reason = "No source provenance records available for evaluation."
        else:
            prov_levels = [s.provenance_quality for s in evaluated_sources]
            if all(p == "HIGH" for p in prov_levels):
                prov_dim_lvl = "HIGH"
                prov_dim_reason = "All evidence sources possess documented SHA-256 source fingerprints used for provenance and reproducibility, explicit CRS, and high precision accuracy metrics."
            elif any(p == "HIGH" for p in prov_levels) and not any(p == "LOW" for p in prov_levels):
                prov_dim_lvl = "MEDIUM"
                prov_dim_reason = "Evidence possesses valid provenance lineage and documented geodetic reference frames."
            elif any(p == "LOW" for p in prov_levels):
                prov_dim_lvl = "LOW"
                prov_dim_reason = "One or more sources lack precise accuracy metadata or complete cryptographic fingerprints."
            else:
                prov_dim_lvl = "UNKNOWN"
                prov_dim_reason = "Accuracy metadata not explicitly documented in source headers."

        # Dimension 3: Geometry Support
        is_closed = bool(row.get("is_closed", False))
        volume = float(row.get("volume_cbm") or 0.0)
        if volume > 0 and is_closed:
            geom_dim_lvl: EvidenceDimensionLevel = "HIGH"
            geom_dim_reason = f"Watertight 2-manifold 3D solid geometry verified with positive volume ({volume:.2f} m³)."
        elif volume > 0:
            geom_dim_lvl = "MEDIUM"
            geom_dim_reason = f"Positive volume ({volume:.2f} m³) present but solid closure requires reviewer check."
        else:
            geom_dim_lvl = "LOW"
            geom_dim_reason = "Geometry is non-solid or zero volume."

        # Dimension 4: Vertical Support
        if any(c.code in ("HEIGHT_CONFLICT", "Z_RANGE_CONFLICT") and c.severity == "ERROR" for c in conflicts):
            vert_dim_lvl: EvidenceDimensionLevel = "LOW"
            vert_dim_reason = "Significant vertical height or elevation bracket discrepancy detected."
        elif any(comp.status == "MINOR_DISCREPANCY" for comp in comparisons):
            vert_dim_lvl = "MEDIUM"
            vert_dim_reason = "Vertical elevation bounds corroborated with minor measurement discrepancies."
        elif any(comp.status == "AGREEMENT" for comp in comparisons):
            vert_dim_lvl = "HIGH"
            vert_dim_reason = "Vertical floor height and elevation intervals agree across cross-source measurements."
        elif source_count > 0:
            vert_dim_lvl = "MEDIUM"
            vert_dim_reason = "Vertical extent is supported by the available source evidence; independent cross-source comparison is not available."
        else:
            vert_dim_lvl = "UNKNOWN"
            vert_dim_reason = "Insufficient evidence to corroborate vertical extent."

        # Dimension 5: Source Agreement
        if source_count <= 1 or len(comparisons) == 0:
            if source_count == 1:
                agree_dim_lvl: EvidenceDimensionLevel = "MEDIUM"
                agree_dim_reason = "Single evidence source available; independent cross-source comparison is not available."
            elif source_count == 0:
                agree_dim_lvl = "UNKNOWN"
                agree_dim_reason = "Zero evidence sources available to compare."
            else:
                agree_dim_lvl = "MEDIUM"
                agree_dim_reason = "Available sources provide complementary coverage without direct overlapping metric comparisons."
        else:
            has_conflicts = any(c.code in ("HEIGHT_CONFLICT", "FOOTPRINT_CONFLICT") for c in conflicts)
            has_discrepancies = any(comp.status == "MINOR_DISCREPANCY" for comp in comparisons)
            has_agreements = any(comp.status == "AGREEMENT" for comp in comparisons)

            if has_conflicts:
                agree_dim_lvl = "LOW"
                agree_dim_reason = "Measurement conflict detected between spatial evidence sources."
            elif has_discrepancies:
                agree_dim_lvl = "MEDIUM"
                agree_dim_reason = "Moderate measurement variation between sources within acceptable review bounds."
            elif has_agreements:
                agree_dim_lvl = "HIGH"
                agree_dim_reason = "Pairwise measurements demonstrate consistent horizontal and vertical agreement."
            else:
                agree_dim_lvl = "MEDIUM"
                agree_dim_reason = "Sources provide complementary spatial coverage without direct metric overlap."

        # Dimension 6: Evidence Completeness
        if source_count == 0:
            comp_dim_lvl: EvidenceDimensionLevel = "UNKNOWN"
            comp_dim_reason = "Evidence is missing."
        elif is_underground and (lidar_only or len(subsurface_sources) == 0):
            comp_dim_lvl = "LOW"
            comp_dim_reason = "Subterranean tier lacks requisite subsurface engineering or architectural drawing evidence."
        elif has_missing_provenance or has_uncertain_crs:
            comp_dim_lvl = "MEDIUM"
            comp_dim_reason = "Primary spatial geometry is present, but auxiliary metadata or CRS details are incomplete."
        else:
            comp_dim_lvl = "HIGH"
            comp_dim_reason = "Complete evidence package encompassing 3D footprint, elevation interval, and geodetic reference."

        # Dimension 7: Underground Safety
        if not is_underground:
            ug_safety_lvl: EvidenceDimensionLevel = "HIGH"
            ug_safety_reason = "Above-ground tier; standard aerial/sensor evidence rules apply."
        else:
            if lidar_only or len(subsurface_sources) == 0:
                ug_safety_lvl = "LOW"
                ug_safety_reason = "Subterranean unit cannot be established by airborne LiDAR alone (NO_UNDERGROUND_LIDAR_EVIDENCE)."
            else:
                ug_safety_lvl = "HIGH"
                ug_safety_reason = "Subterranean geometry supported by valid engineering / architectural drawing evidence."

        dimensions = EvidenceDimensionBreakdown(
            source_presence=src_presence_lvl,
            source_presence_reason=src_presence_reason,
            provenance_quality=prov_dim_lvl,
            provenance_quality_reason=prov_dim_reason,
            geometry_support=geom_dim_lvl,
            geometry_support_reason=geom_dim_reason,
            vertical_support=vert_dim_lvl,
            vertical_support_reason=vert_dim_reason,
            source_agreement=agree_dim_lvl,
            source_agreement_reason=agree_dim_reason,
            evidence_completeness=comp_dim_lvl,
            evidence_completeness_reason=comp_dim_reason,
            underground_safety=ug_safety_lvl,
            underground_safety_reason=ug_safety_reason
        )

        # 8. Deterministic Overall Confidence Synthesis
        has_error_conflicts = any(c.severity == "ERROR" for c in conflicts)
        
        if source_count == 0:
            overall_conf: EvidenceDimensionLevel = "UNKNOWN"
            overall_label = "UNKNOWN (Zero Evidence Records)"
        elif has_error_conflicts or (is_underground and ug_safety_lvl == "LOW"):
            overall_conf = "LOW"
            overall_label = "LOW (Requires Human Conflict Resolution)"
        elif (
            src_presence_lvl in ("ADEQUATE", "MULTI_SOURCE")
            and len(comparisons) > 0
            and any(comp.status == "AGREEMENT" for comp in comparisons)
            and not any(comp.status == "CONFLICT" for comp in comparisons)
            and prov_dim_lvl == "HIGH"
            and geom_dim_lvl == "HIGH"
            and vert_dim_lvl == "HIGH"
            and agree_dim_lvl == "HIGH"
            and not has_error_conflicts
        ):
            overall_conf = "HIGH"
            overall_label = "HIGH (Strong Multi-Source Corroboration)"
        else:
            overall_conf = "MEDIUM"
            overall_label = "MEDIUM (Adequate Supporting Evidence)"

        if not reviewer_attention:
            if overall_conf == "HIGH":
                reviewer_attention.append("Multi-source evidence consistent; proceed with standard visual verification.")
            elif overall_conf == "MEDIUM":
                reviewer_attention.append("Review single-source or auxiliary metadata before final verification.")
            else:
                reviewer_attention.append("Resolve flagged evidence conflicts or attach missing engineering documentation.")


        return UnitEvidenceFusionResponse(
            unit_id=row["id"],
            prototype_ulpin_3d=row["prototype_ulpin_3d"],
            status=row["status"],
            floor_code=row["floor_code"],
            tier_code=row["tier_code"],
            is_underground=is_underground,
            overall_confidence=overall_conf,
            overall_confidence_label=overall_label,
            dimensions=dimensions,
            sources=evaluated_sources,
            comparisons=comparisons,
            conflicts=conflicts,
            reviewer_attention=reviewer_attention,
            topology_summary=topology_summary_dict,
            underground_warnings=underground_warnings
        )
