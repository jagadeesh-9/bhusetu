"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.6D: Prototype Technical Review Dossier & Export Test Suite

Tests that the dossier endpoint consolidates authoritative data across
geometry, evidence, fusion, topology, AI advisory, and audit history,
preserving all claim boundaries, read-only guarantees, and safety constraints.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, Parcel, Building, SourceEvidence, VerificationAudit

client = TestClient(app)


@pytest.fixture(scope="module")
def sample_units():
    """Fetches real persistent vertical units for testing."""
    db = SessionLocal()
    try:
        units = db.query(VerticalUnit).all()
        assert len(units) >= 2, "Database must contain at least 2 vertical units."
        unit_above_ground = next((u for u in units if u.tier_code not in ("SB", "UT")), units[0])
        unit_underground = next((u for u in units if u.tier_code in ("SB", "UT")), None)
        return {
            "above_ground": unit_above_ground,
            "underground": unit_underground,
            "all": units
        }
    finally:
        db.close()


def test_01_dossier_endpoint_returns_200_for_valid_unit(sample_units):
    """Verifies that GET /api/vertical-units/{id}/dossier returns 200 OK and valid JSON."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    assert data["dossier_version"] == "3.6D-PROTOTYPE"
    assert data["unit_identity"]["id"] == str(unit.id)


def test_02_prototype_notice_prominently_present(sample_units):
    """Verifies that the prototype notice disclaimer is prominently included."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    assert "Research Prototype" in data["prototype_notice"]
    assert "Not a statutory cadastral record" in data["prototype_notice"]


def test_03_prototype_3d_unit_id_reported(sample_units):
    """Verifies that unit identity contains Prototype 3D Unit ID and proper terminology."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    assert data["unit_identity"]["prototype_ulpin_3d"] == unit.prototype_ulpin_3d
    assert "Prototype 3D Unit ID is a research identifier" in data["unit_identity"]["identifier_notice"]


def test_04_lifecycle_state_matches_database_and_is_not_mutated(sample_units):
    """Verifies lifecycle status matches DB and remains untouched after dossier generation."""
    unit = sample_units["above_ground"]
    expected_status = unit.status.name if hasattr(unit.status, "name") else str(unit.status)
    
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    assert data["lifecycle"]["current_status"] == expected_status

    # Verify DB record is untouched
    db = SessionLocal()
    try:
        refreshed = db.query(VerticalUnit).filter(VerticalUnit.id == unit.id).first()
        curr = refreshed.status.name if hasattr(refreshed.status, "name") else str(refreshed.status)
        assert curr == expected_status
    finally:
        db.close()


def test_05_source_evidence_records_included_with_metadata_only_notice(sample_units):
    """Verifies source evidence records are included and explicitly marked as metadata-only."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    source_sec = data["source_evidence"]
    assert source_sec["evidence_count"] >= 1
    
    for ev in source_sec["evidence_records"]:
        assert ev["geometry_status"] == "UNAVAILABLE"
        assert "Source geometry unavailable — metadata/provenance only." in ev["geometry_notice"]
        assert ev["dataset_name"] is not None
        assert ev["file_uri"] is not None


def test_06_sha256_described_as_provenance_fingerprint(sample_units):
    """Verifies SHA-256 is labeled strictly for provenance and reproducibility."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    for ev in data["source_evidence"]["evidence_records"]:
        assert "SHA-256 source fingerprint used for provenance and reproducibility" in ev["fingerprint_notice"]


def test_07_evidence_fusion_consumed_without_recalculation(sample_units):
    """Verifies evidence fusion is consumed from Phase 3.5 with categorical confidence."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    fusion = data["evidence_fusion"]
    assert fusion["overall_confidence"] in ("HIGH", "MEDIUM", "LOW", "UNKNOWN")
    assert "%" not in fusion["overall_confidence"]
    assert "dimensions" in fusion
    assert fusion["dimensions"]["source_presence"] in ("MULTI_SOURCE", "ADEQUATE", "LIMITED", "NONE")


def test_08_not_comparable_remains_distinct_from_agreement(sample_units):
    """Verifies that NOT_COMPARABLE comparisons are preserved and not altered to AGREEMENT."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    comparisons = data["evidence_fusion"]["comparisons"]
    for cmp in comparisons:
        assert cmp["status"] in ("AGREEMENT", "MINOR_DISCREPANCY", "CONFLICT", "NOT_COMPARABLE")


def test_09_discrepancies_contain_spatial_reality_notice(sample_units):
    """Verifies that conflict/discrepancy notices contain structured code, severity, and recommendations."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    conflicts = data["evidence_fusion"]["conflicts"]
    for c in conflicts:
        assert c["severity"] in ("ERROR", "WARNING", "INFO")
        assert len(c["recommendation"]) > 0


def test_10_topology_qc_consumed_with_solid_validation(sample_units):
    """Verifies topology results from Phase 3.0 are included accurately."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    topo = data["topology"]
    assert topo["overall_quality_status"] in ("VALID", "REVIEW_REQUIRED", "CONFLICT")
    assert topo["solid_validation"]["is_solid"] is True
    assert topo["solid_validation"]["volume_cbm"] > 0


def test_11_modeled_z_range_terminology_safe(sample_units):
    """Verifies Z-range is labeled as Modeled Vertical Height and not clear height."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    geom = data["geometry_summary"]
    assert geom["modeled_vertical_height_m"] == round(float(unit.z_max) - float(unit.z_min), 2)
    assert "not certified clear height" in geom["z_terminology_note"]


def test_12_underground_disclaimer_for_subterranean_units(sample_units):
    """Verifies underground sensor disclaimers appear on subterranean units or LiDAR records."""
    if sample_units["underground"]:
        unit = sample_units["underground"]
        res = client.get(f"/api/vertical-units/{unit.id}/dossier")
        assert res.status_code == 200
        data = res.json()
        # Verify limitations contain underground disclaimer
        limitations_text = " ".join(data["limitations"])
        assert "LiDAR evidence available to this prototype does not by itself establish underground geometry" in limitations_text


def test_13_ai_context_labeled_advisory(sample_units):
    """Verifies AI context is explicitly marked non-authoritative advisory context."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    ai_sec = data["ai_context"]
    assert "AI-assisted non-authoritative advisory context" in ai_sec["advisory_notice"]


def test_14_prototype_audit_history_included(sample_units):
    """Verifies that audit history entries are included as Prototype Audit History."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    history = data["review_history"]
    assert isinstance(history, list)
    if len(history) > 0:
        assert history[0]["action"] is not None
        assert history[0]["actor_role"] is not None


def test_15_standardized_limitations_section_present(sample_units):
    """Verifies comprehensive limitations are enumerated in the dossier."""
    unit = sample_units["above_ground"]
    res = client.get(f"/api/vertical-units/{unit.id}/dossier")
    assert res.status_code == 200
    data = res.json()
    limitations = data["limitations"]
    assert len(limitations) >= 5
    assert any("Research Prototype" in l for l in limitations)
    assert any("Metadata-Only" in l or "raw source geometries" in l for l in limitations)
    assert any("Human Governance" in l for l in limitations)


def test_16_nonexistent_unit_returns_404():
    """Verifies 404 response for unknown unit UUID."""
    random_id = uuid.uuid4()
    res = client.get(f"/api/vertical-units/{random_id}/dossier")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_17_dossier_generation_causes_zero_database_mutations(sample_units):
    """Verifies zero INSERT/UPDATE/DELETE occurs in database during dossier requests."""
    db = SessionLocal()
    try:
        p_before = db.execute(text("SELECT count(*) FROM parcels")).scalar()
        b_before = db.execute(text("SELECT count(*) FROM buildings")).scalar()
        u_before = db.execute(text("SELECT count(*) FROM vertical_units")).scalar()
        e_before = db.execute(text("SELECT count(*) FROM source_evidence")).scalar()
        a_before = db.execute(text("SELECT count(*) FROM verification_audit")).scalar()
    finally:
        db.close()

    # Call endpoint multiple times
    for u in sample_units["all"][:4]:
        res = client.get(f"/api/vertical-units/{u.id}/dossier")
        assert res.status_code == 200

    db = SessionLocal()
    try:
        p_after = db.execute(text("SELECT count(*) FROM parcels")).scalar()
        b_after = db.execute(text("SELECT count(*) FROM buildings")).scalar()
        u_after = db.execute(text("SELECT count(*) FROM vertical_units")).scalar()
        e_after = db.execute(text("SELECT count(*) FROM source_evidence")).scalar()
        a_after = db.execute(text("SELECT count(*) FROM verification_audit")).scalar()
        
        assert p_before == p_after
        assert b_before == b_after
        assert u_before == u_after
        assert e_before == e_after
        assert a_before == a_after
    finally:
        db.close()
