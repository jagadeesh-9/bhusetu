"""
SIH26011 Phase 5: Test Suite for Drone Survey / Survey Data Workspace.
Verifies multi-image survey evidence ingestion, 8-point quality check audit,
statutory limitation notices, provenance matrix, and direct AI Image -> 3D handoff.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.drone_survey import (
    DroneSurveyAnalysisRequest,
    DroneSurveyAnalysisResponse,
    DroneSurveyImageItem,
    DroneSurveyMetadata
)
from backend.app.services.drone_survey_service import DroneSurveyService

client = TestClient(app)

# Lightweight synthetic base64 image (1x1 PNG)
DUMMY_PNG_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_01_valid_multi_image_drone_survey_analysis():
    """Verifies successful analysis of a multi-view drone survey mission."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="DJI_001_NADIR.JPG",
                view_type="TOP",
                flight_altitude_m=50.0,
                has_geotag=True,
                latitude=17.4435,
                longitude=78.3772
            ),
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="DJI_002_OBLIQUE_SOUTH.JPG",
                view_type="FRONT",
                flight_altitude_m=45.0,
                has_geotag=True,
                latitude=17.4430,
                longitude=78.3772
            ),
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="DJI_003_OBLIQUE_WEST.JPG",
                view_type="SIDE",
                flight_altitude_m=45.0,
                has_geotag=True,
                latitude=17.4435,
                longitude=78.3768
            )
        ],
        metadata=DroneSurveyMetadata(
            survey_id="SRV-2026-HYD-001",
            capture_date="2026-09-17",
            operator_agency="Telangana Geospatial Survey Directorate",
            camera_source="DJI Zenmuse P1 (45MP Full-Frame)",
            approx_area_sqm=1850.0,
            crs="EPSG:32644",
            ground_control_available=True,
            gcp_count=6,
            has_point_cloud=True,
            point_cloud_ref="prototype_tower_a.las"
        )
    )

    res: DroneSurveyAnalysisResponse = service.analyze_drone_survey(req)

    assert res.survey_id == "SRV-2026-HYD-001"
    assert res.image_count == 3
    assert len(res.quality_checks) == 8
    assert len(res.derived_products) >= 4
    assert len(res.provenance_matrix) >= 5

    # Check statutory disclaimers
    assert "Underground geometry requires survey, CAD/BIM" in res.underground_limitation_notice
    assert "not survey-grade cadastral evidence" in res.cadastral_legal_notice
    assert "Point-cloud processing input supported by the architecture" in res.point_cloud_support_notice


def test_02_metadata_graceful_defaults():
    """Verifies that missing mission metadata is handled gracefully without errors."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="drone_uncalibrated_01.jpg",
                view_type="UNSPECIFIED"
            )
        ],
        metadata=None
    )

    res = service.analyze_drone_survey(req)

    assert res.survey_id.startswith("SRV-DRONE-")
    assert res.image_count == 1
    assert res.survey_coverage_metadata["crs"] == "EPSG:32644"
    assert res.survey_coverage_metadata["ground_control_available"] is False


def test_03_quality_checklist_classification():
    """Verifies all 8 quality checkpoints classify accurately with discrete statuses."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="drone_single.png",
                view_type="UNSPECIFIED",
                has_geotag=False
            )
        ],
        metadata=DroneSurveyMetadata(
            ground_control_available=False,
            has_point_cloud=False
        )
    )

    res = service.analyze_drone_survey(req)
    checks_by_name = {c.check_name: c for c in res.quality_checks}

    assert checks_by_name["Image Availability"].status == "AVAILABLE"
    assert checks_by_name["Image Format & Integrity"].status == "AVAILABLE"
    assert checks_by_name["Sensor Resolution / GSD"].status == "ESTIMATED"
    assert checks_by_name["Geotag Availability"].status == "NOT_PROVIDED"
    assert checks_by_name["Ground Control Points (GCP)"].status == "NOT_PROVIDED"
    assert checks_by_name["Coordinate Reference System"].status == "AVAILABLE"


def test_04_downstream_ai_handoff_payload_compatibility():
    """Verifies that handoff_payload directly matches BuildingImageReconstructionRequest schema."""
    service = DroneSurveyService()
    parcel_uuid = uuid.uuid4()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="drone_front.png",
                view_type="FRONT"
            ),
            DroneSurveyImageItem(
                image_base64=DUMMY_PNG_B64,
                filename="drone_side.png",
                view_type="SIDE"
            )
        ],
        metadata=DroneSurveyMetadata(
            survey_id="DEMO-MISSION-01",
            operator_agency="DEMO Cadastral Flight"
        ),
        parcel_id=parcel_uuid
    )

    res = service.analyze_drone_survey(req)

    handoff = res.handoff_payload
    assert handoff.parcel_id == parcel_uuid
    assert len(handoff.images) == 2
    assert handoff.images[0].view_type == "FRONT"
    assert handoff.images[1].view_type == "SIDE"
    assert handoff.ground_z_override == 540.0
    assert "DEMO-MISSION-01" in handoff.building_name_hint
    assert handoff.has_basement_hint is True


def test_05_missing_images_rejection():
    """Verifies HTTP 422 when no survey images are provided."""
    with pytest.raises(Exception):
        DroneSurveyAnalysisRequest(images=[])


def test_06_rest_api_endpoint():
    """Verifies POST /api/survey/drone/analyze via FastAPI TestClient."""
    payload = {
        "images": [
            {
                "image_base64": DUMMY_PNG_B64,
                "filename": "DJI_0088.JPG",
                "view_type": "TOP",
                "flight_altitude_m": 60.0,
                "has_geotag": True,
                "latitude": 17.4435,
                "longitude": 78.3772
            }
        ],
        "metadata": {
            "survey_id": "SRV-TEST-API-01",
            "capture_date": "2026-09-17",
            "operator_agency": "Drone Survey Unit",
            "crs": "EPSG:32644",
            "ground_control_available": True,
            "gcp_count": 4,
            "has_point_cloud": False
        }
    }

    response = client.post("/api/survey/drone/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["survey_id"] == "SRV-TEST-API-01"
    assert data["image_count"] == 1
    assert "handoff_payload" in data
    assert len(data["quality_checks"]) == 8
    assert "underground_limitation_notice" in data


def test_07_point_cloud_support_not_faked():
    """Verifies that point-cloud status is accurately declared as NOT_PROVIDED when absent."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(image_base64=DUMMY_PNG_B64, filename="aerial.jpg")
        ],
        metadata=DroneSurveyMetadata(has_point_cloud=False)
    )
    res = service.analyze_drone_survey(req)
    pc_product = next(p for p in res.derived_products if p.product_type == "POINT_CLOUD")
    assert pc_product.status == "NOT_PROVIDED"
    assert "Point-cloud processing input supported by the architecture" in pc_product.notes


def test_08_dem_ground_z_classified_as_reference_no_amsl():
    """Verifies DEM-derived Ground-Z is classified as REFERENCE and never labeled AMSL."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(image_base64=DUMMY_PNG_B64, filename="demo_01.jpg", view_type="FRONT")
        ],
        metadata=DroneSurveyMetadata(
            survey_id="DEMO-MISSION-01",
            operator_agency="DEMO Drone Unit"
        )
    )
    res = service.analyze_drone_survey(req)

    # 1. Classification must be REFERENCE
    dem_prod = next(p for p in res.derived_products if p.product_type == "DEM_DATUM")
    assert dem_prod.provenance == "REFERENCE"
    assert dem_prod.product_name == "Prototype Vertical Elevation Reference"
    assert dem_prod.resolution_or_spec == "Ground Z: 540.0 m"
    assert "Source: DEM-derived prototype reference" in dem_prod.notes

    # 2. Must NOT be labeled AMSL anywhere
    dump_str = res.model_dump_json()
    assert "AMSL" not in dump_str
    assert "MSL" not in dump_str


def test_09_hardcoded_540_not_used_as_universal_fallback():
    """Verifies that non-demo survey without elevation source returns explicit unavailable state instead of 540.0."""
    service = DroneSurveyService()
    req = DroneSurveyAnalysisRequest(
        images=[
            DroneSurveyImageItem(image_base64=DUMMY_PNG_B64, filename="custom_flight_01.jpg", view_type="FRONT")
        ],
        metadata=DroneSurveyMetadata(
            survey_id="SRV-REAL-MISSION-09",
            operator_agency="Commercial Drone Operator"
        ),
        parcel_id=None
    )
    res = service.analyze_drone_survey(req)

    # Must NOT invent 540.0
    assert res.survey_coverage_metadata["ground_elevation_datum_m"] is None
    assert res.handoff_payload.ground_z_override is None

    dem_prod = next(p for p in res.derived_products if p.product_type == "DEM_DATUM")
    assert dem_prod.status == "NOT_PROVIDED"
    assert "Ground Z unavailable — authoritative/reference elevation required" in dem_prod.resolution_or_spec

    # Must produce explicit advisory warning
    assert any("Ground Z unavailable — authoritative/reference elevation required" in w for w in res.warnings)

