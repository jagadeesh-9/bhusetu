"""
SIH26011 Phase 3.12A: Schemas for Building-Level 3D ULPIN Generation Pipeline.
Defines input contract, generation parameters, and structured result models.
"""
import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class BuildingPrototypeGenerationRequest(BaseModel):
    """Input contract for building-level 3D ULPIN prototype generation."""
    building_id: Optional[uuid.UUID] = Field(None, description="UUID of existing registered building")
    building_code: Optional[str] = Field(None, description="Building identifier code")
    parcel_id: Optional[uuid.UUID] = Field(None, description="Parent parcel UUID")
    
    # Candidate reference building footprint (for generation from OSM discovery)
    candidate_osm_id: Optional[str] = Field(None, description="OSM Way ID for reference footprint")
    footprint_wgs84: Optional[List[List[float]]] = Field(None, description="[[lon, lat], ...] coordinates in WGS84")
    building_name: Optional[str] = Field("Prototype Building", description="Descriptive name for generated building")
    total_floors_above: Optional[int] = Field(3, ge=1, le=20, description="Number of above-ground storeys")
    total_floors_below: Optional[int] = Field(1, ge=0, le=4, description="Number of basement levels")

    # Vertical spatial strata parameters
    ground_elevation_m: float = Field(540.0, description="Prototype ground elevation datum Z in meters")
    floor_height_m: float = Field(3.0, gt=1.5, lt=6.0, description="Floor-to-floor vertical height in meters")
    basement_depth_m: float = Field(3.5, gt=1.5, lt=8.0, description="Basement depth in meters")
    include_rooftop: bool = Field(True, description="Whether to include elevated rooftop structure strata")
    subdivide_residential_floors: bool = Field(True, description="Whether to subdivide residential storeys into individual flats")
    flats_per_floor: int = Field(4, ge=1, le=8, description="Number of individual flat units per subdivided floor")
    
    # Metadata & Research flags
    provenance_notes: Optional[str] = Field(
        "Automated synthetic research prototype decomposition anchored to reference building footprint.",
        description="Lineage notes and processing justification"
    )
    is_synthetic_prototype: bool = Field(True, description="Must be true. Prototype does not determine statutory land title.")


class GeneratedUnitSummaryItem(BaseModel):
    """Summary of a generated 3D spatial unit."""
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    parent_unit_id: Optional[uuid.UUID] = None
    tier_code: str
    floor_code: str
    unit_level: str
    flat_number: Optional[str] = None
    unit_label: str
    unit_type: str
    z_min: float
    z_max: float
    volume_cum: float
    footprint_area_sqm: float
    status: str = "PROPOSED"
    is_solid: bool = True
    is_closed: bool = True


class BuildingPrototypeGenerationResponse(BaseModel):
    """Comprehensive structured response after generating building 3D cadastre."""
    status: str = "SUCCESS"
    building_id: uuid.UUID
    building_code: str
    building_name: str
    parcel_id: uuid.UUID
    parcel_ulpin_2d: str
    
    # Spatial Metrics
    footprint_area_sqm: float
    ground_elevation_m: float
    roof_elevation_m: float
    building_height_m: float
    envelope_volume_cum: float
    
    # Decomposition Counts
    total_storeys_generated: int
    total_flats_generated: int
    total_common_units_generated: int
    total_units_generated: int
    
    # Unit Details
    generated_units: List[GeneratedUnitSummaryItem]
    
    # Topology & Quality
    topology_valid: bool
    overlap_count: int = 0
    gaps_detected: bool = False
    
    # Governance & Provenance
    lifecycle_state: str = "PROPOSED"
    provenance_source: str = "SYNTHETIC_RESEARCH_PROTOTYPE"
    audit_action: str = "PROTOTYPE_GENERATION"
    disclaimer: str = (
        "Synthetic Research Prototype. Geometry and Prototype 3D ULPINs generated for "
        "3D cadastral visualization. Does not confer official Government of India land title "
        "or survey certification."
    )
