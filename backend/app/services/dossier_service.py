"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.6D: Prototype Technical Review Dossier Service

Orchestrates and aggregates existing authoritative services (Spatial, Topology,
Evidence Fusion, AI Candidate Analysis, Review/Audit History) to produce a
consolidated, explainable, read-only Technical Review Dossier.
"""
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models.entities import VerticalUnit, Parcel, Building, SourceEvidence, VerificationAudit
from backend.app.services.spatial_service import SpatialService
from backend.app.services.topology_service import TopologyService
from backend.app.services.evidence_fusion_service import EvidenceFusionService
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.services.review_service import ReviewService
from backend.app.services.decomposition_service import classify_vertical_taxonomy
from backend.app.schemas.dossier import (
    PrototypeTechnicalReviewDossier,
    DossierParcelContext,
    DossierBuildingContext,
    DossierUnitIdentity,
    DossierGeometrySummary,
    DossierEvidenceItem,
    DossierSourceEvidenceSection,
    DossierLifecycleSection,
    DossierAIContextSection
)


class DossierService:
    """
    Read-only service compiling authoritative technical dossiers for 3D vertical units.
    Does not perform any INSERT, UPDATE, or DELETE operations.
    """

    def __init__(self, db: Session):
        self.db = db
        self.spatial_service = SpatialService(db)
        self.topology_service = TopologyService(db)
        self.evidence_fusion_service = EvidenceFusionService(db)
        self.ai_service = AICandidateService(db)
        self.review_service = ReviewService(db)

    def generate_dossier(self, unit_id: uuid.UUID) -> PrototypeTechnicalReviewDossier:
        """
        Generates a consolidated Prototype Technical Review Dossier for the given vertical unit.
        """
        # 1. Fetch unit record
        unit_record = self.spatial_service.repo.get_vertical_unit_by_id(unit_id)
        if not unit_record:
            raise LookupError(f"Vertical unit with ID {unit_id} not found.")

        unit, ewkt_3d = unit_record

        # 2. Fetch parent parcel and building context
        parcel = self.db.query(Parcel).filter(Parcel.id == unit.parcel_id).first()
        if not parcel:
            raise LookupError(f"Parent parcel for unit {unit_id} not found.")

        parcel_context = DossierParcelContext(
            id=parcel.id,
            ulpin_2d=parcel.ulpin_2d,
            survey_number=parcel.survey_number,
            district=parcel.district,
            state=parcel.state,
            village_code=parcel.village_code,
            area_sqm=float(parcel.area_sqm)
        )

        building_context = DossierBuildingContext()
        if unit.building_id:
            building = self.db.query(Building).filter(Building.id == unit.building_id).first()
            if building:
                building_context = DossierBuildingContext(
                    id=building.id,
                    building_code=building.building_code,
                    building_name=building.building_name,
                    total_floors_above=building.total_floors_above,
                    total_floors_below=building.total_floors_below
                )

        # 3. Unit Identity
        current_status = unit.status.name if hasattr(unit.status, "name") else str(unit.status)
        unit_identity = DossierUnitIdentity(
            id=unit.id,
            prototype_ulpin_3d=unit.prototype_ulpin_3d,
            tier_code=unit.tier_code,
            floor_code=unit.floor_code,
            unit_sequence=unit.unit_sequence,
            unit_label=unit.unit_label,
            unit_type=unit.unit_type,
            status=current_status
        )

        # 4. Fetch Authoritative Subsystem Findings
        # Topology
        topology_report = self.topology_service.audit_unit_topology(unit_id)
        # Evidence & Provenance
        evidence_provenance = self.spatial_service.get_unit_evidence_provenance(unit_id)
        # Evidence Fusion
        fusion_report = self.evidence_fusion_service.fuse_unit_evidence(unit_id)
        # Review Case (Readiness & Audit History)
        review_case = self.review_service.get_review_case(unit_id)
        # Taxonomy Classification
        taxonomy = classify_vertical_taxonomy(unit.tier_code, unit.unit_type, unit.floor_code, unit.unit_label)

        # AI Analysis (Optional with graceful fallback)
        ai_analysis = None
        try:
            ai_analysis = self.ai_service.analyze_vertical_unit(unit_id)
        except Exception:
            ai_analysis = None

        ai_context = DossierAIContextSection(
            has_analysis=ai_analysis is not None,
            analysis=ai_analysis
        )

        # 5. Geometry Summary
        z_min_val = float(unit.z_min)
        z_max_val = float(unit.z_max)
        modeled_height = round(z_max_val - z_min_val, 2)
        vol = topology_report.solid_validation.volume_cbm

        geometry_summary = DossierGeometrySummary(
            crs="EPSG:32644 (WGS 84 / UTM Zone 44N)",
            srid=32644,
            z_min=z_min_val,
            z_max=z_max_val,
            modeled_vertical_height_m=modeled_height,
            volume_cbm=round(vol, 2),
            is_closed=topology_report.solid_validation.is_closed,
            is_solid=topology_report.solid_validation.is_solid,
            is_within_parcel=topology_report.containment.is_within_parcel
        )

        # 6. Source Evidence Section
        evidence_items: List[DossierEvidenceItem] = []
        for ev in evidence_provenance.evidence_records:
            # Determine sensor capability notice
            src_upper = (ev.source_type or "").upper()
            sensor_notice = None
            if "LIDAR" in src_upper:
                sensor_notice = (
                    "LiDAR evidence available to this prototype does not by itself establish underground geometry."
                )
            elif unit.tier_code in ("SB", "UT"):
                sensor_notice = (
                    "Suitable engineering/survey evidence should be independently reviewed for subterranean structures."
                )

            # Check if SHA-256 fingerprint is in metadata
            sha256_fp = None
            if ev.metadata_json and isinstance(ev.metadata_json, dict):
                sha256_fp = (
                    ev.metadata_json.get("sha256_hash")
                    or ev.metadata_json.get("fingerprint_sha256")
                    or ev.metadata_json.get("source_hash")
                )

            evidence_items.append(
                DossierEvidenceItem(
                    id=ev.id,
                    source_type=ev.source_type,
                    dataset_name=ev.dataset_name,
                    file_uri=ev.file_uri,
                    accuracy_horizontal_m=ev.accuracy_horizontal_m,
                    accuracy_vertical_m=ev.accuracy_vertical_m,
                    sensor_category=ev.sensor_category,
                    is_synthetic=ev.is_synthetic,
                    assessment_level=ev.assessment_level,
                    assessment_rationale=ev.assessment_rationale,
                    geometry_status="UNAVAILABLE",
                    geometry_notice="Source geometry unavailable — metadata/provenance only.",
                    sensor_capability_notice=sensor_notice,
                    sha256_fingerprint=sha256_fp,
                    fingerprint_notice="SHA-256 source fingerprint used for provenance and reproducibility.",
                    metadata_json=ev.metadata_json,
                    created_at=ev.created_at
                )
            )

        source_evidence_section = DossierSourceEvidenceSection(
            evidence_count=len(evidence_items),
            evidence_records=evidence_items,
            provenance_pipeline=evidence_provenance.provenance_pipeline
        )

        # 7. Lifecycle Section
        lifecycle_section = DossierLifecycleSection(
            current_status=current_status,
            overall_readiness=review_case.readiness.overall_readiness,
            passed_count=review_case.readiness.passed_count,
            warning_count=review_case.readiness.warning_count,
            error_count=review_case.readiness.error_count,
            readiness_items=review_case.readiness.items
        )

        # 8. Standardized Limitations
        limitations = [
            "Research Prototype: This dossier is generated by a research prototype system and does not constitute a statutory cadastral record, title certificate, or legal ownership deed.",
            "Prototype Identifier: The Prototype 3D Unit ID is an experimental spatial reference used for research and is not an officially adopted government 3D cadastral identifier.",
            "Metadata-Only Evidence: Source evidence records represent technical ingestion metadata and lineage; raw source geometries (LiDAR points, BIM meshes) are not co-persisted in this prototype.",
            "Discrepancy Spatial Non-Localization: Discrepancy notices indicate metric variances between source attributes; exact spatial fault boundaries cannot be highlighted in 3D without stored source geometry meshes.",
            "Sensor Scope & Subsurface Limits: LiDAR evidence available to this prototype does not by itself establish underground geometry. Subterranean units require independent engineering/survey review.",
            "Polyhedral Boundary Approximation: 3D solids are faceted PolyhedralSurface representations; Modeled Vertical Height represents bounding elevation interval (Zmax - Zmin) and not architectural clear height.",
            "Horizontal Footprint Containment: Parcel containment checks verify 2D polygon footprint inclusion and do not constitute a complete 3D legal air-rights or subsurface easement determination.",
            "Human Governance Requirement: AI candidate proposals and automated readiness checks are non-authoritative advisory aids. Official verification remains strictly restricted to authorized human review roles."
        ]

        # 9. Assemble and Return Dossier
        return PrototypeTechnicalReviewDossier(
            dossier_version="3.6D-PROTOTYPE",
            generated_at=datetime.utcnow(),
            parcel=parcel_context,
            building=building_context,
            unit_identity=unit_identity,
            geometry_summary=geometry_summary,
            taxonomy=taxonomy,
            lifecycle=lifecycle_section,
            source_evidence=source_evidence_section,
            evidence_fusion=fusion_report,
            topology=topology_report,
            ai_context=ai_context,
            review_history=review_case.audit_history,
            limitations=limitations
        )
