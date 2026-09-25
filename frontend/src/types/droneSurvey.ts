import type {
  ProvenanceClassification,
  ImageViewType,
  BuildingImageReconstructionRequest
} from "./cadastre";

export type QualityCheckStatus = "AVAILABLE" | "MISSING" | "ESTIMATED" | "NOT_PROVIDED";

export interface DroneSurveyImageItem {
  image_base64?: string | null;
  image_url?: string | null;
  filename?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  view_type: ImageViewType;
  flight_altitude_m?: number | null;
  camera_model?: string | null;
  has_geotag: boolean;
  latitude?: number | null;
  longitude?: number | null;
  relative_altitude_m?: number | null;
  notes?: string | null;
}

export interface DroneSurveyMetadata {
  survey_id?: string | null;
  capture_date?: string | null;
  operator_agency?: string | null;
  camera_source?: string | null;
  approx_area_sqm?: number | null;
  crs: string;
  ground_control_available: boolean;
  gcp_count?: number | null;
  has_point_cloud: boolean;
  point_cloud_ref?: string | null;
  notes?: string | null;
}

export interface SurveyQualityCheckItem {
  check_name: string;
  category: string;
  status: QualityCheckStatus;
  details: string;
  provenance: ProvenanceClassification;
}

export interface SurveyDerivedProductItem {
  product_name: string;
  product_type: string;
  status: string;
  resolution_or_spec?: string | null;
  provenance: ProvenanceClassification;
  notes: string;
}

export interface DroneSurveyAnalysisRequest {
  images: DroneSurveyImageItem[];
  metadata?: DroneSurveyMetadata;
  parcel_id?: string | null;
  reference_building_id?: string | null;
  target_latitude?: number | null;
  target_longitude?: number | null;
  estimated_building_height_prior_m?: number | null;
}

export interface DroneSurveyAnalysisResponse {
  survey_id: string;
  image_count: number;
  is_demo_survey: boolean;
  survey_coverage_metadata: Partial<DroneSurveyMetadata> & {
    survey_id?: string | null;
    capture_date?: string | null;
    operator_agency?: string | null;
    camera_source?: string | null;
    image_count?: number;
    geotagged_images?: number;
    average_flight_altitude_m?: number;
    approx_area_sqm?: number | null;
    crs?: string;
    ground_control_available?: boolean;
    gcp_count?: number | null;
    ground_elevation_datum_m?: number | null;
    anchored_parcel_ulpin?: string | null;
    [key: string]: any;
  };
  available_evidence: string[];
  missing_evidence: string[];
  quality_checks: SurveyQualityCheckItem[];
  derived_products: SurveyDerivedProductItem[];
  provenance_matrix: Array<{
    source: string;
    type: string;
    status: string;
    used_for: string;
    provenance: ProvenanceClassification;
  }>;
  warnings: string[];
  underground_limitation_notice: string;
  point_cloud_support_notice: string;
  cadastral_legal_notice: string;
  handoff_payload: BuildingImageReconstructionRequest;
}
