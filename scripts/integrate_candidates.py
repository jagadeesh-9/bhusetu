"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.5: Multi-Source 3D Candidate Unit Integration Script

Loads analytical 3D candidate unit datasets (e.g. data/processed/tower_a_3d_candidate_units.json)
and integrates them into the PostgreSQL/PostGIS lifecycle using CandidateIntegrationService.

DISCLAIMER:
Research Prototype only. Does not generate official Government of India
3D ULPINs, legally binding cadastral records, or official property titles.
"""
import os
import sys
import json
import argparse
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db import SessionLocal
from backend.app.services.candidate_integration_service import CandidateIntegrationService
from backend.app.schemas.candidate_integration import (
    CandidateIntegrationRequest,
    CandidateUnitPayload
)

load_dotenv()



def run_candidate_integration(
    candidate_json_path: str = "data/processed/tower_a_3d_candidate_units.json",
    source_type: str = "LIDAR_POINTCLOUD",
    dataset_name: str = "prototype_tower_a.las",
    file_uri: str = "data/simulated/prototype_tower_a.las"
) -> dict:
    """
    Executes idempotent candidate unit integration from an analytical 3D candidate dataset.
    """
    if not os.path.exists(candidate_json_path):
        raise FileNotFoundError(f"Candidate JSON not found at: {candidate_json_path}")

    with open(candidate_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    parent_parcel = data["parent_parcel_ulpin_2d"]
    building_id = data.get("building_id", "TOWER-A")
    raw_candidates = data["candidate_units"]

    payload_candidates = []
    for c in raw_candidates:
        payload_candidates.append(
            CandidateUnitPayload(
                candidate_key=f"{building_id}_{c['floor_code']}_{source_type}",
                floor_code=c["floor_code"],
                tier_code=c.get("tier_code", "F"),
                unit_label=f"Candidate Unit ({c['floor_code']}, {source_type})",
                unit_type="RESIDENTIAL",
                z_min=float(c["z_min"]),
                z_max=float(c["z_max"]),
                geom_wkt=c["wkt"],
                analytical_metadata=c.get("validation", {})
            )
        )

    req = CandidateIntegrationRequest(
        parcel_ulpin_2d=parent_parcel,
        building_code=building_id,
        source_type=source_type,
        dataset_name=dataset_name,
        file_uri=file_uri,
        accuracy_horizontal_m=0.05,
        accuracy_vertical_m=0.05,
        candidates=payload_candidates
    )

    db = SessionLocal()
    try:
        service = CandidateIntegrationService(db)
        res = service.integrate_candidates(req)
        return res.model_dump()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Integrate 3D candidate units into the vertical units lifecycle.")
    parser.add_argument("--candidate-json", default="data/processed/tower_a_3d_candidate_units.json", help="Path to candidate units JSON")
    parser.add_argument("--source-type", default="LIDAR_POINTCLOUD", help="Source type enum")
    parser.add_argument("--dataset-name", default="prototype_tower_a.las", help="Dataset filename")
    parser.add_argument("--file-uri", default="data/simulated/prototype_tower_a.las", help="Source file URI")
    args = parser.parse_args()

    result = run_candidate_integration(
        candidate_json_path=args.candidate_json,
        source_type=args.source_type,
        dataset_name=args.dataset_name,
        file_uri=args.file_uri
    )

    print("==========================================================")
    print("Multi-Source 3D Candidate Unit Integration Complete")
    print("==========================================================")
    print(f"Status: {result['status']}")
    print(f"Parent Parcel: {result['parcel_ulpin_2d']} | Building: {result['building_code']}")
    print(f"Source: {result['source_type']} ({result['dataset_name']})")
    print(f"Total Candidates Processed: {result['total_candidates_processed']}")
    print(f"Newly Created Units: {result['newly_created_count']}")
    print(f"Idempotent Existing Units: {result['idempotent_existing_count']}")
    print("Integrated Units:")
    for u in result["integrated_units"]:
        print(f"  - [{u['status']}] {u['prototype_ulpin_3d']} (Floor: {u['floor_code']}, Seq: {u['unit_sequence']}) | New: {u['is_newly_created']} | {u['message']}")
