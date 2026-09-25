"""
SIH26011 Phase 2.8: Rich Vertical Property Decomposition & Multi-Tier 3D Property Stack Engine.

Decomposes and classifies heterogeneous 3D vertical spatial units into standard cadastral strata:
1. UNDERGROUND: Basement, Underground Parking, Subsurface Utilities
2. GROUND: Ground Floor, Open/Covered Parking
3. UPPER_FLOORS: Residential & Commercial Upper Storeys
4. ROOFTOP_ELEVATED: Rooftop Structures, Air-Rights & Elevated Walkways
5. COMMON: Shared Circulation Cores & Vertical Shafts

DISCLAIMER:
Research prototype decomposition model for 3D cadastral visualization and candidate integration.
Does not determine legal land ownership, title rights, or statutory property rights.
"""
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status

from backend.app.schemas.responses import (
    VerticalTaxonomyClassification,
    VerticalCategoryGroup,
    VerticalStructureResponse,
    VerticalUnitResponse,
    SourceEvidenceResponse,
    VerificationAuditResponse,
    GeometryPayload
)
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint


TAXONOMY_CATEGORY_ORDER = [
    "ROOFTOP_ELEVATED",
    "UPPER_FLOORS",
    "GROUND",
    "UNDERGROUND",
    "COMMON"
]

TAXONOMY_CATEGORY_LABELS = {
    "ROOFTOP_ELEVATED": "Rooftop / Elevated Strata",
    "UPPER_FLOORS": "Upper Floors (Residential / Commercial)",
    "GROUND": "Ground Level (Floor & Parking)",
    "UNDERGROUND": "Underground Subsurface Strata",
    "COMMON": "Common Circulation & Service Shafts",
    "OTHER": "Other Spatial Strata"
}


def classify_vertical_taxonomy(
    tier_code: str,
    unit_type: str,
    floor_code: str,
    unit_label: Optional[str] = None
) -> VerticalTaxonomyClassification:
    """
    Deterministic rule-based prototype classification of 3D vertical property units.
    """
    tier = (tier_code or "").upper().strip()
    u_type = (unit_type or "").upper().strip()
    f_code = (floor_code or "").upper().strip()
    label = (unit_label or "").lower()

    if tier == "UT":
        return VerticalTaxonomyClassification(
            category="UNDERGROUND",
            category_label=TAXONOMY_CATEGORY_LABELS["UNDERGROUND"],
            unit_class="UNDERGROUND_UTILITY",
            unit_class_label="Subsurface Utility Corridor"
        )
    elif tier == "SB":
        if u_type == "PARKING" or "park" in label or "p0" in f_code.lower() or "b02" in f_code.lower():
            return VerticalTaxonomyClassification(
                category="UNDERGROUND",
                category_label=TAXONOMY_CATEGORY_LABELS["UNDERGROUND"],
                unit_class="UNDERGROUND_PARKING",
                unit_class_label="Underground Parking Facility"
            )
        else:
            return VerticalTaxonomyClassification(
                category="UNDERGROUND",
                category_label=TAXONOMY_CATEGORY_LABELS["UNDERGROUND"],
                unit_class="BASEMENT",
                unit_class_label="Underground Basement Strata"
            )
    elif tier == "F":
        # Check if ground level
        if f_code in ("F00", "G00", "GF", "0", "F0") or "ground" in label:
            if u_type == "PARKING" or "park" in label:
                return VerticalTaxonomyClassification(
                    category="GROUND",
                    category_label=TAXONOMY_CATEGORY_LABELS["GROUND"],
                    unit_class="OPEN_PARKING",
                    unit_class_label="Ground Open / Covered Parking"
                )
            else:
                return VerticalTaxonomyClassification(
                    category="GROUND",
                    category_label=TAXONOMY_CATEGORY_LABELS["GROUND"],
                    unit_class="GROUND_FLOOR",
                    unit_class_label="Ground Floor Strata"
                )
        elif u_type == "PARKING" or "park" in label:
            return VerticalTaxonomyClassification(
                category="GROUND",
                category_label=TAXONOMY_CATEGORY_LABELS["GROUND"],
                unit_class="OPEN_PARKING",
                unit_class_label="Podium / Ground Parking"
            )
        else:
            return VerticalTaxonomyClassification(
                category="UPPER_FLOORS",
                category_label=TAXONOMY_CATEGORY_LABELS["UPPER_FLOORS"],
                unit_class="UPPER_FLOOR",
                unit_class_label=f"Upper Storey Strata ({floor_code})"
            )
    elif tier == "AR":
        return VerticalTaxonomyClassification(
            category="ROOFTOP_ELEVATED",
            category_label=TAXONOMY_CATEGORY_LABELS["ROOFTOP_ELEVATED"],
            unit_class="ROOFTOP",
            unit_class_label="Rooftop Structure & Air-Rights"
        )
    elif tier == "AE":
        return VerticalTaxonomyClassification(
            category="ROOFTOP_ELEVATED",
            category_label=TAXONOMY_CATEGORY_LABELS["ROOFTOP_ELEVATED"],
            unit_class="ELEVATED",
            unit_class_label="Elevated Walkway / Air-Rights Strata"
        )
    elif tier == "CM":
        return VerticalTaxonomyClassification(
            category="COMMON",
            category_label=TAXONOMY_CATEGORY_LABELS["COMMON"],
            unit_class="COMMON_CIRCULATION",
            unit_class_label="Common Circulation Core & Shaft"
        )
    else:
        return VerticalTaxonomyClassification(
            category="OTHER",
            category_label=TAXONOMY_CATEGORY_LABELS["OTHER"],
            unit_class=u_type or "GENERIC_STRATA",
            unit_class_label=f"Spatial Unit ({floor_code})"
        )


class VerticalPropertyDecompositionService:
    def __init__(self, db: Session):
        self.db = db

    def decompose_units_to_categories(
        self,
        units: List[VerticalUnitResponse]
    ) -> List[VerticalCategoryGroup]:
        """
        Groups a list of vertical units into the 5 standard cadastral vertical property categories.
        """
        groups: Dict[str, List[VerticalUnitResponse]] = {cat: [] for cat in TAXONOMY_CATEGORY_ORDER}
        groups["OTHER"] = []

        for unit in units:
            cat = unit.taxonomy.category if unit.taxonomy else "OTHER"
            if cat not in groups:
                groups[cat] = []
            groups[cat].append(unit)

        result_groups: List[VerticalCategoryGroup] = []
        for cat_code in TAXONOMY_CATEGORY_ORDER + ["OTHER"]:
            cat_units = groups.get(cat_code, [])
            if not cat_units:
                continue
            
            # Sort units within group by descending Z elevation
            cat_units.sort(key=lambda u: u.z_max, reverse=True)
            min_z = min(u.z_min for u in cat_units)
            max_z = max(u.z_max for u in cat_units)

            result_groups.append(
                VerticalCategoryGroup(
                    category_code=cat_code,
                    category_label=TAXONOMY_CATEGORY_LABELS.get(cat_code, cat_code),
                    unit_count=len(cat_units),
                    z_min=min_z,
                    z_max=max_z,
                    units=cat_units
                )
            )

        return result_groups

    def get_parcel_vertical_structure(
        self,
        parcel_id: uuid.UUID,
        all_units: List[VerticalUnitResponse]
    ) -> VerticalStructureResponse:
        """
        Builds the complete multi-tier vertical property decomposition for a given parcel.
        """
        # Lookup parcel ULPIN
        query = text("SELECT ulpin_2d FROM parcels WHERE id = :pid;")
        p_row = self.db.execute(query, {"pid": parcel_id}).mappings().first()
        if not p_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Terrestrial parcel {parcel_id} not found."
            )

        categories = self.decompose_units_to_categories(all_units)
        return VerticalStructureResponse(
            parcel_id=parcel_id,
            parcel_ulpin_2d=p_row["ulpin_2d"],
            total_units=len(all_units),
            categories=categories
        )

    def create_synthetic_multitier_candidate_specs(
        self,
        parcel_ulpin_2d: str = "27A8B9C3D4E5F6",
        base_origin_x: float = 219405.0,
        base_origin_y: float = 1932502.5,
        width: float = 20.0,
        depth: float = 15.0
    ) -> List[Dict[str, Any]]:
        """
        Constructs candidate unit specifications for a comprehensive 9-tier vertical property scenario:
        1. Underground Utility (UT) [Z 532 - 534]
        2. Underground Basement (SB) [Z 534 - 537]
        3. Underground Parking (SB) [Z 537 - 540]
        4. Ground Floor (F) [Z 540 - 543.5]
        5. Ground Open Parking (F) [Z 540 - 543.5, non-overlapping side parcel quadrant]
        6. Upper Residential Floor 1 (F) [Z 543.5 - 546.5]
        7. Upper Residential Floor 2 (F) [Z 546.5 - 549.5]
        8. Rooftop Structure & Solar (AR) [Z 549.5 - 552.0]
        9. Common Circulation Core (CM) [Z 540.0 - 549.5, non-overlapping internal core polygon]
        10. Elevated Skybridge Corridor (AE) [Z 546.5 - 549.5, elevated corridor extension]
        """
        # Main building footprint (20m x 15m) [X: 219405.0 to 219425.0, Y: 1932502.5 to 1932517.5]
        main_footprint = [
            [base_origin_x, base_origin_y],
            [base_origin_x + width, base_origin_y],
            [base_origin_x + width, base_origin_y + depth],
            [base_origin_x, base_origin_y + depth],
            [base_origin_x, base_origin_y]
        ]

        # Ground Parking side quadrant (X: 219425.5 to 219429.5, Y: 1932502.5 to 1932517.5)
        # Non-overlapping with main building footprint [219405-219425], strictly within parcel [219400-219430]
        parking_footprint = [
            [base_origin_x + width + 0.5, base_origin_y],
            [base_origin_x + width + 4.5, base_origin_y],
            [base_origin_x + width + 4.5, base_origin_y + depth],
            [base_origin_x + width + 0.5, base_origin_y + depth],
            [base_origin_x + width + 0.5, base_origin_y]
        ]

        # Rooftop structure footprint (recessed core 12m x 10m on roof)
        roof_footprint = [
            [base_origin_x + 4.0, base_origin_y + 2.5],
            [base_origin_x + 16.0, base_origin_y + 2.5],
            [base_origin_x + 16.0, base_origin_y + 12.5],
            [base_origin_x + 4.0, base_origin_y + 12.5],
            [base_origin_x + 4.0, base_origin_y + 2.5]
        ]

        # Elevated skybridge footprint (X: 219425.0 to 219429.0, Y: 1932507.0 to 1932513.0)
        elevated_footprint = [
            [base_origin_x + width, base_origin_y + 4.5],
            [base_origin_x + width + 4.0, base_origin_y + 4.5],
            [base_origin_x + width + 4.0, base_origin_y + 10.5],
            [base_origin_x + width, base_origin_y + 10.5],
            [base_origin_x + width, base_origin_y + 4.5]
        ]

        # Subsurface Utility conduit footprint (X: 219401.0 to 219404.5, Y: 1932502.5 to 1932517.5)
        utility_footprint = [
            [base_origin_x - 4.0, base_origin_y],
            [base_origin_x - 0.5, base_origin_y],
            [base_origin_x - 0.5, base_origin_y + depth],
            [base_origin_x - 4.0, base_origin_y + depth],
            [base_origin_x - 4.0, base_origin_y]
        ]

        specs = [
            {
                "floor_code": "UT01",
                "tier_code": "UT",
                "unit_type": "UTILITY_CORRIDOR",
                "unit_label": "Subsurface Utility Conduit & Pipeline Trench",
                "z_min": 532.0,
                "z_max": 534.0,
                "footprint": utility_footprint,
                "source_type": "ARCHITECTURAL_PLAN_2D",
                "dataset_name": "Municipal Utility Cadastre Survey & Engineering Drawing",
                "file_uri": "cad/subsurface_utility_survey_2026.dwg",
                "accuracy_h": 0.05,
                "accuracy_v": 0.05
            },
            {
                "floor_code": "B02",
                "tier_code": "SB",
                "unit_type": "PARKING",
                "unit_label": "Underground Parking Facility (Level -2)",
                "z_min": 534.0,
                "z_max": 537.0,
                "footprint": main_footprint,
                "source_type": "BIM_IFC",
                "dataset_name": "Structural Substructure BIM Model (IFC4)",
                "file_uri": "bim/tower_a_substructure_lod300.ifc",
                "accuracy_h": 0.02,
                "accuracy_v": 0.02
            },
            {
                "floor_code": "B01",
                "tier_code": "SB",
                "unit_type": "COMMERCIAL",
                "unit_label": "Basement Commercial & Storage Strata (Level -1)",
                "z_min": 537.0,
                "z_max": 540.0,
                "footprint": main_footprint,
                "source_type": "BIM_IFC",
                "dataset_name": "Structural Substructure BIM Model (IFC4)",
                "file_uri": "bim/tower_a_substructure_lod300.ifc",
                "accuracy_h": 0.02,
                "accuracy_v": 0.02
            },
            {
                "floor_code": "F00",
                "tier_code": "F",
                "unit_type": "COMMERCIAL",
                "unit_label": "Ground Floor Commercial Lobby & Retail Strata",
                "z_min": 540.0,
                "z_max": 543.5,
                "footprint": main_footprint,
                "source_type": "LIDAR_POINTCLOUD",
                "dataset_name": "Airborne LiDAR Structural Scan Flight 01",
                "file_uri": "lidar/pointclouds/tower_a_flight01.las",
                "accuracy_h": 0.04,
                "accuracy_v": 0.03
            },
            {
                "floor_code": "P00",
                "tier_code": "F",
                "unit_type": "PARKING",
                "unit_label": "Ground Open Parking & EV Charging Bay",
                "z_min": 540.0,
                "z_max": 543.5,
                "footprint": parking_footprint,
                "source_type": "ARCHITECTURAL_PLAN_2D",
                "dataset_name": "Approved Surface Site Plan & Parking Layout",
                "file_uri": "cad/ground_parking_site_plan_2026.dwg",
                "accuracy_h": 0.05,
                "accuracy_v": 0.05
            },
            {
                "floor_code": "F01",
                "tier_code": "F",
                "unit_type": "RESIDENTIAL",
                "unit_label": "Upper Residential Storey (Floor 1)",
                "z_min": 543.5,
                "z_max": 546.5,
                "footprint": main_footprint,
                "source_type": "LIDAR_POINTCLOUD",
                "dataset_name": "Airborne LiDAR Structural Scan Flight 01",
                "file_uri": "lidar/pointclouds/tower_a_flight01.las",
                "accuracy_h": 0.04,
                "accuracy_v": 0.03
            },
            {
                "floor_code": "F02",
                "tier_code": "F",
                "unit_type": "RESIDENTIAL",
                "unit_label": "Upper Residential Storey (Floor 2)",
                "z_min": 546.5,
                "z_max": 549.5,
                "footprint": main_footprint,
                "source_type": "LIDAR_POINTCLOUD",
                "dataset_name": "Airborne LiDAR Structural Scan Flight 01",
                "file_uri": "lidar/pointclouds/tower_a_flight01.las",
                "accuracy_h": 0.04,
                "accuracy_v": 0.03
            },
            {
                "floor_code": "RF01",
                "tier_code": "AR",
                "unit_type": "COMMON_CIRCULATION",
                "unit_label": "Rooftop Common Solar Array & Terrace Space",
                "z_min": 549.5,
                "z_max": 552.0,
                "footprint": roof_footprint,
                "source_type": "DRONE_PHOTOGRAMMETRY",
                "dataset_name": "UAV High-Resolution Aerial Photogrammetry",
                "file_uri": "photogrammetry/tower_a_roof_mesh.obj",
                "accuracy_h": 0.05,
                "accuracy_v": 0.05
            },
            {
                "floor_code": "AE01",
                "tier_code": "AE",
                "unit_type": "AIR_RIGHTS",
                "unit_label": "Elevated Skybridge / Air-Rights Corridor",
                "z_min": 546.5,
                "z_max": 549.5,
                "footprint": elevated_footprint,
                "source_type": "BIM_IFC",
                "dataset_name": "Elevated Structural BIM Model (IFC4)",
                "file_uri": "bim/tower_a_skybridge_lod300.ifc",
                "accuracy_h": 0.02,
                "accuracy_v": 0.02
            }
        ]

        # Generate PolyhedralSurface WKT for each spec
        for s in specs:
            wkt, _ = build_polyhedralsurface_wkt_from_footprint(
                s["footprint"],
                s["z_min"],
                s["z_max"]
            )
            s["geom_wkt"] = wkt

        return specs
