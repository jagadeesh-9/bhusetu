"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.9: Explainable AI-Assisted 3D Candidate Proposer CLI

Consumes Phase 2.2 building extraction and LiDAR point clouds to generate
explainable AI-assisted 3D candidate proposals with feature representations
and prototype confidence scores.

DISCLAIMER:
Research Prototype Only.
Algorithmic candidate proposals are unverified hypotheses and MUST undergo
PostGIS/SFCGAL geometric validation and statutory human verification.
"""
import os
import sys
import json
import argparse
from datetime import datetime

sys.path.insert(0, os.path.abspath("."))
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.requests import AIProposeCandidatesRequest


def run_ai_candidate_proposer(
    extraction_json_path: str = "data/processed/tower_a_building_extraction.json",
    las_path: str = "data/simulated/prototype_tower_a.las",
    output_json_path: str = "data/processed/tower_a_ai_candidate_proposals.json",
    confidence_threshold: float = 0.50
) -> dict:
    print("--- SIH26011 Phase 2.9: Explainable AI Candidate Proposer ---")
    print(f"Extraction Evidence : {extraction_json_path}")
    print(f"Point Cloud Input   : {las_path}")
    print(f"Confidence Threshold: {confidence_threshold}")

    service = AICandidateService()
    req = AIProposeCandidatesRequest(
        extraction_json_path=extraction_json_path,
        las_path=las_path,
        confidence_threshold=confidence_threshold
    )

    response = service.propose_candidates(req)
    out_dict = response.model_dump(mode="json")

    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(out_dict, f, indent=2)

    print(f"Proposals Generated : {response.total_candidates_proposed}")
    for p in response.proposals:
        print(f"  - [{p.confidence}] {p.candidate_id} | {p.floor_code} ({p.candidate_type}) | Z: {p.z_min:.2f}m - {p.z_max:.2f}m")
        for exp in p.explanation[:2]:
            print(f"      {exp}")

    print(f"Saved proposals to  : {output_json_path}")
    return out_dict


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SIH26011 Explainable AI Candidate Proposer")
    parser.add_argument("--extraction", default="data/processed/tower_a_building_extraction.json")
    parser.add_argument("--las", default="data/simulated/prototype_tower_a.las")
    parser.add_argument("--output", default="data/processed/tower_a_ai_candidate_proposals.json")
    parser.add_argument("--threshold", type=float, default=0.50)
    args = parser.parse_args()

    run_ai_candidate_proposer(
        extraction_json_path=args.extraction,
        las_path=args.las,
        output_json_path=args.output,
        confidence_threshold=args.threshold
    )
