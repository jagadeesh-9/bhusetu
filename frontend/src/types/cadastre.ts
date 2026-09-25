/**
 * Type definitions for SIH26011 3D Cadastral Visualization.
 */

export interface GeometryPayload {
  srid: number;
  geometry_type: string;
  geojson: {
    type: string;
    coordinates: any[];
  };
  ewkt?: string;
}

export interface Parcel {
  id: string;
  ulpin_2d: string;
  survey_number: string;
  district: string;
  state: string;
  village_code?: string;
  area_sqm: number;
  geom_2d: GeometryPayload;
  building_count: number;
  vertical_unit_count: number;
  created_at: string;
}

export interface Building {
  id: string;
  parcel_id: string;
  building_code: string;
  building_name: string;
  total_floors_above: number;
  total_floors_below: number;
  footprint_2d: GeometryPayload;
  envelope_3d?: GeometryPayload;
  unit_count: number;
  created_at: string;
}

export interface SourceEvidence {
  id: string;
  source_type: string;
  dataset_name: string;
  file_uri: string;
  accuracy_horizontal_m?: number;
  accuracy_vertical_m?: number;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface VerificationAudit {
  id: string;
  action: string;
  previous_status: string;
  new_status: string;
  reviewer_name: string;
  reviewer_role: string;
  review_notes?: string;
  integrity_hash?: string;
  timestamp: string;
}

export interface VerticalTaxonomyClassification {
  category: "UNDERGROUND" | "GROUND" | "UPPER_FLOORS" | "ROOFTOP_ELEVATED" | "COMMON" | "OTHER";
  category_label: string;
  unit_class: string;
  unit_class_label: string;
}

export interface VerticalUnit {
  id: string;
  parcel_id: string;
  building_id?: string;
  prototype_ulpin_3d: string;
  tier_code: string; // SB, UT, F, AE, AR, CM
  floor_code: string; // UT01, B01, F00, F01, F02, RF01, AE01, CM01
  unit_sequence: number;
  unit_label: string;
  unit_type: string;
  z_min: number;
  z_max: number;
  status: "PROPOSED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
  geom_3d: GeometryPayload;
  taxonomy?: VerticalTaxonomyClassification;
  source_evidence?: SourceEvidence[];
  verification_audit?: VerificationAudit[];
  // Phase 3.10: Sub-unit / Flat-level properties
  parent_unit_id?: string | null;
  unit_level?: "STOREY" | "FLAT" | "COMMON_CIRCULATION" | "COMMERCIAL_UNIT" | "PARKING_SLOT" | string;
  flat_number?: string | null;
  sub_units?: VerticalUnit[];
}

export interface VerticalCategoryGroup {
  category_code: string;
  category_label: string;
  unit_count: number;
  z_min: number;
  z_max: number;
  units: VerticalUnit[];
}

export interface VerticalStructureResponse {
  parcel_id: string;
  parcel_ulpin_2d: string;
  total_units: number;
  categories: VerticalCategoryGroup[];
  prototype_note: string;
  evaluated_at: string;
}

export interface CheckItem {
  check: string;
  passed: boolean;
  message: string;
}

export interface ConflictItem {
  conflicting_unit_id: string;
  conflicting_prototype_ulpin_3d: string;
  overlap_volume_cbm: number;
  description: string;
}

export interface ValidationResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  status: string;
  is_valid: boolean;
  checks: CheckItem[];
  conflicts: ConflictItem[];
  evaluated_at: string;
}

export interface CutawayState {
  enabled: boolean;
  xPlaneEnabled: boolean;
  xPosition: number; // East-West cut offset in meters
  yPlaneEnabled: boolean;
  yPosition: number; // North-South cut offset in meters
  zPlaneEnabled: boolean;
  zPosition: number; // Elevation cut in meters
}

export type MeasurementMode = "OFF" | "DISTANCE_3D" | "DISTANCE_HORIZONTAL" | "DELTA_Z";

export interface MeasuredPoint {
  easting: number; // EPSG:32644 (meters)
  northing: number; // EPSG:32644 (meters)
  elevation: number; // Prototype vertical elevation (meters)
  longitude: number; // WGS84 (degrees)
  latitude: number; // WGS84 (degrees)
}

export interface MeasurementResult {
  distance3D?: number;
  horizontalDistance?: number;
  deltaZ?: number;
}

export interface MeasurementState {
  mode: MeasurementMode;
  pointA: MeasuredPoint | null;
  pointB: MeasuredPoint | null;
  result: MeasurementResult | null;
  statusMessage?: string | null;
}

export interface CoordinateHUDState {
  enabled: boolean;
  currentCoords: MeasuredPoint | null;
}

export interface LayerVisibility {
  parcel: boolean;
  building: boolean;
  groundFloors: boolean;
  upperFloors: boolean;
  basements: boolean;
  utilities: boolean;
  rooftopElevated: boolean;
  commonCirculation: boolean;
  undergroundMode: boolean;
  wireframeMode: boolean;
  elevationLevels: boolean;
  // Phase 3.2: Lifecycle, Quality & Spatial Slice Filters
  showVerified: boolean;
  showProposed: boolean;
  showUnderReview: boolean;
  showRejected: boolean;
  showConflictsOnly: boolean;
  sliceMode: boolean;
  sliceMinZ: number;
  sliceMaxZ: number;
  // Phase 3.6A: Interactive 3D Sectional Cutaway & Orthogonal Clipping
  cutaway: CutawayState;
  // Phase 3.6B: Interactive 3D Measurement & Coordinate Interrogation
  measurement: MeasurementState;
  coordHUD: CoordinateHUDState;
}

export interface ProvenanceStep {
  step_number: number;
  stage: string;
  name: string;
  status: string;
  details: string;
  timestamp?: string;
}

export interface EvidenceDetailItem {
  id: string;
  source_type: string;
  dataset_name: string;
  file_uri: string;
  accuracy_horizontal_m?: number;
  accuracy_vertical_m?: number;
  sensor_category: string;
  is_synthetic: boolean;
  assessment_level: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  assessment_rationale: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface UnitEvidenceProvenanceResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  floor_code: string;
  tier_code: string;
  status: string;
  overall_assessment_level: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  overall_assessment_label: string;
  is_synthetic_prototype: boolean;
  is_underground: boolean;
  underground_provenance_note?: string;
  evidence_count: number;
  evidence_records: EvidenceDetailItem[];
  provenance_pipeline: ProvenanceStep[];
  disclaimer: string;
  evaluated_at: string;
}

export interface AICandidateFeatureVector {
  footprint_area_sqm: number;
  footprint_perimeter_m: number;
  footprint_compactness: number;
  aspect_ratio: number;
  centroid_x: number;
  centroid_y: number;
  z_min: number;
  z_max: number;
  height_interval_m: number;
  relative_height_ratio: number;
  point_count: number;
  point_density_pts_m3: number;
  z_mean: number;
  z_std: number;
  z_p25: number;
  z_p50: number;
  z_p75: number;
  z_p90: number;
  peak_prominence_ratio: number;
  source_evidence_type: string;
  is_synthetic: boolean;
}

export interface AICandidateAnalysisResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  tier_code: string;
  floor_code: string;
  candidate_type: string;
  status: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidence_score: number;
  confidence_label: string;
  explanation: string[];
  review_flags: string[];
  features: AICandidateFeatureVector;
  underground_safety: {
    is_safe: boolean;
    violation?: string;
    requires_evidence?: string[];
    notes?: string;
  };
  disclaimer: string;
  evaluated_at: string;
}

// ============================================================================
// Phase 3.0: 3D Topology & Spatial Quality-Control Interfaces
// ============================================================================

export interface TopologySolidValidation {
  unit_id?: string;
  prototype_ulpin_3d?: string;
  is_closed: boolean;
  is_solid: boolean;
  volume_cbm: number;
  z_min_geom: number;
  z_max_geom: number;
  z_min_meta: number;
  z_max_meta: number;
  validity_code: "VALID_SOLID" | "INVALID_CLOSEDNESS" | "INVALID_SOLID" | "NON_POSITIVE_VOLUME" | "INVALID_Z_RANGE";
  is_valid: boolean;
  details: string;
}

export interface TopologyPairwiseRelationship {
  unit_a_id: string;
  unit_a_ulpin: string;
  unit_b_id: string;
  unit_b_ulpin: string;
  relationship_code: "DISJOINT" | "BOUNDARY_CONTACT" | "POSITIVE_VOLUME_OVERLAP" | "DUPLICATE_SPATIAL_REPRESENTATION";
  overlap_volume_cbm: number;
  has_surface_contact: boolean;
  shared_z_interval: boolean;
  severity: "INFO" | "WARNING" | "ERROR";
  description: string;
}

export interface TopologyVerticalContinuityItem {
  unit_id: string;
  prototype_ulpin_3d: string;
  floor_code: string;
  z_min: number;
  z_max: number;
  relation_to_lower_unit: "GROUND_BASE" | "CONTIGUOUS" | "VERTICAL_GAP" | "VERTICAL_OVERLAP" | "OUT_OF_ORDER" | "SUBTERRANEAN_INTERFACE";
  gap_or_overlap_m: number;
  severity: "INFO" | "WARNING" | "ERROR";
  details: string;
}

export interface TopologyContainmentFinding {
  unit_id: string;
  prototype_ulpin_3d: string;
  is_within_parcel: boolean;
  is_within_building?: boolean;
  status: "CONTAINED" | "OUTSIDE_PARENT" | "PARTIAL_OUTSIDE_PARENT";
  severity: "INFO" | "ERROR";
  message: string;
}

export interface UnitTopologyReportResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  parcel_id: string;
  building_id?: string;
  overall_quality_status: "VALID" | "REVIEW_REQUIRED" | "CONFLICT";
  solid_validation: TopologySolidValidation;
  containment: TopologyContainmentFinding;
  vertical_continuity: TopologyVerticalContinuityItem;
  peer_relationships: TopologyPairwiseRelationship[];
  conflict_count: number;
  warning_count: number;
  disclaimer: string;
  audited_at: string;
}

export interface ParcelTopologyReportResponse {
  parcel_id: string;
  parcel_ulpin: string;
  total_units_audited: number;
  overall_topology_status: "VALID" | "REVIEW_REQUIRED" | "CONFLICT";
  valid_unit_count: number;
  conflict_count: number;
  warning_count: number;
  pairwise_relationships: TopologyPairwiseRelationship[];
  containment_findings: TopologyContainmentFinding[];
  vertical_continuity_analysis: TopologyVerticalContinuityItem[];
  solid_validations: TopologySolidValidation[];
  disclaimer: string;
  audited_at: string;
}

// ============================================================================
// Phase 3.1: Human Review Workspace Types
// ============================================================================

export interface AuditHistoryItem {
  id: string;
  action: string;
  previous_status?: string;
  new_status: string;
  actor_role: string;
  reviewer_name?: string;
  review_notes?: string;
  integrity_hash?: string;
  timestamp: string;
}

export interface ReviewReadinessItem {
  code: string;
  label: string;
  passed: boolean;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
}

export interface ReviewReadinessSummary {
  overall_readiness: "READY_FOR_HUMAN_REVIEW" | "REVIEW_REQUIRES_ATTENTION" | "BLOCKED_INVALID_GEOMETRY";
  passed_count: number;
  warning_count: number;
  error_count: number;
  items: ReviewReadinessItem[];
}

export interface UnitReviewCaseResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  parcel_id: string;
  parcel_ulpin_2d: string;
  building_id?: string;
  building_name?: string;
  tier_code: string;
  floor_code: string;
  unit_label?: string;
  unit_type: string;
  status: string;
  z_min: number;
  z_max: number;
  height_m: number;
  volume_cbm: number;
  ewkt_3d?: string;

  topology: UnitTopologyReportResponse;
  evidence: UnitEvidenceProvenanceResponse;
  ai_analysis?: AICandidateAnalysisResponse;
  readiness: ReviewReadinessSummary;
  audit_history: AuditHistoryItem[];
  available_actions: string[];

  disclaimer: string;
  generated_at: string;
}

export interface VerticalUnitTransitionRequest {
  new_status: string;
  actor_role: "HUMAN_REVIEWER" | "LICENSED_SURVEYOR" | "REVENUE_OFFICIAL" | "SYSTEM_VALIDATOR";
  reviewer_name?: string;
  review_notes?: string;
  rejection_reason_code?: "GEOMETRY_INVALID" | "SPATIAL_CONFLICT" | "INSUFFICIENT_EVIDENCE" | "INCORRECT_VERTICAL_BOUNDARY" | "INCORRECT_UNIT_TYPE" | "OTHER";
  action?: string;
}

// ============================================================================
// Phase 3.2: 3D Cadastral Dataset Management & Spatial Navigation Types
// ============================================================================

export interface ParcelBuildingSummary {
  id: string;
  building_code: string;
  building_name: string;
  total_floors_above: number;
  total_floors_below: number;
  unit_count: number;
}

export interface ParcelUnitOverviewItem {
  id: string;
  prototype_ulpin_3d: string;
  building_id?: string;
  tier_code: string;
  floor_code: string;
  unit_label: string;
  unit_type: string;
  taxonomy_category?: string;
  status: string;
  z_min: number;
  z_max: number;
  height_m: number;
  volume_cbm: number;
  evidence_count: number;
  has_conflicts: boolean;
  conflict_count: number;
  is_solid: boolean;
}

export interface DatasetStatistics {
  total_units: number;
  total_buildings: number;
  status_counts: Record<string, number>;
  taxonomy_counts: Record<string, number>;
  total_modeled_volume_cbm: number;
  elevation_extent: {
    z_min: number;
    z_max: number;
    total_height_m: number;
  };
  underground_units_count: number;
  above_ground_units_count: number;
}

export interface DatasetQualityScorecardItem {
  metric_key: string;
  metric_name: string;
  passed_count: number;
  total_count: number;
  pass_rate_percent: number;
  status: "OPTIMAL" | "ATTENTION" | "CRITICAL";
  details: string;
}

export interface DatasetQualityScorecard {
  overall_status: "OPTIMAL" | "ATTENTION" | "CRITICAL";
  geometry_total: number;
  scorecard_items: DatasetQualityScorecardItem[];
}

export interface DatasetConsistencyFinding {
  check_id: string;
  title: string;
  severity: "INFO" | "WARNING" | "ERROR";
  status: "PASSED" | "FAILED" | "WARNING";
  affected_count: number;
  details: string;
}

export interface Parcel3DOverviewResponse {
  parcel_id: string;
  parcel_ulpin_2d: string;
  survey_number: string;
  district: string;
  state: string;
  village_code?: string;
  area_sqm: number;
  crs: string;
  buildings: ParcelBuildingSummary[];
  units: ParcelUnitOverviewItem[];
  statistics: DatasetStatistics;
  quality_scorecard: DatasetQualityScorecard;
  consistency_findings: DatasetConsistencyFinding[];
  disclaimer: string;
  audited_at: string;
}

export interface UnitNeighborItem {
  id: string;
  prototype_ulpin_3d: string;
  unit_label: string;
  tier_code: string;
  floor_code: string;
  status: string;
  z_min: number;
  z_max: number;
  relationship: "ABOVE" | "BELOW" | "ADJACENT_LATERAL" | "INTERSECTING" | "OVERLAPPING";
  distance_or_gap_m: number;
  has_spatial_contact: boolean;
}

// Phase 3.3 Real-World Ingestion & Source Standardization Types
export interface SourceManifestItem {
  source_name: string;
  source_type: string;
  format: string;
  original_crs?: string;
  normalized_crs: string;
  fingerprint_sha256: string;
  processing_status: string;
  quality_flags: string[];
  metadata?: Record<string, any>;
  geometry_summary?: Record<string, any>;
  disclaimer: string;
  evaluated_at: string;
}

export interface IngestionValidationRequest {
  source_type: string;
  source_crs?: number;
  target_crs?: number;
  filename?: string;
  data_payload?: string;
  metadata_json?: Record<string, any>;
}

export interface IngestionValidationResponse {
  status: "VALIDATED" | "RECOGNIZED_DEFERRED" | "REJECTED" | "WARNING";
  source_type: string;
  source_crs?: number;
  target_crs: number;
  transformed: boolean;
  feature_count: number;
  geometry_valid: boolean;
  geometry_summary?: Record<string, any>;
  fingerprint_sha256?: string;
  quality_flags: string[];
  manifest?: SourceManifestItem;
  message: string;
  errors: string[];
  evaluated_at: string;
}

export interface SourceRegistrationRequest {
  source_type: string;
  dataset_name?: string;
  filename?: string;
  source_crs?: number;
  target_crs?: number;
  data_payload?: string;
  metadata_json?: Record<string, any>;
  parcel_ulpin_2d?: string;
  building_code?: string;
  generate_candidates?: boolean;
  subterranean_evidence_type?: string;
}

export interface SourceRegistrationResponse {
  status: "SUCCESS" | "DEFERRED" | "REJECTED" | "DUPLICATE_SOURCE";
  source_id?: string;
  source_type: string;
  dataset_name: string;
  fingerprint_sha256: string;
  normalized_crs: string;
  quality_flags: string[];
  processing_status: string;
  candidates_generated: number;
  candidate_unit_ids: string[];
  message: string;
  errors: string[];
  manifest?: SourceManifestItem;
  registered_at: string;
}

// Phase 3.5 Multi-Source Evidence Fusion Types
export type EvidenceDimensionLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type SourcePresenceLevel = "NONE" | "LIMITED" | "ADEQUATE" | "MULTI_SOURCE";
export type AgreementStatus = "AGREEMENT" | "MINOR_DISCREPANCY" | "CONFLICT" | "NOT_COMPARABLE";
export type ConflictSeverity = "ERROR" | "WARNING" | "INFO";
export type ConflictCode =
  | "HEIGHT_CONFLICT"
  | "FOOTPRINT_CONFLICT"
  | "Z_RANGE_CONFLICT"
  | "CRS_UNCERTAIN"
  | "PROVENANCE_INCOMPLETE"
  | "UNDERGROUND_EVIDENCE_MISSING"
  | "TOPOLOGY_CONFLICT"
  | "UNSUPPORTED_SOURCE_CLAIM";

export interface EvaluatedSourceRecord {
  id: string;
  source_type: string;
  dataset_name: string;
  file_uri: string;
  accuracy_horizontal_m?: number;
  accuracy_vertical_m?: number;
  sensor_category: string;
  crs: string;
  sha256_hash?: string;
  provenance_quality: EvidenceDimensionLevel;
  supported_claims: string[];
  unsupported_claims: string[];
  is_synthetic: boolean;
  created_at: string;
}

export interface AgreementComparisonItem {
  measurement_name: string;
  source_a_type: string;
  source_a_val: number;
  source_b_type: string;
  source_b_val: number;
  difference: number;
  tolerance: number;
  unit_of_measure: string;
  status: AgreementStatus;
  notes: string;
}

export interface ConflictNoticeItem {
  code: ConflictCode;
  severity: ConflictSeverity;
  affected_attribute: string;
  source_a: string;
  source_b?: string;
  measured_values?: Record<string, any>;
  configured_tolerance?: string;
  recommendation: string;
}

export interface EvidenceDimensionBreakdown {
  source_presence: SourcePresenceLevel;
  source_presence_reason: string;
  provenance_quality: EvidenceDimensionLevel;
  provenance_quality_reason: string;
  geometry_support: EvidenceDimensionLevel;
  geometry_support_reason: string;
  vertical_support: EvidenceDimensionLevel;
  vertical_support_reason: string;
  source_agreement: EvidenceDimensionLevel;
  source_agreement_reason: string;
  evidence_completeness: EvidenceDimensionLevel;
  evidence_completeness_reason: string;
  underground_safety: EvidenceDimensionLevel;
  underground_safety_reason: string;
}

export interface UnitEvidenceFusionResponse {
  unit_id: string;
  prototype_ulpin_3d: string;
  status: string;
  floor_code: string;
  tier_code: string;
  is_underground: boolean;
  overall_confidence: EvidenceDimensionLevel;
  overall_confidence_label: string;
  assessment_method: string;
  dimensions: EvidenceDimensionBreakdown;
  sources: EvaluatedSourceRecord[];
  comparisons: AgreementComparisonItem[];
  conflicts: ConflictNoticeItem[];
  reviewer_attention: string[];
  topology_summary?: Record<string, any>;
  underground_warnings: string[];
  disclaimer: string;
  evaluated_at: string;
}

// Phase 3.6D: Prototype Technical Review Dossier Types
export interface DossierParcelContext {
  id: string;
  ulpin_2d: string;
  survey_number: string;
  district: string;
  state: string;
  village_code?: string;
  area_sqm: number;
}

export interface DossierBuildingContext {
  id?: string;
  building_code?: string;
  building_name?: string;
  total_floors_above?: number;
  total_floors_below?: number;
}

export interface DossierUnitIdentity {
  id: string;
  prototype_ulpin_3d: string;
  tier_code: string;
  floor_code: string;
  unit_sequence: number;
  unit_label: string;
  unit_type: string;
  status: string;
  identifier_notice: string;
}

export interface DossierGeometrySummary {
  crs: string;
  srid: number;
  z_min: number;
  z_max: number;
  modeled_vertical_height_m: number;
  volume_cbm: number;
  surface_area_sqm?: number;
  face_count?: number;
  geometry_type: string;
  is_closed: boolean;
  is_solid: boolean;
  is_within_parcel: boolean;
  z_terminology_note: string;
}

export interface DossierEvidenceItem {
  id: string;
  source_type: string;
  dataset_name: string;
  file_uri: string;
  accuracy_horizontal_m?: number;
  accuracy_vertical_m?: number;
  sensor_category: string;
  is_synthetic: boolean;
  assessment_level: string;
  assessment_rationale: string;
  geometry_status: string;
  geometry_notice: string;
  sensor_capability_notice?: string;
  sha256_fingerprint?: string;
  fingerprint_notice: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface DossierSourceEvidenceSection {
  evidence_count: number;
  evidence_records: DossierEvidenceItem[];
  provenance_pipeline: ProvenanceStep[];
  disclaimer: string;
}

export interface DossierLifecycleSection {
  current_status: string;
  overall_readiness: string;
  passed_count: number;
  warning_count: number;
  error_count: number;
  readiness_items: ReviewReadinessItem[];
  permitted_verification_roles: string[];
  governance_notice: string;
}

export interface DossierAIContextSection {
  has_analysis: boolean;
  advisory_notice: string;
  analysis?: AICandidateAnalysisResponse;
}

export interface PrototypeTechnicalReviewDossier {
  dossier_version: string;
  generated_at: string;
  prototype_notice: string;
  parcel: DossierParcelContext;
  building: DossierBuildingContext;
  unit_identity: DossierUnitIdentity;
  geometry_summary: DossierGeometrySummary;
  taxonomy: VerticalTaxonomyClassification;
  lifecycle: DossierLifecycleSection;
  source_evidence: DossierSourceEvidenceSection;
  evidence_fusion: UnitEvidenceFusionResponse;
  topology: UnitTopologyReportResponse;
  ai_context: DossierAIContextSection;
  review_history: AuditHistoryItem[];
  limitations: string[];
}

export interface LocationSearchResult {
  id: string;
  displayName: string;
  shortAddress?: string;
  latitude: number;
  longitude: number;
  boundingBox?: [number, number, number, number]; // [minLat, maxLat, minLon, maxLon]
  osmId?: string;
  osmType?: string;
  category?: string;
  type?: string;
  modelAvailable: boolean;
  buildingCode?: string;
  parcelId?: string;
  isReferenceBuilding?: boolean;
  attribution: string;
}

export interface LocationSearchState {
  query: string;
  results: LocationSearchResult[];
  selectedResult: LocationSearchResult | null;
  isLoading: boolean;
  error: string | null;
}

export interface BuildingCandidate {
  id: string;
  osmId: string;
  osmType?: "way" | "relation" | "node" | string;
  source: "OpenStreetMap" | "REAL_REFERENCE" | string;
  name?: string;
  buildingType: string;
  levels?: number;
  floorCount?: number;
  groundElevationM?: number;
  elevMinM?: number;
  elevMeanM?: number;
  elevMaxM?: number;
  zSource?: string;
  centroid: {
    latitude: number;
    longitude: number;
  };
  footprintCoordinates: [number, number][]; // [[lon, lat], ...] WGS84
  approxAreaSqm: number;
  distanceMeters: number;
  boundingBox?: [number, number, number, number];
  modelAvailable: boolean;
  buildingCode?: string;
  parcelId?: string;
  isDirectMatch?: boolean;
  isReferenceBuilding?: boolean;
  proximityTier?: "EXACT_OR_VERY_NEAR" | "NEARBY";
  searchRadiusUsedMeters?: number;
  tags?: Record<string, string>;
  attribution: string;
}

export interface BuildingPrototypeGenerationRequest {
  building_id?: string;
  building_code?: string;
  parcel_id?: string;
  candidate_osm_id?: string;
  footprint_wgs84?: [number, number][];
  building_name?: string;
  total_floors_above?: number;
  total_floors_below?: number;
  ground_elevation_m?: number;
  floor_height_m?: number;
  basement_depth_m?: number;
  include_rooftop?: boolean;
  subdivide_residential_floors?: boolean;
  flats_per_floor?: number;
  provenance_notes?: string;
  is_synthetic_prototype: boolean;
}

export interface GeneratedUnitSummaryItem {
  unit_id: string;
  prototype_ulpin_3d: string;
  parent_unit_id?: string;
  tier_code: string;
  floor_code: string;
  unit_level: string;
  flat_number?: string;
  unit_label: string;
  unit_type: string;
  z_min: number;
  z_max: number;
  volume_cum: number;
  footprint_area_sqm: number;
  status: string;
  is_solid: boolean;
  is_closed: boolean;
}

export interface BuildingPrototypeGenerationResponse {
  status: string;
  building_id: string;
  building_code: string;
  building_name: string;
  parcel_id: string;
  parcel_ulpin_2d: string;
  footprint_area_sqm: number;
  ground_elevation_m: number;
  roof_elevation_m: number;
  building_height_m: number;
  envelope_volume_cum: number;
  total_storeys_generated: number;
  total_flats_generated: number;
  total_common_units_generated: number;
  total_units_generated: number;
  generated_units: GeneratedUnitSummaryItem[];
  topology_valid: boolean;
  overlap_count: number;
  gaps_detected: boolean;
  lifecycle_state: string;
  provenance_source: string;
  audit_action: string;
  disclaimer: string;
}

export interface DataClassificationItem {
  feature_name?: string;
  component?: string;
  classification: "REFERENCE" | "OBSERVED" | "ESTIMATED" | "SYNTHETIC" | "PROPOSED" | "VERIFIED" | string;
  source_description: string;
  is_authoritative: boolean;
}

export interface AICandidateProposal {
  candidate_id: string;
  candidate_type: string;
  tier_code: string;
  floor_code: string;
  suggested_label: string;
  suggested_unit_type: string;
  z_min: number;
  z_max: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | string;
  confidence_score: number;
  confidence_label?: string;
  explanation: string[];
  review_flags?: string[];
  features?: any;
  geom_wkt?: string | null;
  status: string;
}

export interface AIBuildingAnalysisRequest {
  building_id?: string;
  candidate_osm_id?: string;
  building_name?: string;
  footprint_wgs84?: [number, number][];
  ground_elevation_m?: number;
  elev_max_m?: number;
  levels_metadata?: number;
  source_evidence_type?: string;
  standard_floor_height_m?: number;
  include_basement_hypothesis?: boolean;
  include_rooftop_hypothesis?: boolean;
  confidence_threshold?: number;
}

export interface AIBuildingAnalysisResponse {
  target_building_code: string;
  building_name: string;
  parent_parcel_ulpin: string;
  footprint_source: string;
  elevation_source: string;
  footprint_area_sqm: number;
  ground_elevation_m: number;
  roof_elevation_m: number;
  building_height_m: number;
  floor_count_observed?: number | null;
  floor_count_estimated: number;
  floor_count_basis: string;
  method: string;
  model_version: string;
  data_classifications: DataClassificationItem[];
  proposals: AICandidateProposal[];
  underground_safety_assessment: {
    is_safe: boolean;
    violation?: string;
    requires_evidence?: string[];
    notes?: string;
    flag_reject_underground_lidar?: boolean;
    [key: string]: any;
  };
  review_flags: string[];
  disclaimer: string;
  evaluated_at: string;
}

export interface BuildingEvidenceResponse {
  building_id: string;
  building_code: string;
  building_name: string;
  parcel_id: string;
  parcel_ulpin_2d: string;
  source_name: string;
  reference_type: string;
  source_id: string;
  source_dataset: string;
  elevation_source: string;
  geometry_status: string;
  model_status: string;
  validation_status: string;
  verification_status: string;
  footprint_area_sqm: number;
  ground_elevation_m: number;
  roof_elevation_m: number;
  total_height_m: number;
  total_storeys: number;
  total_units: number;
  evidence_items: EvidenceDetailItem[];
  underground_evidence_note?: string | null;
  disclaimer: string;
  evaluated_at: string;
}

// Phase 2: AI-Assisted Building Image -> 3D Reconstruction Types
export type ImageViewType = "FRONT" | "SIDE" | "TOP" | "PERSPECTIVE" | "UNSPECIFIED";
export type ProvenanceClassification = "OBSERVED" | "ESTIMATED" | "REFERENCE" | "SYNTHETIC" | "PROPOSED";

export interface BuildingImageViewItem {
  image_base64?: string | null;
  image_url?: string | null;
  view_type: ImageViewType;
  filename?: string | null;
  focal_length_hint_mm?: number | null;
  notes?: string | null;
}

export interface BuildingImageReconstructionRequest {
  images: BuildingImageViewItem[];
  parcel_id?: string | null;
  reference_building_id?: string | null;
  ground_z_override?: number | null;
  target_latitude?: number | null;
  target_longitude?: number | null;
  building_name_hint?: string | null;
  floor_height_prior_m?: number;
  has_basement_hint?: boolean;
  notes?: string | null;
}

export interface DerivedPropertyItem {
  property_name: string;
  value: any;
  unit?: string | null;
  provenance: ProvenanceClassification;
  source_description: string;
  confidence_score: number;
  notes?: string | null;
}

export interface ReconstructedGeometry3D {
  srid: number;
  geometry_type: string;
  wkt_3d: string;
  footprint_wkt: string;
  footprint_geojson: {
    type: string;
    coordinates: number[][][];
  };
  footprint_wgs84: [number, number][];
  is_watertight: boolean;
}

export interface MultiViewConsistencyRecord {
  footprint_width_m: number;
  footprint_depth_m: number;
  building_height_m: number;
  floor_count: number;
  roof_type: string;
  balcony_projection_m?: number | null;
  rooftop_core_detected: boolean;
  evidence_views: string[];
  consistency_status: "CONSISTENT" | "REVIEW_REQUIRED";
  conflicts: string[];
  correspondence_checks: {
    footprint: "MATCH" | "REVIEW";
    height: "MATCH" | "REVIEW";
    floor_count: "MATCH" | "REVIEW";
    major_offsets: "MATCH" | "REVIEW";
    [key: string]: string;
  };
}

export interface CanonicalReconstructionContract {
  reconstruction_id: string;
  footprint_width_m: number;
  footprint_depth_m: number;
  building_height_m: number;
  above_ground_floors: number;
  basement_floors: number;
  floor_height_m: number;
  roof_height_m: number;
  ground_z: number;
  geometry_status: string;
  source_views: string[];
}

export interface PostGenerationCheckResult {
  status: "MATCH" | "RECONSTRUCTION_GENERATED_CONFLICT";
  footprint_match: "MATCH" | "CONFLICT";
  height_match: "MATCH" | "CONFLICT";
  floors_match: "MATCH" | "CONFLICT";
  vertical_match: "MATCH" | "CONFLICT";
  identity_match: "MATCH" | "CONFLICT";
  discrepancies: string[];
}

export interface BuildingImageReconstructionResponse {
  reconstruction_id: string;
  status: string;
  timestamp: string;
  confidence_score: number;
  building_detected: boolean;
  detected_class: string;
  views_analyzed: string[];
  is_single_view: boolean;
  estimated_width_m: number;
  estimated_length_m: number;
  estimated_height_m: number;
  estimated_floors_above: number;
  estimated_floors_below: number;
  ground_z_m: number;
  roof_z_m: number;
  footprint_area_sqm: number;
  envelope_volume_cbm: number;
  derived_properties: DerivedPropertyItem[];
  geometry_3d: ReconstructedGeometry3D;
  canonical_reconstruction?: CanonicalReconstructionContract;
  consistency_record?: MultiViewConsistencyRecord;
  pipeline_feed_payload: Record<string, any>;
  warnings: string[];
  limitations: string[];
  human_verification_required: boolean;
  disclaimer: string;
}

