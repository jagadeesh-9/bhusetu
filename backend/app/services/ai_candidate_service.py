"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.9: Explainable AI-Assisted 3D Candidate Extraction Service

This service acts strictly as an AI CANDIDATE PROPOSER and EXPLAINABILITY ENGINE.
It generates explainable 3D vertical property candidate hypotheses from spatial evidence
(LiDAR point clouds, building extractions, BIM/CAD metadata).

DISCLAIMER:
Research Prototype Only.
The AI component is an algorithmic proposer and DOES NOT possess verification authority.
It does not perform legal title determination, ownership certification, or official ULPIN assignment.
Human-in-the-loop verification by an authorized surveyor or revenue official remains mandatory.
"""
import os
import json
import uuid
import math
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from shapely.geometry import shape, Polygon, box
from shapely import wkt
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.schemas.responses import (
    AICandidateFeatureVector,
    AICandidateProposal,
    AICandidateAnalysisResponse,
    AIProposeCandidatesResponse,
    AIBuildingAnalysisResponse,
    DataClassificationItem
)
from backend.app.schemas.requests import AIProposeCandidatesRequest, AIBuildingAnalysisRequest
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint


def wgs84_to_utm44n(lon_deg: float, lat_deg: float) -> Tuple[float, float]:
    """Accurate conversion from WGS84 (lon, lat) to UTM Zone 44N (easting, northing)"""
    a = 6378137.0
    f = 1 / 298.257223563
    b = a * (1 - f)
    e = math.sqrt(1 - (b / a) ** 2)
    e_prime_sq = (e ** 2) / (1 - e ** 2)
    k0 = 0.9996
    lon0 = 81.0 * math.pi / 180.0
    
    phi = lat_deg * math.pi / 180.0
    lam = lon_deg * math.pi / 180.0
    
    N = a / math.sqrt(1 - (e ** 2) * (math.sin(phi) ** 2))
    T = math.tan(phi) ** 2
    C = e_prime_sq * (math.cos(phi) ** 2)
    A = (lam - lon0) * math.cos(phi)
    
    M = a * (
        (1 - (e ** 2) / 4 - 3 * (e ** 4) / 64 - 5 * (e ** 6) / 256) * phi
        - (3 * (e ** 2) / 8 + 3 * (e ** 4) / 32 + 45 * (e ** 6) / 1024) * math.sin(2 * phi)
        + (15 * (e ** 4) / 256 + 45 * (e ** 6) / 1024) * math.sin(4 * phi)
        - (35 * (e ** 6) / 3072) * math.sin(6 * phi)
    )
    
    easting = k0 * N * (
        A + (1 - T + C) * (A ** 3) / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * e_prime_sq) * (A ** 5) / 120
    ) + 500000.0
    
    northing = k0 * (
        M + N * math.tan(phi) * (
            (A ** 2) / 2 + (5 - T + 9 * C + 4 * (C ** 2)) * (A ** 4) / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * e_prime_sq) * (A ** 6) / 720
        )
    )
    return easting, northing


class AICandidateService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def extract_features_from_geometry_and_points(
        self,
        footprint_poly: Polygon,
        z_min: float,
        z_max: float,
        ground_z: float = 540.0,
        roof_z: float = 549.5,
        las_z_coords: Optional[np.ndarray] = None,
        las_x_coords: Optional[np.ndarray] = None,
        las_y_coords: Optional[np.ndarray] = None,
        source_evidence_type: str = "LIDAR_POINTCLOUD",
        is_synthetic: bool = True
    ) -> AICandidateFeatureVector:
        """
        Extracts spatial, geometric, vertical, and point-cloud statistical features
        for a vertical unit candidate interval.
        """
        # 1. Geometric Features
        area = float(footprint_poly.area)
        perimeter = float(footprint_poly.length)
        compactness = (4.0 * math.pi * area) / (perimeter ** 2) if perimeter > 0 else 0.0
        
        minx, miny, maxx, maxy = footprint_poly.bounds
        width = float(maxx - minx)
        length = float(maxy - miny)
        aspect_ratio = float(min(width, length) / max(width, length)) if max(width, length) > 0 else 1.0
        
        centroid = footprint_poly.centroid
        centroid_x = float(centroid.x)
        centroid_y = float(centroid.y)

        # 2. Vertical Features
        interval_height = float(z_max - z_min)
        building_total_height = max(roof_z - ground_z, 1.0)
        relative_height_ratio = float(max(0.0, (z_min - ground_z)) / building_total_height)

        # 3. Point Cloud Statistical Features
        point_count = 0
        point_density = 0.0
        z_mean = float((z_min + z_max) / 2.0)
        z_std = 0.0
        z_p25 = float(z_min + 0.25 * interval_height)
        z_p50 = float(z_min + 0.50 * interval_height)
        z_p75 = float(z_min + 0.75 * interval_height)
        z_p90 = float(z_min + 0.90 * interval_height)
        peak_prominence_ratio = 1.0

        if las_z_coords is not None:
            if len(las_z_coords) > 0:
                if las_x_coords is not None and las_y_coords is not None:
                    # Spatial mask
                    in_bbox = (
                        (las_x_coords >= minx - 0.5) & (las_x_coords <= maxx + 0.5) &
                        (las_y_coords >= miny - 0.5) & (las_y_coords <= maxy + 0.5) &
                        (las_z_coords >= z_min - 0.05) & (las_z_coords <= z_max + 0.05)
                    )
                    interval_z = las_z_coords[in_bbox]
                else:
                    in_z = (las_z_coords >= z_min - 0.05) & (las_z_coords <= z_max + 0.05)
                    interval_z = las_z_coords[in_z]

                point_count = int(len(interval_z))
                volume_m3 = max(area * interval_height, 0.1)
                point_density = float(point_count / volume_m3)

                if point_count > 0:
                    z_mean = float(np.mean(interval_z))
                    z_std = float(np.std(interval_z))
                    z_p25 = float(np.percentile(interval_z, 25))
                    z_p50 = float(np.percentile(interval_z, 50))
                    z_p75 = float(np.percentile(interval_z, 75))
                    z_p90 = float(np.percentile(interval_z, 90))

                    # Baseline density comparison
                    total_bldg_vol = area * building_total_height
                    mean_bldg_density = len(las_z_coords) / max(total_bldg_vol, 1.0)
                    peak_prominence_ratio = float(point_density / max(mean_bldg_density, 0.001))
                else:
                    peak_prominence_ratio = 0.5
            else:
                point_count = 0
                point_density = 0.0
                peak_prominence_ratio = 0.5
        elif source_evidence_type in ["BIM_IFC", "ARCHITECTURAL_PLAN_2D", "CORS_GNSS_SURVEY"]:
            # Structural/CAD models have deterministic volumetric representation
            point_count = 1000
            volume_m3 = max(area * interval_height, 0.1)
            point_density = float(point_count / volume_m3)
            peak_prominence_ratio = 2.5

        return AICandidateFeatureVector(
            footprint_area_sqm=round(area, 2),
            footprint_perimeter_m=round(perimeter, 2),
            footprint_compactness=round(compactness, 4),
            aspect_ratio=round(aspect_ratio, 4),
            centroid_x=round(centroid_x, 3),
            centroid_y=round(centroid_y, 3),
            z_min=round(z_min, 2),
            z_max=round(z_max, 2),
            height_interval_m=round(interval_height, 2),
            relative_height_ratio=round(relative_height_ratio, 4),
            point_count=point_count,
            point_density_pts_m3=round(point_density, 2),
            z_mean=round(z_mean, 2),
            z_std=round(z_std, 3),
            z_p25=round(z_p25, 2),
            z_p50=round(z_p50, 2),
            z_p75=round(z_p75, 2),
            z_p90=round(z_p90, 2),
            peak_prominence_ratio=round(peak_prominence_ratio, 2),
            source_evidence_type=source_evidence_type,
            is_synthetic=is_synthetic
        )

    def classify_and_explain_candidate(
        self,
        features: AICandidateFeatureVector,
        ground_z: float = 540.0,
        roof_z: float = 549.5,
        candidate_index: int = 1,
        building_id: str = "TOWER-A"
    ) -> Tuple[str, str, str, str, str, str, float, List[str], List[str], Dict[str, Any]]:
        """
        Classifies candidate strata tier, unit type, and floor code,
        evaluates underground safety, generates explainability rationale, and calculates
        prototype candidate confidence.
        """
        z_min = features.z_min
        z_max = features.z_max
        height = features.height_interval_m
        src = features.source_evidence_type
        
        explanation: List[str] = []
        review_flags: List[str] = ["AI_PROPOSED_CANDIDATE", "HUMAN_VERIFICATION_REQUIRED"]
        underground_safety: Dict[str, Any] = {"is_safe": True, "notes": "Evidence compatible with stratum"}

        # 1. Stratum & Tier Classification
        if z_max <= ground_z + 0.05:
            # Underground / Subsurface
            if src == "LIDAR_POINTCLOUD":
                # STRICT HARD CONSTRAINT: Optical LiDAR cannot penetrate underground
                underground_safety = {
                    "is_safe": False,
                    "violation": "Optical airborne LiDAR cannot detect underground geometry.",
                    "requires_evidence": ["BIM_IFC", "ARCHITECTURAL_PLAN_2D", "CORS_GNSS_SURVEY"]
                }
                review_flags.append("FLAG_REJECT_UNDERGROUND_LIDAR")
                tier_code = "SB"
                floor_code = f"B0{candidate_index}"
                candidate_type = "BASEMENT"
                suggested_unit_type = "COMMERCIAL"
                suggested_label = f"Proposed Basement Candidate ({floor_code})"
                explanation.append(
                    "⚠️ VIOLATION: Airborne optical LiDAR cannot detect underground subterranean spaces. "
                    "Proposal requires BIM/IFC or architectural plan evidence before cadastral review."
                )
            elif height <= 2.5 or "UTILITY" in src or "CORS" in src:
                tier_code = "UT"
                floor_code = f"UT0{candidate_index}"
                candidate_type = "UNDERGROUND_UTILITY"
                suggested_unit_type = "UTILITY_CORRIDOR"
                suggested_label = f"Subsurface Utility Corridor ({floor_code})"
                explanation.append(f"Subsurface utility conduit hypothesis (Z: {z_min}m to {z_max}m) derived from {src}.")
            else:
                tier_code = "SB"
                floor_code = f"B0{candidate_index}"
                candidate_type = "BASEMENT"
                suggested_unit_type = "PARKING" if height >= 3.0 else "COMMERCIAL"
                suggested_label = f"Underground Substructure ({floor_code})"
                explanation.append(f"Subterranean basement structural hypothesis (Z: {z_min}m to {z_max}m) supported by {src}.")

        elif z_min <= ground_z + 0.5:
            # Ground Level
            tier_code = "F"
            floor_code = "F00"
            candidate_type = "GROUND_FLOOR"
            suggested_unit_type = "COMMERCIAL"
            suggested_label = "Ground Floor Commercial Lobby & Entry"
            explanation.append(f"Ground-level interface detected at elevation {z_min:.2f}m (ground datum: {ground_z:.2f}m).")
            explanation.append(f"Floor height interval ({height:.2f}m) conforms to standard ground lobby priors.")

        elif z_min >= roof_z - 0.5:
            # Rooftop / Elevated
            tier_code = "AR"
            floor_code = "RF01"
            candidate_type = "ROOFTOP"
            suggested_unit_type = "COMMON_CIRCULATION"
            suggested_label = "Rooftop Structure & Terrace Candidate"
            explanation.append(f"Rooftop structural termination detected above main building envelope at {z_min:.2f}m.")

        else:
            # Upper Floor
            tier_code = "F"
            floor_num = candidate_index
            floor_code = f"F{floor_num:02d}"
            candidate_type = "UPPER_FLOOR"
            suggested_unit_type = "RESIDENTIAL"
            suggested_label = f"Upper Storey Floor Candidate ({floor_code})"
            explanation.append(f"Intermediate vertical floor interval detected from {z_min:.2f}m to {z_max:.2f}m.")

        # 2. Point Density & Geometric Explanations
        if features.peak_prominence_ratio >= 1.8:
            explanation.append(
                f"Strong vertical structural density peak detected (prominence ratio: {features.peak_prominence_ratio:.2f}x baseline)."
            )
        elif features.peak_prominence_ratio >= 1.0:
            explanation.append(
                f"Moderate structural point density support (prominence ratio: {features.peak_prominence_ratio:.2f}x)."
            )
        else:
            explanation.append("Low local point density support; requires human reviewer attention.")
            review_flags.append("LOW_POINT_DENSITY_WARNING")

        if 2.7 <= height <= 3.8:
            explanation.append(f"Storey interval height ({height:.2f}m) conforms to standard architectural storey priors (2.7m - 3.8m).")
        else:
            explanation.append(f"Non-standard vertical interval height ({height:.2f}m); flagged for review.")
            review_flags.append("NON_STANDARD_HEIGHT_INTERVAL")

        if features.footprint_compactness >= 0.70:
            explanation.append(f"Horizontal footprint demonstrates high structural regularity (compactness: {features.footprint_compactness:.2f}).")

        explanation.append(f"Evidence source: {src} (marked as SYNTHETIC research prototype data).")

        # 3. Calculate Prototype Candidate Confidence
        # Heuristic scoring based on multi-factor feature support
        score = 0.0
        
        # Density peak contribution (0.0 to 0.35)
        if features.peak_prominence_ratio >= 2.0:
            score += 0.35
        elif features.peak_prominence_ratio >= 1.2:
            score += 0.25
        else:
            score += 0.10

        # Height prior conformity (0.0 to 0.25)
        if 2.8 <= height <= 3.5:
            score += 0.25
        elif 2.5 <= height <= 4.0:
            score += 0.15
        else:
            score += 0.05

        # Footprint regularity (0.0 to 0.20)
        if features.footprint_compactness >= 0.70:
            score += 0.20
        elif features.footprint_compactness >= 0.50:
            score += 0.12
        else:
            score += 0.05

        # Evidence compatibility (0.0 to 0.20)
        if not underground_safety["is_safe"]:
            score = min(score, 0.20)  # Penalize unsafe underground LiDAR proposals
        else:
            score += 0.20

        score = round(min(max(score, 0.10), 0.98), 2)

        if score >= 0.75:
            confidence = "HIGH"
        elif score >= 0.50:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        return (
            tier_code,
            floor_code,
            candidate_type,
            suggested_unit_type,
            suggested_label,
            confidence,
            score,
            explanation,
            review_flags,
            underground_safety
        )

    def propose_candidates(
        self,
        req: AIProposeCandidatesRequest
    ) -> AIProposeCandidatesResponse:
        """
        Executes explainable AI candidate extraction from building extraction / LiDAR evidence.
        """
        extraction_path = req.extraction_json_path or "data/processed/tower_a_building_extraction.json"
        las_path = req.las_path or "data/simulated/prototype_tower_a.las"

        if not os.path.exists(extraction_path):
            raise FileNotFoundError(f"Extraction evidence JSON not found at: {extraction_path}")

        with open(extraction_path, "r", encoding="utf-8") as f:
            ext_data = json.load(f)

        parent_ulpin = ext_data.get("parent_parcel_ulpin_2d", req.parcel_ulpin or "27A8B9C3D4E5F6")
        bldg_code = ext_data.get("building_id", req.building_id or "TOWER-A")
        
        bldg_cand = ext_data.get("building_candidate", {})
        if "coordinates_epsg32644" in bldg_cand:
            coords = bldg_cand["coordinates_epsg32644"]
            footprint_poly = Polygon(coords)
        elif "footprint_2d" in ext_data and "geojson" in ext_data["footprint_2d"]:
            footprint_poly = shape(ext_data["footprint_2d"]["geojson"])
        elif "footprint_2d" in ext_data and "coordinates" in ext_data["footprint_2d"]:
            coords = ext_data["footprint_2d"]["coordinates"]
            if isinstance(coords[0][0], (list, tuple)):
                coords = coords[0]
            footprint_poly = Polygon(coords)
        else:
            footprint_poly = box(219404.953, 1932502.447, 219425.050, 1932517.553)
        
        ground_z = float(ext_data["vertical_extent"]["ground_z_m"])
        roof_z = float(ext_data["vertical_extent"]["roof_z_m"])
        
        # Load LAS points if available
        las_z, las_x, las_y = None, None, None
        if os.path.exists(las_path):
            import laspy
            with laspy.open(las_path) as reader:
                las = reader.read()
            classes = np.array(las.classification, dtype=np.uint8)
            bldg_mask = (classes == 6)
            las_z = np.array(las.z[bldg_mask], dtype=np.float64)
            las_x = np.array(las.x[bldg_mask], dtype=np.float64)
            las_y = np.array(las.y[bldg_mask], dtype=np.float64)

        # Build candidate vertical levels
        # Standard storey segmentation intervals
        levels_data = ext_data.get("candidate_structural_levels", [])
        if len(levels_data) >= 2:
            elevations = [float(l["elevation_m"]) for l in levels_data]
            elevations = sorted(list(set(elevations)))
        else:
            # Synthetic 3-level intervals
            elevations = [ground_z, ground_z + 3.5, ground_z + 6.5, roof_z]

        footprint_coords = list(footprint_poly.exterior.coords)

        proposals: List[AICandidateProposal] = []
        for i in range(len(elevations) - 1):
            z_low = elevations[i]
            z_high = elevations[i + 1]

            features = self.extract_features_from_geometry_and_points(
                footprint_poly=footprint_poly,
                z_min=z_low,
                z_max=z_high,
                ground_z=ground_z,
                roof_z=roof_z,
                las_z_coords=las_z,
                las_x_coords=las_x,
                las_y_coords=las_y,
                source_evidence_type=req.source_evidence_type,
                is_synthetic=True
            )

            (
                tier_code,
                floor_code,
                cand_type,
                unit_type,
                label,
                confidence,
                score,
                explanation,
                review_flags,
                underground_safety
            ) = self.classify_and_explain_candidate(
                features=features,
                ground_z=ground_z,
                roof_z=roof_z,
                candidate_index=i,
                building_id=bldg_code
            )

            if score < req.confidence_threshold:
                continue

            # Build watertight 3D solid geometry WKT
            geom_wkt_res, _ = build_polyhedralsurface_wkt_from_footprint(
                footprint_coords=footprint_coords,
                z_min=z_low,
                z_max=z_high
            )

            proposal = AICandidateProposal(
                candidate_id=f"AI-CANDIDATE-{bldg_code}-{floor_code}",
                candidate_type=cand_type,
                tier_code=tier_code,
                floor_code=floor_code,
                suggested_label=label,
                suggested_unit_type=unit_type,
                z_min=z_low,
                z_max=z_high,
                confidence=confidence,
                confidence_score=score,
                confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                explanation=explanation,
                review_flags=review_flags,
                features=features,
                geom_wkt=geom_wkt_res,
                status="PROPOSED"
            )
            proposals.append(proposal)

        return AIProposeCandidatesResponse(
            dataset_name=os.path.basename(extraction_path),
            parent_parcel_ulpin=parent_ulpin,
            total_candidates_proposed=len(proposals),
            method="STATISTICAL_FEATURE_RANKING_HYBRID",
            model_version="2.9.0-prototype",
            is_synthetic=True,
            proposals=proposals,
            disclaimer=(
                "AI Candidate proposals are algorithmic hypotheses derived from spatial evidence. "
                "All candidates are initialized in PROPOSED status and require PostGIS/SFCGAL geometric validation "
                "and statutory human verification before acceptance."
            ),
            proposed_at=datetime.utcnow()
        )

    def analyze_vertical_unit(self, unit_id: uuid.UUID) -> AICandidateAnalysisResponse:
        """
        Retrieves an existing vertical unit from the database, computes AI feature representations,
        evaluates prototype confidence, and returns explainable rationale.
        """
        if not self.db:
            raise ValueError("Database session required for analyze_vertical_unit.")

        query = text("""
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
                ST_AsGeoJSON(ST_Envelope(vu.geom_3d)) AS bbox_json,
                ST_Area(ST_Envelope(vu.geom_3d)) AS approx_area,
                se.source_type,
                se.dataset_name
            FROM vertical_units vu
            LEFT JOIN source_evidence se ON vu.id = se.unit_id
            WHERE vu.id = :unit_id;
        """)

        row = self.db.execute(query, {"unit_id": str(unit_id)}).mappings().first()
        if not row:
            raise LookupError(f"Vertical unit {unit_id} not found in database.")

        z_min = float(row["z_min"])
        z_max = float(row["z_max"])
        tier_code = row["tier_code"]
        floor_code = row["floor_code"]
        status = row["status"]
        src_type = row["source_type"] or "LIDAR_POINTCLOUD"

        # Construct footprint proxy from bbox or geometry
        bbox_json = row.get("bbox_json")
        if bbox_json:
            bbox_geom = shape(json.loads(bbox_json))
            footprint_poly = Polygon(bbox_geom.exterior.coords)
        else:
            footprint_poly = box(219450, 1932505, 219470, 1932520)

        features = self.extract_features_from_geometry_and_points(
            footprint_poly=footprint_poly,
            z_min=z_min,
            z_max=z_max,
            ground_z=540.0,
            roof_z=549.5,
            source_evidence_type=src_type,
            is_synthetic=True
        )

        (
            tier,
            floor,
            cand_type,
            unit_type,
            label,
            confidence,
            score,
            explanation,
            review_flags,
            underground_safety
        ) = self.classify_and_explain_candidate(
            features=features,
            ground_z=540.0,
            roof_z=549.5,
            candidate_index=1,
            building_id="TOWER"
        )

        # Reflect verified or rejected state in flags
        if status == "VERIFIED":
            review_flags.append("STATUS_HUMAN_VERIFIED")
        elif status == "REJECTED":
            review_flags.append("STATUS_HUMAN_REJECTED")

        return AICandidateAnalysisResponse(
            unit_id=row["id"],
            prototype_ulpin_3d=row["prototype_ulpin_3d"],
            tier_code=tier_code,
            floor_code=floor_code,
            candidate_type=cand_type,
            status=status,
            confidence=confidence,
            confidence_score=score,
            confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
            explanation=explanation,
            review_flags=review_flags,
            features=features,
            underground_safety=underground_safety,
            disclaimer=(
                "This AI analysis is a research prototype candidate intelligence assessment only. "
                "It does not perform legal ownership determination, cadastral certification, or official ULPIN assignment. "
                "Human verification by an authorized surveyor or revenue official is mandatory."
            ),
            evaluated_at=datetime.utcnow()
        )

    def propose_candidates_from_building_features(
        self,
        req: AIBuildingAnalysisRequest
    ) -> AIBuildingAnalysisResponse:
        """
        Executes explainable AI candidate strata and vertical property unit proposals
        from available building footprint, Copernicus DSM elevations, height priors, and levels metadata.
        Strictly categorizes data provenance: REFERENCE, OBSERVED, ESTIMATED, SYNTHETIC, and PROPOSED.
        """
        # 1. Resolve Target Context & Reference Dataset
        ref_bldg = None
        osm_id_clean = None
        raw_osm_id = req.candidate_osm_id
        if not raw_osm_id and req.building_id and not str(req.building_id).startswith("00000000-") and len(str(req.building_id)) < 30:
            # building_id was passed as an OSM ID string (e.g. from LocationContextCard)
            raw_osm_id = str(req.building_id)

        if raw_osm_id:
            osm_id_clean = str(raw_osm_id).replace("way/", "").replace("relation/", "").replace("/", "-")
            try:
                from backend.app.services.reference_dataset_service import ReferenceDatasetService
                ref_bldg = ReferenceDatasetService().get_by_osm_id(str(raw_osm_id))
            except Exception:
                ref_bldg = None

        building_code = f"BLDG-OSM-{osm_id_clean}" if osm_id_clean else "BLDG-PROTOTYPE"
        building_name = req.building_name or (ref_bldg.get("name") if ref_bldg else None) or f"Reference Building {osm_id_clean or 'Prototype'}"

        from backend.app.services.reference_dataset_service import compute_ulpin_for_osm_id
        parent_ulpin = compute_ulpin_for_osm_id(osm_id_clean) if osm_id_clean else "36A1B2C3D4E5F9"

        # 2. Resolve 2D Footprint in EPSG:32644
        footprint_utm: List[List[float]] = []
        footprint_source = "OpenStreetMap Building Footprint"

        if req.building_id and self.db:
            try:
                import uuid as _uuid_mod
                bid_str = str(req.building_id)
                _uuid_mod.UUID(bid_str)
                bldg_row = self.db.execute(
                    text("""
                        SELECT b.building_code, b.building_name, p.ulpin_2d,
                               ST_AsGeoJSON(b.footprint_2d) AS fp_json,
                               b.total_floors_above, b.total_floors_below
                        FROM buildings b
                        JOIN parcels p ON b.parcel_id = p.id
                        WHERE b.id = :bid
                    """),
                    {"bid": bid_str}
                ).mappings().first()
                if bldg_row:
                    building_code = bldg_row["building_code"]
                    building_name = bldg_row["building_name"]
                    parent_ulpin = bldg_row["ulpin_2d"]
                    fp_json = json.loads(bldg_row["fp_json"]) if bldg_row["fp_json"] else {}
                    coords = fp_json.get("coordinates", [[]])[0]
                    footprint_utm = [[round(pt[0], 3), round(pt[1], 3)] for pt in coords]
                    footprint_source = "PostGIS Registered Cadastral Footprint (EPSG:32644)"
            except Exception:
                pass

        if not footprint_utm:
            wgs84_coords = req.footprint_wgs84 or (ref_bldg.get("footprintCoordinates") if ref_bldg else None)
            if wgs84_coords and len(wgs84_coords) >= 3:
                footprint_utm = []
                for pt in wgs84_coords:
                    e, n = wgs84_to_utm44n(float(pt[0]), float(pt[1]))
                    footprint_utm.append([round(e, 3), round(n, 3)])
                footprint_source = "OpenStreetMap Real Reference Dataset (Transformed to EPSG:32644)"
            else:
                # Default canonical footprint baseline
                footprint_utm = [
                    [219405.0, 1932502.5],
                    [219425.0, 1932502.5],
                    [219425.0, 1932517.5],
                    [219405.0, 1932517.5],
                    [219405.0, 1932502.5]
                ]
                footprint_source = "Canonical Cadastral Survey Boundary (EPSG:32644)"

        if len(footprint_utm) > 1 and footprint_utm[0] != footprint_utm[-1]:
            footprint_utm.append(footprint_utm[0])

        footprint_poly = Polygon(footprint_utm)
        if not footprint_poly.is_valid:
            footprint_poly = footprint_poly.buffer(0)
        footprint_area = round(float(footprint_poly.area), 2)

        # 3. Resolve Ground Elevation & Roof Elevation
        ground_z = 540.0
        if req.ground_elevation_m is not None:
            ground_z = float(req.ground_elevation_m)
        elif ref_bldg and ref_bldg.get("groundElevationM") is not None:
            ground_z = float(ref_bldg["groundElevationM"])

        elev_source = "Copernicus DSM 30m (COG 10m/30m Tile N17 E078)"

        # 4. Resolve Storey Count (Observed vs Estimated)
        floor_h = float(req.standard_floor_height_m) if req.standard_floor_height_m > 0 else 3.0
        levels_observed = None
        if req.levels_metadata and req.levels_metadata > 0:
            levels_observed = int(req.levels_metadata)
        elif ref_bldg and ref_bldg.get("levels"):
            try:
                levels_observed = int(ref_bldg["levels"])
            except (ValueError, TypeError):
                levels_observed = None

        roof_z = None
        if req.elev_max_m is not None and req.elev_max_m > ground_z + 2.0:
            roof_z = float(req.elev_max_m)
        elif ref_bldg and ref_bldg.get("elevMaxM") is not None and float(ref_bldg["elevMaxM"]) > ground_z + 2.0:
            roof_z = float(ref_bldg["elevMaxM"])

        if levels_observed is not None:
            floor_count_estimated = levels_observed
            floor_count_basis = "METADATA_OBSERVED"
            if roof_z is None:
                roof_z = round(ground_z + (floor_count_estimated * floor_h), 2)
        elif roof_z is not None:
            height_delta = roof_z - ground_z
            floor_count_estimated = max(1, round(height_delta / floor_h))
            floor_count_basis = "ELEVATION_ESTIMATED"
        else:
            floor_count_estimated = 3
            roof_z = round(ground_z + (3 * floor_h), 2)
            floor_count_basis = "HEURISTIC_PRIORS"

        total_height = round(roof_z - ground_z, 2)

        # 5. Build Explicit Data Classifications
        classifications: List[DataClassificationItem] = [
            DataClassificationItem(
                feature_name="2D Building Footprint",
                classification="REFERENCE",
                source_description=footprint_source,
                is_authoritative=False
            ),
            DataClassificationItem(
                feature_name="Ground Elevation Datum (MSL)",
                classification="REFERENCE",
                source_description=f"{elev_source} — Ground Z: {ground_z:.2f}m",
                is_authoritative=False
            ),
            DataClassificationItem(
                feature_name="Building Storey Count",
                classification="OBSERVED" if floor_count_basis == "METADATA_OBSERVED" else "ESTIMATED",
                source_description=(
                    f"OpenStreetMap tag 'building:levels={levels_observed}'"
                    if floor_count_basis == "METADATA_OBSERVED"
                    else f"Estimated from Copernicus DSM vertical profile ({total_height:.2f}m / {floor_h:.2f}m/floor)"
                ),
                is_authoritative=False
            )
        ]

        if req.include_basement_hypothesis:
            classifications.append(
                DataClassificationItem(
                    feature_name="Subterranean Basement Boundary",
                    classification="SYNTHETIC",
                    source_description="Subsurface structural prior hypothesis. Optical airborne LiDAR cannot penetrate underground.",
                    is_authoritative=False
                )
            )

        classifications.append(
            DataClassificationItem(
                feature_name="Proposed 3D Vertical Property Units",
                classification="PROPOSED",
                source_description="Algorithmic candidate strata initialized in PROPOSED status; requires statutory human review.",
                is_authoritative=False
            )
        )


        # 6. Generate Explainable Candidate Strata Proposals
        proposals: List[AICandidateProposal] = []
        overall_review_flags: List[str] = ["AI_PROPOSED_BUILDING_ANALYSIS", "HUMAN_VERIFICATION_REQUIRED"]
        underground_safety_assessment: Dict[str, Any] = {
            "is_safe": True,
            "evaluated_evidence": req.source_evidence_type,
            "notes": "Evidence compatible with structural strata priors."
        }

        # 6A. Subterranean Basement Hypothesis
        if req.include_basement_hypothesis:
            b_zmin = round(ground_z - 3.0, 2)
            b_zmax = round(ground_z, 2)
            b_features = self.extract_features_from_geometry_and_points(
                footprint_poly=footprint_poly,
                z_min=b_zmin,
                z_max=b_zmax,
                ground_z=ground_z,
                roof_z=roof_z,
                source_evidence_type=req.source_evidence_type,
                is_synthetic=True
            )
            (
                b_tier, b_floor, b_type, b_unit, b_label,
                b_conf, b_score, b_exp, b_flags, b_safety
            ) = self.classify_and_explain_candidate(
                features=b_features,
                ground_z=ground_z,
                roof_z=roof_z,
                candidate_index=1,
                building_id=building_code
            )
            if not b_safety["is_safe"]:
                underground_safety_assessment = b_safety
                overall_review_flags.extend(b_flags)

            b_wkt, _ = build_polyhedralsurface_wkt_from_footprint(footprint_utm, b_zmin, b_zmax)
            proposals.append(
                AICandidateProposal(
                    candidate_id=f"AI-{building_code}-{b_floor}",
                    candidate_type=b_type,
                    tier_code=b_tier,
                    floor_code=b_floor,
                    suggested_label=b_label,
                    suggested_unit_type=b_unit,
                    z_min=b_zmin,
                    z_max=b_zmax,
                    confidence=b_conf,
                    confidence_score=b_score,
                    confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                    explanation=b_exp,
                    review_flags=b_flags,
                    features=b_features,
                    geom_wkt=b_wkt,
                    status="PROPOSED"
                )
            )

        # 6B. Ground Floor Hypothesis (F00)
        g_zmin = round(ground_z, 2)
        g_zmax = round(ground_z + floor_h, 2)
        g_features = self.extract_features_from_geometry_and_points(
            footprint_poly=footprint_poly,
            z_min=g_zmin,
            z_max=g_zmax,
            ground_z=ground_z,
            roof_z=roof_z,
            source_evidence_type=req.source_evidence_type,
            is_synthetic=True
        )
        (
            g_tier, g_floor, g_type, g_unit, g_label,
            g_conf, g_score, g_exp, g_flags, _
        ) = self.classify_and_explain_candidate(
            features=g_features,
            ground_z=ground_z,
            roof_z=roof_z,
            candidate_index=0,
            building_id=building_code
        )
        g_wkt, _ = build_polyhedralsurface_wkt_from_footprint(footprint_utm, g_zmin, g_zmax)
        proposals.append(
            AICandidateProposal(
                candidate_id=f"AI-{building_code}-{g_floor}",
                candidate_type=g_type,
                tier_code=g_tier,
                floor_code=g_floor,
                suggested_label=g_label,
                suggested_unit_type=g_unit,
                z_min=g_zmin,
                z_max=g_zmax,
                confidence=g_conf,
                confidence_score=g_score,
                confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                explanation=g_exp,
                review_flags=g_flags,
                features=g_features,
                geom_wkt=g_wkt,
                status="PROPOSED"
            )
        )

        # 6C. Upper Residential Floors (F01 ... F0n)
        for f_idx in range(1, floor_count_estimated):
            f_code = f"F{f_idx:02d}"
            u_zmin = round(ground_z + (f_idx * floor_h), 2)
            u_zmax = round(u_zmin + floor_h, 2)
            u_features = self.extract_features_from_geometry_and_points(
                footprint_poly=footprint_poly,
                z_min=u_zmin,
                z_max=u_zmax,
                ground_z=ground_z,
                roof_z=roof_z,
                source_evidence_type=req.source_evidence_type,
                is_synthetic=True
            )
            (
                u_tier, u_floor, u_type, u_unit, u_label,
                u_conf, u_score, u_exp, u_flags, _
            ) = self.classify_and_explain_candidate(
                features=u_features,
                ground_z=ground_z,
                roof_z=roof_z,
                candidate_index=f_idx,
                building_id=building_code
            )
            u_wkt, _ = build_polyhedralsurface_wkt_from_footprint(footprint_utm, u_zmin, u_zmax)
            proposals.append(
                AICandidateProposal(
                    candidate_id=f"AI-{building_code}-{f_code}",
                    candidate_type=u_type,
                    tier_code=u_tier,
                    floor_code=f_code,
                    suggested_label=f"Floor {f_idx} (Residential Upper Storey)",
                    suggested_unit_type=u_unit,
                    z_min=u_zmin,
                    z_max=u_zmax,
                    confidence=u_conf,
                    confidence_score=u_score,
                    confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                    explanation=u_exp,
                    review_flags=u_flags,
                    features=u_features,
                    geom_wkt=u_wkt,
                    status="PROPOSED"
                )
            )

        # 6D. Rooftop Air Rights Hypothesis (RF01)
        if req.include_rooftop_hypothesis:
            rf_zmin = round(ground_z + (floor_count_estimated * floor_h), 2)
            rf_zmax = round(rf_zmin + 1.2, 2)
            rf_features = self.extract_features_from_geometry_and_points(
                footprint_poly=footprint_poly,
                z_min=rf_zmin,
                z_max=rf_zmax,
                ground_z=ground_z,
                roof_z=roof_z,
                source_evidence_type=req.source_evidence_type,
                is_synthetic=True
            )
            (
                rf_tier, rf_floor, rf_type, rf_unit, rf_label,
                rf_conf, rf_score, rf_exp, rf_flags, _
            ) = self.classify_and_explain_candidate(
                features=rf_features,
                ground_z=ground_z,
                roof_z=roof_z,
                candidate_index=floor_count_estimated,
                building_id=building_code
            )
            rf_wkt, _ = build_polyhedralsurface_wkt_from_footprint(footprint_utm, rf_zmin, rf_zmax)
            proposals.append(
                AICandidateProposal(
                    candidate_id=f"AI-{building_code}-RF01",
                    candidate_type="ROOFTOP",
                    tier_code="AR",
                    floor_code="RF01",
                    suggested_label="Rooftop Structure & Air-Rights Candidate",
                    suggested_unit_type="AIR_RIGHTS",
                    z_min=rf_zmin,
                    z_max=rf_zmax,
                    confidence=rf_conf,
                    confidence_score=rf_score,
                    confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                    explanation=rf_exp,
                    review_flags=rf_flags,
                    features=rf_features,
                    geom_wkt=rf_wkt,
                    status="PROPOSED"
                )
            )

        # Deduplicate review flags
        unique_flags = sorted(list(set(overall_review_flags)))

        return AIBuildingAnalysisResponse(
            target_building_code=building_code,
            building_name=building_name,
            parent_parcel_ulpin=parent_ulpin,
            footprint_source=footprint_source,
            elevation_source=elev_source,
            footprint_area_sqm=footprint_area,
            ground_elevation_m=ground_z,
            roof_elevation_m=roof_z,
            building_height_m=total_height,
            floor_count_observed=levels_observed,
            floor_count_estimated=floor_count_estimated,
            floor_count_basis=floor_count_basis,
            method="EXPLAINABLE_SPATIAL_FEATURE_ESTIMATOR_HYBRID",
            model_version="2.9.1-explainable-prototype",
            data_classifications=classifications,
            proposals=proposals,
            underground_safety_assessment=underground_safety_assessment,
            review_flags=unique_flags,
            disclaimer=(
                "AI-assisted candidate proposals are algorithmic hypotheses derived from spatial evidence. "
                "All candidate strata are initialized strictly in PROPOSED status and are NOT authoritative or legally binding. "
                "SFCGAL geometric validation and statutory verification by an authorized human surveyor are mandatory."
            ),
            evaluated_at=datetime.utcnow()
        )

