"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.1: Human-in-the-Loop Review Workspace Service

Aggregates complete 3D property case files, combining PostGIS/SFCGAL solid geometry,
3D topology quality-control findings, multi-source evidence & provenance, explainable AI
candidate proposals, computational readiness checklists, and chronological audit history.
"""
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.models.entities import VerticalUnit, Parcel, Building, VerificationAudit
from backend.app.services.spatial_service import SpatialService
from backend.app.services.topology_service import TopologyService
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.responses import (
    UnitReviewCaseResponse,
    ReviewReadinessSummary,
    ReviewReadinessItem,
    AuditHistoryItem,
    UnitTopologyReportResponse,
    UnitEvidenceProvenanceResponse,
    AICandidateAnalysisResponse
)


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.spatial_service = SpatialService(db)
        self.topology_service = TopologyService(db)
        self.ai_service = AICandidateService(db)

    def get_review_case(self, unit_id: uuid.UUID) -> UnitReviewCaseResponse:
        """
        Aggregates a complete 3D Property Review Case dossier for authorized human review.
        """
        # 1. Fetch unit record
        unit_record = self.spatial_service.repo.get_vertical_unit_by_id(unit_id)
        if not unit_record:
            raise LookupError(f"Vertical unit with ID {unit_id} not found.")

        unit, ewkt_3d = unit_record

        # 2. Fetch parent parcel and building context
        parcel = self.db.query(Parcel).filter(Parcel.id == unit.parcel_id).first()
        parcel_ulpin = parcel.ulpin_2d if parcel else "UNKNOWN"

        building_name = None
        if unit.building_id:
            building = self.db.query(Building).filter(Building.id == unit.building_id).first()
            if building:
                building_name = building.building_name or building.building_code

        # 3. Fetch 3D Topology QC Report
        topology_report = self.topology_service.audit_unit_topology(unit_id)

        # 4. Fetch Multi-Source Evidence & Provenance
        evidence_report = self.spatial_service.get_unit_evidence_provenance(unit_id)

        # 5. Fetch Explainable AI Candidate Analysis (graceful fallback if not applicable)
        ai_analysis: Optional[AICandidateAnalysisResponse] = None
        try:
            ai_analysis = self.ai_service.analyze_vertical_unit(unit_id)
        except Exception:
            ai_analysis = None

        # 6. Fetch Complete Chronological Audit History
        audits = (
            self.db.query(VerificationAudit)
            .filter(VerificationAudit.unit_id == unit_id)
            .order_by(VerificationAudit.timestamp.asc())
            .all()
        )
        audit_history: List[AuditHistoryItem] = [
            AuditHistoryItem(
                id=a.id,
                action=a.action,
                previous_status=a.previous_status,
                new_status=a.new_status,
                actor_role=a.reviewer_role,
                reviewer_name=a.reviewer_name,
                review_notes=a.review_notes,
                integrity_hash=a.integrity_hash,
                timestamp=a.timestamp
            )
            for a in audits
        ]

        # 7. Compute Computational Review Readiness Checklist
        readiness_items: List[ReviewReadinessItem] = []
        
        # Check 1: Solid Watertightness
        is_solid_valid = topology_report.solid_validation.is_valid
        readiness_items.append(
            ReviewReadinessItem(
                code="SOLID_WATERTIGHTNESS",
                label="3D B-Rep Solid Geometry",
                passed=is_solid_valid,
                severity="INFO" if is_solid_valid else "ERROR",
                message=topology_report.solid_validation.details
            )
        )

        # Check 2: Positive Volume
        vol = topology_report.solid_validation.volume_cbm
        vol_passed = vol > 0.0001
        readiness_items.append(
            ReviewReadinessItem(
                code="POSITIVE_VOLUME",
                label="Positive Interior Volume",
                passed=vol_passed,
                severity="INFO" if vol_passed else "ERROR",
                message=f"Verified positive volume of {vol:.2f} m³." if vol_passed else "Non-positive or degenerate volume detected."
            )
        )

        # Check 3: Parcel Footprint Containment
        is_contained = topology_report.containment.is_within_parcel
        readiness_items.append(
            ReviewReadinessItem(
                code="PARCEL_CONTAINMENT",
                label="Parent Parcel Footprint Containment",
                passed=is_contained,
                severity="INFO" if is_contained else "ERROR",
                message=topology_report.containment.message
            )
        )

        # Check 4: 3D Spatial Collisions
        conflict_free = topology_report.conflict_count == 0
        readiness_items.append(
            ReviewReadinessItem(
                code="TOPOLOGY_COLLISION",
                label="3D Spatial Overlap Conflict Audit",
                passed=conflict_free,
                severity="INFO" if conflict_free else "ERROR",
                message="Zero positive-volume spatial collisions with peer units." if conflict_free else f"{topology_report.conflict_count} unresolved 3D volumetric collision(s) detected."
            )
        )

        # Check 5: Supporting Evidence
        has_evidence = len(evidence_report.evidence_records) > 0
        readiness_items.append(
            ReviewReadinessItem(
                code="EVIDENCE_ATTACHED",
                label="Supporting Source Evidence",
                passed=has_evidence,
                severity="INFO" if has_evidence else "WARNING",
                message=f"{len(evidence_report.evidence_records)} multi-source evidence dataset(s) linked to unit." if has_evidence else "No supporting evidence records linked."
            )
        )

        # Check 6: Subsurface Supporting Evidence (for underground/utility units)
        if unit.tier_code in ("SB", "UT") or float(unit.z_max) <= 0.0:
            has_subsurface_ev = False
            for ev in evidence_report.evidence_records:
                src = (ev.source_type or "").upper()
                if any(k in src for k in ("BIM", "CAD", "BLUEPRINT", "ARCHITECTURAL", "RADAR", "GPR", "SURVEY", "DOCUMENT")):
                    has_subsurface_ev = True
                    break
            
            if not has_subsurface_ev and ai_analysis and isinstance(ai_analysis.underground_safety, dict):
                has_subsurface_ev = ai_analysis.underground_safety.get("is_safe", False)

            readiness_items.append(
                ReviewReadinessItem(
                    code="UNDERGROUND_EVIDENCE",
                    label="Subsurface Supporting Evidence",
                    passed=has_subsurface_ev,
                    severity="INFO" if has_subsurface_ev else "WARNING",
                    message=(
                        "Suitable supporting subsurface evidence (BIM/CAD/architectural/subsurface survey) is available."
                        if has_subsurface_ev
                        else "Suitable subsurface supporting evidence is incomplete or unavailable. Subsurface geometry cannot rely on optical airborne LiDAR alone."
                    )
                )
            )

        # Check 7: AI Proposal Consistency (Advisory)
        if ai_analysis:
            ai_score = ai_analysis.confidence_score
            ai_passed = ai_score >= 0.60
            readiness_items.append(
                ReviewReadinessItem(
                    code="AI_PROPOSAL_ADVISORY",
                    label="AI Proposal Consistency (Advisory)",
                    passed=ai_passed,
                    severity="INFO" if ai_passed else "WARNING",
                    message=(
                        f"AI proposal heuristic confidence score: {ai_score:.2f} ({ai_analysis.confidence}). Non-authoritative advisory context."
                        if ai_passed
                        else f"AI proposal confidence is low ({ai_score:.2f}). Non-authoritative advisory context; verify independently."
                    )
                )
            )

        # Overall readiness classification
        err_count = sum(1 for item in readiness_items if item.severity == "ERROR")
        warn_count = sum(1 for item in readiness_items if item.severity == "WARNING")
        pass_count = sum(1 for item in readiness_items if item.passed)

        if not is_solid_valid:
            overall_readiness = "BLOCKED_INVALID_GEOMETRY"
        elif err_count > 0 or warn_count > 0:
            overall_readiness = "REVIEW_REQUIRES_ATTENTION"
        else:
            overall_readiness = "READY_FOR_HUMAN_REVIEW"

        readiness = ReviewReadinessSummary(
            overall_readiness=overall_readiness,
            passed_count=pass_count,
            warning_count=warn_count,
            error_count=err_count,
            items=readiness_items
        )

        # 8. Determine Available State Machine Actions
        current_status = unit.status.name if hasattr(unit.status, "name") else str(unit.status)
        if current_status == "PROPOSED":
            available_actions = ["START_REVIEW"]
        elif current_status == "UNDER_REVIEW":
            available_actions = ["VERIFY", "REJECT"]
        else:
            available_actions = []

        return UnitReviewCaseResponse(
            unit_id=unit.id,
            prototype_ulpin_3d=unit.prototype_ulpin_3d,
            parcel_id=unit.parcel_id,
            parcel_ulpin_2d=parcel_ulpin,
            building_id=unit.building_id,
            building_name=building_name,
            tier_code=unit.tier_code,
            floor_code=unit.floor_code,
            unit_label=unit.unit_label,
            unit_type=unit.unit_type,
            status=current_status,
            z_min=float(unit.z_min),
            z_max=float(unit.z_max),
            height_m=round(float(unit.z_max) - float(unit.z_min), 2),
            volume_cbm=round(vol, 2),
            ewkt_3d=ewkt_3d,
            topology=topology_report,
            evidence=evidence_report,
            ai_analysis=ai_analysis,
            readiness=readiness,
            audit_history=audit_history,
            available_actions=available_actions
        )
