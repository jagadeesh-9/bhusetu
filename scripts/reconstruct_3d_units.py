"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.4: 3D Volumetric Unit Reconstruction & Spatial Validation Engine

Constructs watertight PolyhedralSurface Z 3D solids from Phase 2.2 footprint and Phase 2.3
vertical intervals, and validates them via PostGIS/SFCGAL (closure, solidness, volume,
parcel containment, and volumetric collision vs adjacent boundary touching).

DISCLAIMER:
Research Prototype only. Does not generate official Government of India
3D ULPINs, legally binding property divisions, or cadastral titles.
"""
import os
import json
import argparse
from typing import List, Dict, Any, Tuple
import psycopg
from dotenv import load_dotenv

load_dotenv()


def build_polyhedralsurface_wkt_from_footprint(
    footprint_coords: List[List[float]],
    z_min: float,
    z_max: float
) -> Tuple[str, Dict[str, Any]]:
    """
    Extrudes a 2D closed polygon ring into a 3D closed PolyhedralSurface Z (B-Rep solid).
    Assumes footprint_coords is a closed ring [[x0, y0], [x1, y1], ..., [x0, y0]].
    """
    # Remove redundant closing point if present for facet indexing
    ring = [pt[:2] for pt in footprint_coords]
    if len(ring) > 1 and ring[0] == ring[-1]:
        pts_2d = ring[:-1]
    else:
        pts_2d = ring

    n = len(pts_2d)
    if n < 3:
        raise ValueError(f"Footprint requires at least 3 vertices to extrude, got {n}.")

    # Ensure counter-clockwise (CCW) winding for positive outward-facing normal orientations in SFCGAL
    signed_area = 0.5 * sum(
        pts_2d[i][0] * pts_2d[(i + 1) % n][1] - pts_2d[(i + 1) % n][0] * pts_2d[i][1]
        for i in range(n)
    )
    if signed_area < 0:
        pts_2d = list(reversed(pts_2d))

    # 1. Bottom Face (Z = z_min, oriented clockwise / down)
    bottom_ring = [[pts_2d[i][0], pts_2d[i][1], z_min] for i in range(n - 1, -1, -1)]
    bottom_ring.append(bottom_ring[0])  # Close ring

    # 2. Top Face (Z = z_max, oriented counter-clockwise / up)
    top_ring = [[pts_2d[i][0], pts_2d[i][1], z_max] for i in range(n)]
    top_ring.append(top_ring[0])  # Close ring

    # 3. Side Wall Facets (Spanning [z_min, z_max] between consecutive vertices)
    side_rings = []
    for i in range(n):
        next_i = (i + 1) % n
        p1 = pts_2d[i]
        p2 = pts_2d[next_i]
        wall_ring = [
            [p1[0], p1[1], z_min],
            [p2[0], p2[1], z_min],
            [p2[0], p2[1], z_max],
            [p1[0], p1[1], z_max],
            [p1[0], p1[1], z_min]
        ]
        side_rings.append(wall_ring)

    all_faces = [bottom_ring, top_ring] + side_rings

    # Format into WKT
    face_wkt_parts = []
    for face in all_faces:
        coords_str = ", ".join([f"{pt[0]} {pt[1]} {pt[2]}" for pt in face])
        face_wkt_parts.append(f"(({coords_str}))")

    wkt = f"POLYHEDRALSURFACE Z ({', '.join(face_wkt_parts)})"

    # Structured representation preserving 3D coordinates
    geom_struct = {
        "type": "PolyhedralSurface",
        "srid": 32644,
        "coordinates": [[face] for face in all_faces]
    }

    return wkt, geom_struct


def validate_3d_candidates_with_postgis(
    candidates: List[Dict[str, Any]],
    parent_parcel_ulpin: str,
    db_conn_str: str = None
) -> List[Dict[str, Any]]:
    """
    Executes read-only PostGIS/SFCGAL spatial validation on reconstructed 3D candidate units:
    Evaluates closedness, solid validity, positive volume, Z elevation consistency,
    parcel footprint containment, and pairwise 3D volumetric overlap vs boundary touching.
    """
    if not db_conn_str:
        db_conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
        if db_conn_str.startswith("postgresql+psycopg://"):
            db_conn_str = db_conn_str.replace("postgresql+psycopg://", "postgresql://")

    validated_units = []

    with psycopg.connect(db_conn_str) as conn:
        with conn.cursor() as cur:
            # Retrieve parent parcel 2D geometry for containment verification
            cur.execute("SELECT geom_2d FROM parcels WHERE ulpin_2d = %s;", [parent_parcel_ulpin])
            parcel_row = cur.fetchone()
            if not parcel_row:
                raise ValueError(f"Parent parcel '{parent_parcel_ulpin}' not found in database.")

            # Step A: Validate individual geometries
            for cand in candidates:
                wkt = cand["wkt"]
                cur.execute("""
                    SELECT 
                        ST_IsClosed(ST_GeomFromText(%s, 32644)) AS is_closed,
                        CG_IsSolid(CG_MakeSolid(ST_GeomFromText(%s, 32644))) AS is_solid,
                        ROUND(CG_Volume(CG_MakeSolid(ST_GeomFromText(%s, 32644)))::numeric, 4) AS volume_cbm,
                        ST_ZMin(ST_GeomFromText(%s, 32644)) AS z_min_geom,
                        ST_ZMax(ST_GeomFromText(%s, 32644)) AS z_max_geom,
                        ST_Within(ST_Envelope(ST_GeomFromText(%s, 32644)), (SELECT geom_2d FROM parcels WHERE ulpin_2d = %s)) AS is_within_parcel
                """, [wkt, wkt, wkt, wkt, wkt, wkt, parent_parcel_ulpin])

                row = cur.fetchone()
                is_closed, is_solid, volume_cbm, z_min_geom, z_max_geom, is_within_parcel = row

                cand_res = dict(cand)
                cand_res["validation"] = {
                    "closed": bool(is_closed),
                    "solid": bool(is_solid),
                    "positive_volume": bool(volume_cbm and volume_cbm > 0),
                    "measured_volume_cbm": float(volume_cbm or 0.0),
                    "z_min_geom": float(z_min_geom),
                    "z_max_geom": float(z_max_geom),
                    "z_range_consistent": (
                        abs(float(z_min_geom) - cand["z_min"]) <= 0.01 and
                        abs(float(z_max_geom) - cand["z_max"]) <= 0.01
                    ),
                    "parcel_contained": bool(is_within_parcel),
                    "conflicts": [],
                    "boundary_contacts": []
                }
                validated_units.append(cand_res)

            # Step B: Pairwise 3D Volumetric Intersection & Boundary Contact Evaluation
            num_units = len(validated_units)
            for i in range(num_units):
                for j in range(num_units):
                    if i == j:
                        continue
                    u1 = validated_units[i]
                    u2 = validated_units[j]

                    cur.execute("""
                        SELECT 
                            ST_3DIntersects(ST_GeomFromText(%s, 32644), ST_GeomFromText(%s, 32644)) AS boundary_intersects,
                            ROUND(COALESCE(CG_Volume(CG_3DIntersection(
                                CG_MakeSolid(ST_GeomFromText(%s, 32644)),
                                CG_MakeSolid(ST_GeomFromText(%s, 32644))
                            )), 0.0)::numeric, 4) AS overlap_volume
                    """, [u1["wkt"], u2["wkt"], u1["wkt"], u2["wkt"]])

                    b_intersects, overlap_vol = cur.fetchone()
                    overlap_vol = float(overlap_vol or 0.0)

                    # Collision threshold: > 0.001 m^3 (1 liter)
                    if overlap_vol > 0.001:
                        u1["validation"]["conflicts"].append({
                            "peer_floor_code": u2["floor_code"],
                            "overlap_volume_cbm": overlap_vol,
                            "is_volumetric_collision": True
                        })
                    elif b_intersects:
                        u1["validation"]["boundary_contacts"].append({
                            "peer_floor_code": u2["floor_code"],
                            "contact_type": "SHARED_BOUNDARY_FACE",
                            "overlap_volume_cbm": 0.0
                        })

                # Summarize conflict status
                u1["validation"]["has_conflict"] = len(u1["validation"]["conflicts"]) > 0

    return validated_units


def reconstruct_and_validate_3d_units(
    extraction_json_path: str = "data/processed/tower_a_building_extraction.json",
    segmentation_json_path: str = "data/processed/tower_a_vertical_segmentation.json",
    output_json_path: str = "data/processed/tower_a_3d_candidate_units.json"
) -> dict:
    """
    Complete Phase 2.4 pipeline: Extrudes 2D footprint across segmented vertical intervals,
    validates solids via PostGIS/SFCGAL, and outputs structured candidate units.
    """
    if not os.path.exists(extraction_json_path):
        raise FileNotFoundError(f"Extraction evidence not found at {extraction_json_path}")
    if not os.path.exists(segmentation_json_path):
        raise FileNotFoundError(f"Segmentation evidence not found at {segmentation_json_path}")

    with open(extraction_json_path, "r", encoding="utf-8") as f:
        p22 = json.load(f)
    with open(segmentation_json_path, "r", encoding="utf-8") as f:
        p23 = json.load(f)

    building_id = p22.get("building_id", "TOWER-A")
    parent_parcel = p22.get("parent_parcel_ulpin_2d", "27A8B9C3D4E5F6")
    crs = p22.get("crs", 32644)
    footprint_coords = p22["building_candidate"]["coordinates_epsg32644"]
    intervals = p23["vertical_intervals"]

    candidates = []
    for inv in intervals:
        z_min = float(inv["z_min"])
        z_max = float(inv["z_max"])
        height_m = float(inv["height_m"])
        floor_code = inv["floor_code"]
        seq = inv.get("sequence", 1)

        wkt, geom_struct = build_polyhedralsurface_wkt_from_footprint(
            footprint_coords=footprint_coords,
            z_min=z_min,
            z_max=z_max
        )

        candidates.append({
            "candidate_sequence": seq,
            "floor_code": floor_code,
            "tier_code": "ABOVE_GROUND",
            "z_min": z_min,
            "z_max": z_max,
            "height_m": height_m,
            "geometry_type": "PolyhedralSurface",
            "srid": crs,
            "wkt": wkt,
            "geometry_3d": geom_struct
        })

    # Validate with PostGIS/SFCGAL
    validated_candidates = validate_3d_candidates_with_postgis(
        candidates=candidates,
        parent_parcel_ulpin=parent_parcel
    )

    # Clean candidate unit records for persistence
    output_units = []
    for vc in validated_candidates:
        output_units.append({
            "candidate_sequence": vc["candidate_sequence"],
            "floor_code": vc["floor_code"],
            "tier_code": vc["tier_code"],
            "z_min": vc["z_min"],
            "z_max": vc["z_max"],
            "height_m": vc["height_m"],
            "geometry_type": vc["geometry_type"],
            "srid": vc["srid"],
            "wkt": vc["wkt"],
            "geometry_3d": vc["geometry_3d"],
            "validation": vc["validation"]
        })

    result = {
        "synthetic": True,
        "prototype_only": True,
        "building_id": building_id,
        "parent_parcel_ulpin_2d": parent_parcel,
        "crs": crs,
        "disclaimer": (
            "Research prototype 3D candidate unit reconstruction evidence. "
            "Not an official cadastral boundary, 3D ULPIN standard, or government title record."
        ),
        "reconstructed_unit_count": len(output_units),
        "candidate_units": output_units
    }

    if output_json_path:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reconstruct and spatially validate 3D volumetric units.")
    parser.add_argument("--extraction", default="data/processed/tower_a_building_extraction.json", help="Path to Phase 2.2 extraction JSON")
    parser.add_argument("--segmentation", default="data/processed/tower_a_vertical_segmentation.json", help="Path to Phase 2.3 segmentation JSON")
    parser.add_argument("--output", default="data/processed/tower_a_3d_candidate_units.json", help="Path to output candidate 3D units JSON")
    args = parser.parse_args()

    res = reconstruct_and_validate_3d_units(
        extraction_json_path=args.extraction,
        segmentation_json_path=args.segmentation,
        output_json_path=args.output
    )

    print("==========================================================")
    print("3D Volumetric Unit Reconstruction & Validation Complete")
    print("==========================================================")
    print(f"Building: {res['building_id']} | Parent Parcel: {res['parent_parcel_ulpin_2d']}")
    print(f"Total Candidate Units: {res['reconstructed_unit_count']}")
    for u in res["candidate_units"]:
        v = u["validation"]
        print(f"  Unit {u['floor_code']}: Z=[{u['z_min']:.2f} -> {u['z_max']:.2f}] m | Volume = {v['measured_volume_cbm']:.2f} m^3 | Solid = {v['solid']} | Enclosed in Parcel = {v['parcel_contained']} | Conflict = {v['has_conflict']}")
    print(f"Output saved to: {args.output}")
