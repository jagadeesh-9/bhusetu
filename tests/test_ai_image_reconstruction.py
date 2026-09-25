"""
SIH26011 Phase 2 Test Suite: AI-Assisted Building Image -> 3D Reconstruction
Validates:
1. Valid multi-view photographic reconstruction (Front, Side, Top views).
2. Valid single-image reconstruction with single-view limitation warning.
3. Transparent provenance taxonomy (OBSERVED, ESTIMATED, REFERENCE, PROPOSED).
4. Strictly PROPOSED lifecycle status and mandatory human verification flag.
5. Watertight PolyhedralSurface Z 3D solid geometry generation.
6. Pipeline feed payload matches BuildingPrototypeGenerationRequest schema.
7. Input validation: missing images, empty payloads, and invalid base64 rejected with 422.
8. REST API endpoint POST /api/ai/building/reconstruct responds with 200 OK.
"""
import base64
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.image_reconstruction_service import ImageReconstructionService
from backend.app.schemas.ai_image_reconstruction import (
    BuildingImageReconstructionRequest,
    BuildingImageViewItem
)

client = TestClient(app)

# 1x1 transparent PNG sample for tests
DUMMY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

# 200x150 simulated PNG sample header
SAMPLE_IMAGE_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAACWCAYAAAC8wN4QAAAACXBIWXMAAAsTAAALEwEAmpwY"
    "AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAuSURBVHgB7cExAQAAAMKg9U9tDQ8gAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAA8GE2/QABiQpLSwAAAABJRU5ErkJggg=="
)


def test_01_multiview_reconstruction_success():
    """Validates multi-view (Front + Side + Top) photographic reconstruction."""
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(
                image_base64=SAMPLE_IMAGE_B64,
                view_type="FRONT",
                filename="front_facade.png"
            ),
            BuildingImageViewItem(
                image_base64=SAMPLE_IMAGE_B64,
                view_type="SIDE",
                filename="side_elevation.png"
            ),
            BuildingImageViewItem(
                image_base64=SAMPLE_IMAGE_B64,
                view_type="TOP",
                filename="roof_plan.png"
            )
        ],
        building_name_hint="Surya Heights West Block",
        floor_height_prior_m=3.0,
        has_basement_hint=True
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.building_detected is True
    assert res.status == "PROPOSED"
    assert res.human_verification_required is True
    assert res.is_single_view is False
    assert len(res.views_analyzed) == 3
    assert "FRONT" in res.views_analyzed
    assert "SIDE" in res.views_analyzed
    assert "TOP" in res.views_analyzed

    # Dimensions
    assert res.estimated_floors_above >= 2
    assert res.estimated_height_m > 0.0
    assert res.estimated_width_m > 0.0
    assert res.estimated_length_m > 0.0
    assert res.footprint_area_sqm > 0.0
    assert res.envelope_volume_cbm > 0.0

    # 3D Geometry
    assert res.geometry_3d.geometry_type == "PolyhedralSurface"
    assert res.geometry_3d.srid == 32644
    assert res.geometry_3d.wkt_3d.startswith("POLYHEDRALSURFACE Z")
    assert res.geometry_3d.is_watertight is True
    assert len(res.geometry_3d.footprint_wgs84) >= 4


def test_02_single_view_reconstruction_with_warning():
    """Validates single-view reconstruction includes clear limitation warning."""
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(
                image_base64=DUMMY_PNG_B64,
                view_type="FRONT",
                filename="single_facade.png"
            )
        ],
        floor_height_prior_m=3.0
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.is_single_view is True
    assert any("Single-image reconstruction" in w for w in res.warnings)
    assert res.status == "PROPOSED"
    assert res.human_verification_required is True


def test_03_explicit_provenance_classification():
    """Validates that all derived properties are explicitly categorized in the domain model."""
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT")
        ],
        ground_z_override=542.5
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    provenance_map = {item.property_name: item.provenance for item in res.derived_properties}
    
    # Height and floors must be ESTIMATED
    assert provenance_map["Building Height"] == "ESTIMATED"
    assert provenance_map["Storey Count (Above Ground)"] == "ESTIMATED"
    
    # User override ground elevation is OBSERVED
    ground_key = "Ground Z" if "Ground Z" in provenance_map else "Ground Elevation Z"
    assert provenance_map[ground_key] == "OBSERVED"
    
    # Envelope and 3D cadastre are PROPOSED
    assert provenance_map["Footprint Area"] == "PROPOSED"
    assert provenance_map["Envelope Volume"] == "PROPOSED"
    solid_key = "3D Building Geometry" if "3D Building Geometry" in provenance_map else "3D Cadastral Solid"
    assert provenance_map[solid_key] == "PROPOSED"

    # Verify no fabricated confidence (all between 0.0 and 1.0)
    for item in res.derived_properties:
        assert 0.0 <= item.confidence_score <= 1.0


def test_04_pipeline_feed_payload_compatibility():
    """Validates that pipeline_feed_payload has all required fields for building generation."""
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="PERSPECTIVE")
        ],
        building_name_hint="Prototype Complex B"
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    payload = res.pipeline_feed_payload
    assert "footprint_wgs84" in payload
    assert "building_name" in payload
    assert "total_floors_above" in payload
    assert "total_floors_below" in payload
    assert "ground_elevation_m" in payload
    assert "floor_height_m" in payload
    assert payload["building_name"] == "Prototype Complex B"
    assert payload["is_synthetic_prototype"] is True


def test_05_reconstruction_api_endpoint():
    """Validates POST /api/ai/building/reconstruct HTTP endpoint."""
    response = client.post(
        "/api/ai/building/reconstruct",
        json={
            "images": [
                {
                    "image_base64": DUMMY_PNG_B64,
                    "view_type": "FRONT",
                    "filename": "facade.png"
                }
            ],
            "building_name_hint": "API Test Tower",
            "floor_height_prior_m": 3.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PROPOSED"
    assert data["building_detected"] is True
    assert data["estimated_height_m"] > 0
    assert data["geometry_3d"]["wkt_3d"].startswith("POLYHEDRALSURFACE Z")
    assert data["human_verification_required"] is True


def test_06_missing_images_rejection():
    """Validates 422 error when images list is empty."""
    response = client.post(
        "/api/ai/building/reconstruct",
        json={
            "images": []
        }
    )
    assert response.status_code == 422


def test_07_invalid_image_payload_rejection():
    """Validates 422 error when image payload contains only corrupted/un-decodable bytes."""
    response = client.post(
        "/api/ai/building/reconstruct",
        json={
            "images": [
                {
                    "image_base64": "!!!not_valid_base64$$$",
                    "view_type": "FRONT"
                }
            ]
        }
    )
    assert response.status_code == 422


def test_08_confidence_scoring_consistency():
    """Validates documented scoring: single=0.52, orthogonal pair=0.70, 3+ views=0.82."""
    service = ImageReconstructionService()

    # Single view
    r1 = service.reconstruct_building_from_images(BuildingImageReconstructionRequest(
        images=[BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT")]
    ))
    assert r1.confidence_score == 0.52

    # Orthogonal pair (2 views)
    r2 = service.reconstruct_building_from_images(BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT"),
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="SIDE")
        ]
    ))
    assert r2.confidence_score == 0.70

    # 3+ views
    r3 = service.reconstruct_building_from_images(BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT"),
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="SIDE"),
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="TOP")
        ]
    ))
    assert r3.confidence_score == 0.82


def test_09_dem_ground_z_reference_classification_and_no_amsl():
    """Verifies that DEM-derived ground elevation is REFERENCE, height is ESTIMATED, geometry is PROPOSED, and no AMSL appears."""
    service = ImageReconstructionService()
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT")
        ],
        building_name_hint="Surya Heights West Proposed"
    )
    res = service.reconstruct_building_from_images(req)

    prop_by_name = {p.property_name: p for p in res.derived_properties}

    # 1. Building Height: ESTIMATED, Source: AI-assisted image/spatial estimation
    assert prop_by_name["Building Height"].provenance == "ESTIMATED"
    assert prop_by_name["Building Height"].source_description == "AI-assisted image/spatial estimation"

    # 2. Ground Z: REFERENCE, Source: DEM-derived prototype reference
    ground_p = prop_by_name.get("Ground Z") or prop_by_name.get("Ground Elevation Z")
    assert ground_p is not None
    assert ground_p.provenance == "REFERENCE"
    assert ground_p.source_description == "DEM-derived prototype reference"
    assert ground_p.value == 540.0
    assert ground_p.unit == "m"

    # 3. 3D Building Geometry: PROPOSED, Source: AI-assisted reconstruction
    geom_p = prop_by_name.get("3D Building Geometry") or prop_by_name.get("3D Cadastral Solid")
    assert geom_p is not None
    assert geom_p.provenance == "PROPOSED"
    assert geom_p.source_description == "AI-assisted reconstruction"

    # 4. Strictly no AMSL or MSL in response
    dump_str = res.model_dump_json()
    assert "AMSL" not in dump_str
    assert "MSL" not in dump_str


def test_10_missing_elevation_produces_explicit_unavailable_state():
    """Verifies that when no valid elevation reference source exists, an explicit unavailable state is produced instead of inventing a value."""
    service = ImageReconstructionService()
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT")
        ],
        building_name_hint="Unknown Unanchored Site"
    )
    res = service.reconstruct_building_from_images(req)

    # Must NOT invent 540.0
    assert res.ground_z_m is None
    assert res.roof_z_m is None

    prop_by_name = {p.property_name: p for p in res.derived_properties}
    ground_p = prop_by_name.get("Ground Z") or prop_by_name.get("Ground Elevation Z")
    assert ground_p is not None
    assert "Ground Z unavailable — authoritative/reference elevation required" in str(ground_p.value)

    # Explicit warning produced
    assert any("Ground Z unavailable — authoritative/reference elevation required" in w for w in res.warnings)


def test_11_hardcoded_540_not_used_as_universal_fallback():
    """Verifies that an unanchored request without override does not fall back universally to 540.0."""
    service = ImageReconstructionService()
    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=DUMMY_PNG_B64, view_type="FRONT")
        ],
        building_name_hint="Generic Site X",
        parcel_id=None
    )
    res = service.reconstruct_building_from_images(req)
    assert res.ground_z_m != 540.0
    assert res.ground_z_m is None


def test_12_multiview_consistency_and_feature_correspondence():
    """
    Validates view-specific evidence parsing:
    - Front view with G+4 storeys -> 5 storeys, height = 15.0m
    - Top view with rooftop core -> rooftop_core_detected = True, roof_type = FLAT_TERRACE_WITH_CORE
    - Top footprint aspect ratio 240:200 -> width:depth ratio matches ~1.2
    - Consistency record status = CONSISTENT, correspondence checks all MATCH
    """
    svg_front = '<svg width="400" height="300"><rect x="80" y="40" width="240" height="230"/><text>FRONT FACADE ELEVATION (G+4 STOREYS)</text></svg>'
    svg_side = '<svg width="400" height="300"><rect x="90" y="40" width="220" height="230"/><text>SIDE ELEVATION (DEPTH PROFILE)</text></svg>'
    svg_top = '<svg width="400" height="300"><rect x="80" y="50" width="240" height="200"/><rect x="150" y="100" width="100" height="80"/><text>ROOFTOP / CORE</text></svg>'

    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=svg_front, view_type="FRONT"),
            BuildingImageViewItem(image_base64=svg_side, view_type="SIDE"),
            BuildingImageViewItem(image_base64=svg_top, view_type="TOP"),
        ],
        floor_height_prior_m=3.0,
        ground_z_override=540.0
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.estimated_floors_above == 5
    assert res.estimated_height_m == 15.0
    assert res.consistency_record is not None
    assert res.consistency_record.rooftop_core_detected is True
    assert res.consistency_record.roof_type == "FLAT_TERRACE_WITH_CORE"
    assert res.consistency_record.consistency_status == "CONSISTENT"
    assert res.consistency_record.correspondence_checks["footprint"] == "MATCH"
    assert res.consistency_record.correspondence_checks["height"] == "MATCH"
    assert res.consistency_record.correspondence_checks["floor_count"] == "MATCH"
    assert res.consistency_record.correspondence_checks["major_offsets"] == "MATCH"


def test_13_multiview_conflict_flagging():
    """
    Validates that extreme dimensional discrepancies between views
    are flagged as MULTI-VIEW GEOMETRY CONFLICT rather than silently averaged.
    """
    svg_top_narrow = '<svg width="400" height="300"><rect x="80" y="50" width="240" height="60"/></svg>'
    svg_side_deep = '<svg width="400" height="300"><rect x="50" y="50" width="240" height="120"/></svg>'

    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=svg_top_narrow, view_type="TOP"),
            BuildingImageViewItem(image_base64=svg_side_deep, view_type="SIDE"),
        ],
        floor_height_prior_m=3.0
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.consistency_record is not None
    assert res.consistency_record.consistency_status == "REVIEW_REQUIRED"
    assert len(res.consistency_record.conflicts) > 0
    assert any("diverges" in c for c in res.consistency_record.conflicts)
    assert res.consistency_record.correspondence_checks["footprint"] == "REVIEW"


def test_14_canonical_reconstruction_contract_g1_residential():
    """
    Validates that demo G+1 images produce:
    - Canonical contract attached with exact 2 above-ground floors
    - Building height is ~7.0m (2 * 3.5m)
    - Footprint is ~10.0m x 8.0m (residential scale)
    - Basement is 0 by default
    """
    svg_front = '<svg width="400" height="300"><text>FRONT FACADE ELEVATION (G+1 STOREYS)</text></svg>'
    svg_side = '<svg width="400" height="300"><text>SIDE ELEVATION (DEPTH PROFILE)</text></svg>'
    svg_top = '<svg width="400" height="300"><rect x="100" y="70" width="200" height="160"/><text>AERIAL / ROOF PLAN FOOTPRINT</text></svg>'

    req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=svg_front, view_type="FRONT"),
            BuildingImageViewItem(image_base64=svg_side, view_type="SIDE"),
            BuildingImageViewItem(image_base64=svg_top, view_type="TOP"),
        ],
        building_name_hint="Proposed Modern Residential Building",
        floor_height_prior_m=3.5,
        has_basement_hint=False,
        ground_z_override=540.0
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.canonical_reconstruction is not None
    canon = res.canonical_reconstruction
    assert canon.above_ground_floors == 2
    assert canon.basement_floors == 0
    assert canon.floor_height_m == 3.5
    assert canon.building_height_m == 7.0
    assert canon.footprint_width_m == 10.0
    assert canon.footprint_depth_m == 8.0
    assert canon.ground_z == 540.0
    assert res.roof_z_m == 547.0
    assert canon.roof_height_m in (0.0, 1.2)

    # pipeline_feed_payload must reflect these exact canonical numbers
    feed = res.pipeline_feed_payload
    assert feed["total_floors_above"] == 2
    assert feed["total_floors_below"] == 0
    assert feed["floor_height_m"] == 3.5
    assert feed["parcel_id"] is None


def test_15_canonical_reconstruction_contract_g2():
    """Validates that G+2 input correctly deduces 3 above-ground storeys."""
    svg_front = '<svg width="400" height="300"><text>FRONT ELEVATION G+2</text></svg>'
    req = BuildingImageReconstructionRequest(
        images=[BuildingImageViewItem(image_base64=svg_front, view_type="FRONT")],
        floor_height_prior_m=3.0,
        has_basement_hint=False
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.canonical_reconstruction is not None
    assert res.canonical_reconstruction.above_ground_floors == 3
    assert res.canonical_reconstruction.building_height_m == 9.0


def test_16_canonical_g1_with_basement():
    """Validates that enabling basement keeps above-ground floors at 2 and basement at 1."""
    svg_front = '<svg width="400" height="300"><text>FRONT FACADE ELEVATION (G+1 STOREYS)</text></svg>'
    req = BuildingImageReconstructionRequest(
        images=[BuildingImageViewItem(image_base64=svg_front, view_type="FRONT")],
        floor_height_prior_m=3.5,
        has_basement_hint=True,
        ground_z_override=540.0
    )
    service = ImageReconstructionService()
    res = service.reconstruct_building_from_images(req)

    assert res.canonical_reconstruction is not None
    canon = res.canonical_reconstruction
    assert canon.above_ground_floors == 2
    assert canon.basement_floors == 1
    assert canon.building_height_m == 7.0


def test_17_end_to_end_building_generation_preserves_canonical_dimensions():
    """
    Validates end-to-end data flow:
    ImageReconstruction -> pipeline_feed_payload -> BuildingGenerationService
    Generated building MUST have:
    - 2 above-ground storeys generated (F00, F01)
    - 0 basement storeys generated
    - building_height_m = 7.0 (above ground, NOT 21.5m)
    - independent building_code (NOT APARTMENT-SURYA-OSM)
    """
    from backend.app.services.building_generation_service import BuildingGenerationService
    from backend.app.schemas.building_generation import BuildingPrototypeGenerationRequest

    svg_front = '<svg width="400" height="300"><text>FRONT FACADE ELEVATION (G+1 STOREYS)</text></svg>'
    svg_side = '<svg width="400" height="300"><text>SIDE ELEVATION</text></svg>'
    svg_top = '<svg width="400" height="300"><rect x="100" y="70" width="200" height="160"/></svg>'

    recon_req = BuildingImageReconstructionRequest(
        images=[
            BuildingImageViewItem(image_base64=svg_front, view_type="FRONT"),
            BuildingImageViewItem(image_base64=svg_side, view_type="SIDE"),
            BuildingImageViewItem(image_base64=svg_top, view_type="TOP"),
        ],
        building_name_hint="Proposed G+1 Villa",
        floor_height_prior_m=3.5,
        has_basement_hint=False,
        ground_z_override=540.0
    )
    recon_service = ImageReconstructionService()
    recon_res = recon_service.reconstruct_building_from_images(recon_req)

    # Feed into building generation service
    from backend.app.db import SessionLocal
    db = SessionLocal()
    try:
        bldg_service = BuildingGenerationService(db)
        gen_req = BuildingPrototypeGenerationRequest(**recon_res.pipeline_feed_payload)
        gen_res = bldg_service.generate_building_3d_cadastre(gen_req)

        # Building generation must strictly adhere to the canonical reconstruction
        above_floors = set(u.floor_code for u in gen_res.generated_units if u.floor_code.startswith("F"))
        basement_floors = set(u.floor_code for u in gen_res.generated_units if u.floor_code.startswith("B"))
        assert len(above_floors) == 2
        assert len(basement_floors) == 0
        assert abs(gen_res.building_height_m - 7.0) < 0.1
        assert "SURYA" not in gen_res.building_code
        assert gen_res.building_code.startswith("BLDG-PROP-")
    finally:
        db.close()


def test_18_identity_isolation_never_mutates_surya_heights():
    """
    Validates that creating proposed buildings from AI reconstruction
    never re-uses Surya Heights parcel or building identity.
    """
    from backend.app.services.building_generation_service import BuildingGenerationService
    from backend.app.schemas.building_generation import BuildingPrototypeGenerationRequest
    from backend.app.db import SessionLocal

    db = SessionLocal()
    try:
        bldg_service = BuildingGenerationService(db)
        feed_payload = {
            "building_name": "Proposed G+1 House",
            "total_floors_above": 2,
            "total_floors_below": 0,
            "floor_height_m": 3.5,
            "ground_elevation_m": 540.0,
            "include_rooftop": False,
            "subdivide_residential_floors": True,
            "is_synthetic_prototype": True,
            "parcel_id": None,
            "footprint_wgs84": [
                [78.37610, 17.44810],
                [78.37620, 17.44810],
                [78.37620, 17.44818],
                [78.37610, 17.44818],
                [78.37610, 17.44810],
            ]
        }
        gen_req = BuildingPrototypeGenerationRequest(**feed_payload)
        gen_res = bldg_service.generate_building_3d_cadastre(gen_req)

        # Verify parcel is dedicated proposed parcel
        assert gen_res.parcel_ulpin_2d != "36A1B2C3D4E5F9"
        assert gen_res.parcel_ulpin_2d != "36A1B2C3D4E5F8"
        assert gen_res.building_code != "APARTMENT-SURYA-OSM"
        above_floors = set(u.floor_code for u in gen_res.generated_units if u.floor_code.startswith("F"))
        assert len(above_floors) == 2
        assert abs(gen_res.building_height_m - 7.0) < 0.1
    finally:
        db.close()




