import type {
  Parcel,
  Building,
  VerticalUnit,
  ValidationResponse,
  UnitEvidenceProvenanceResponse,
  VerticalStructureResponse,
  AICandidateAnalysisResponse,
  ParcelTopologyReportResponse,
  UnitTopologyReportResponse,
  UnitReviewCaseResponse,
  VerticalUnitTransitionRequest,
  Parcel3DOverviewResponse,
  UnitNeighborItem,
  SourceManifestItem,
  IngestionValidationRequest,
  IngestionValidationResponse,
  SourceRegistrationRequest,
  SourceRegistrationResponse,
  UnitEvidenceFusionResponse,
  PrototypeTechnicalReviewDossier
} from "../types/cadastre";

const API_BASE = "/api";


export async function fetchParcels(): Promise<Parcel[]> {
  const res = await fetch(`${API_BASE}/parcels`);
  if (!res.ok) {
    throw new Error(`Failed to fetch parcels (${res.status} ${res.statusText})`);
  }
  return res.json();
}

export async function fetchBuildings(parcelId: string): Promise<Building[]> {
  const res = await fetch(`${API_BASE}/parcels/${parcelId}/buildings`);
  if (!res.ok) {
    throw new Error(`Failed to fetch buildings for parcel ${parcelId} (${res.status})`);
  }
  return res.json();
}

export async function fetchAllBuildings(): Promise<Building[]> {
  const res = await fetch(`${API_BASE}/buildings`);
  if (!res.ok) {
    throw new Error(`Failed to fetch all buildings (${res.status})`);
  }
  return res.json();
}

export async function fetchVerticalUnits(parcelId: string): Promise<VerticalUnit[]> {
  const res = await fetch(`${API_BASE}/parcels/${parcelId}/vertical-units`);
  if (!res.ok) {
    throw new Error(`Failed to fetch vertical units for parcel ${parcelId} (${res.status})`);
  }
  return res.json();
}

export async function fetchUnitValidation(unitId: string): Promise<ValidationResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/validation`);
  if (!res.ok) {
    throw new Error(`Failed to fetch validation for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

export async function fetchUnitEvidence(unitId: string): Promise<UnitEvidenceProvenanceResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/evidence`);
  if (!res.ok) {
    throw new Error(`Failed to fetch evidence for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

export async function fetchParcelStructure(parcelId: string): Promise<VerticalStructureResponse> {
  const res = await fetch(`${API_BASE}/parcels/${parcelId}/vertical-structure`);
  if (!res.ok) {
    throw new Error(`Failed to fetch vertical structure for parcel ${parcelId} (${res.status})`);
  }
  return res.json();
}

export const fetchParcelVerticalStructure = fetchParcelStructure;

export async function fetchUnitAIAnalysis(unitId: string): Promise<AICandidateAnalysisResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/ai-analysis`);
  if (!res.ok) {
    throw new Error(`Failed to fetch AI analysis for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

export async function fetchParcelTopology(parcelId: string): Promise<ParcelTopologyReportResponse> {
  const res = await fetch(`${API_BASE}/parcels/${parcelId}/topology`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topology report for parcel ${parcelId} (${res.status})`);
  }
  return res.json();
}

export async function fetchUnitTopology(unitId: string): Promise<UnitTopologyReportResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/topology`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topology report for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

export async function fetchUnitReviewCase(unitId: string): Promise<UnitReviewCaseResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/review`);
  if (!res.ok) {
    throw new Error(`Failed to fetch review case for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

export async function transitionUnitStatus(
  unitId: string,
  req: VerticalUnitTransitionRequest
): Promise<VerticalUnit> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: "Transition failed" }));
    throw new Error(errData.detail || `Status transition failed (${res.status})`);
  }
  return res.json();
}

export async function fetchParcel3DOverview(parcelId: string): Promise<Parcel3DOverviewResponse> {
  const res = await fetch(`${API_BASE}/parcels/${parcelId}/3d-overview`);
  if (!res.ok) {
    throw new Error(`Failed to fetch 3D overview for parcel ${parcelId} (${res.status})`);
  }
  return res.json();
}

export async function fetchUnitNeighbors(unitId: string): Promise<UnitNeighborItem[]> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/neighbors`);
  if (!res.ok) {
    throw new Error(`Failed to fetch neighbors for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

// Phase 3.3 Data Ingestion API Endpoints
export async function validateIngestionSource(
  req: IngestionValidationRequest
): Promise<IngestionValidationResponse> {
  const res = await fetch(`${API_BASE}/ingestion/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: "Validation failed" }));
    throw new Error(errData.detail || `Ingestion validation failed (${res.status})`);
  }
  return res.json();
}

export async function registerIngestionSource(
  req: SourceRegistrationRequest
): Promise<SourceRegistrationResponse> {
  const res = await fetch(`${API_BASE}/ingestion/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: "Source registration failed" }));
    throw new Error(errData.detail || `Source registration failed (${res.status})`);
  }
  return res.json();
}

export async function fetchIngestionSource(
  sourceId: string
): Promise<SourceManifestItem> {
  const res = await fetch(`${API_BASE}/ingestion/sources/${sourceId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ingestion source manifest (${res.status})`);
  }
  return res.json();
}

// Phase 3.5 Multi-Source Evidence Fusion API Endpoint
export async function fetchUnitEvidenceFusion(unitId: string): Promise<UnitEvidenceFusionResponse> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/evidence-fusion`);
  if (!res.ok) {
    throw new Error(`Failed to fetch evidence fusion dossier for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

// Phase 3.6D: Prototype Technical Review Dossier API Endpoint
export async function fetchUnitDossier(unitId: string): Promise<PrototypeTechnicalReviewDossier> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/dossier`);
  if (!res.ok) {
    throw new Error(`Failed to fetch technical review dossier for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

// Phase 3.10: Sub-units / Flat-level API Endpoint
export async function fetchUnitSubUnits(unitId: string): Promise<VerticalUnit[]> {
  const res = await fetch(`${API_BASE}/vertical-units/${unitId}/sub-units`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sub-units for unit ${unitId} (${res.status})`);
  }
  return res.json();
}

// Phase 3.12A: Building-Level 3D ULPIN Prototype Generation API Endpoint
export async function generateBuilding3DPrototype(
  payload: import("../types/cadastre").BuildingPrototypeGenerationRequest
): Promise<import("../types/cadastre").BuildingPrototypeGenerationResponse> {
  const res = await fetch(`${API_BASE}/buildings/generate-3d-prototype`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Failed to generate 3D prototype (${res.status})`);
  }
  return res.json();
}

// Phase 3.12B: Real Reference Hyderabad Building Discovery API
export async function fetchReferenceBuildingCandidates(
  latitude: number,
  longitude: number,
  radiusMeters: number = 1000
): Promise<import("../types/cadastre").BuildingCandidate[]> {
  try {
    const res = await fetch(
      `${API_BASE}/buildings/reference-candidates?latitude=${latitude}&longitude=${longitude}&radius_m=${radiusMeters}`
    );
    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch (err) {
    console.warn("Reference building candidates API unreachable, falling back:", err);
    return [];
  }
}

// Phase 3.15: ULPIN Direct Lookup API
export async function fetchParcelByUlpin(ulpin: string): Promise<Parcel> {
  const clean = ulpin.trim().toUpperCase();
  const res = await fetch(`${API_BASE}/parcels/by-ulpin/${encodeURIComponent(clean)}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("ULPIN not found in the project reference registry.");
    }
    if (res.status === 422) {
      throw new Error("ULPIN must be a valid 14-character alphanumeric identifier.");
    }
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `ULPIN lookup failed (${res.status})`);
  }
  return res.json();
}

// AI-Assisted Building / Floor Analysis API Endpoint
export async function analyzeBuildingWithAI(
  payload: import("../types/cadastre").AIBuildingAnalysisRequest
): Promise<import("../types/cadastre").AIBuildingAnalysisResponse> {
  const res = await fetch(`${API_BASE}/ai/candidates/analyze-building`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Failed to analyze building with AI (${res.status})`);
  }
  return res.json();
}

// Building Evidence & Provenance API Endpoint
export async function fetchBuildingEvidence(
  buildingId: string
): Promise<import("../types/cadastre").BuildingEvidenceResponse> {
  const res = await fetch(`${API_BASE}/buildings/${buildingId}/evidence`);
  if (!res.ok) {
    throw new Error(`Failed to fetch building evidence for ${buildingId} (${res.status})`);
  }
  return res.json();
}

// Phase 2: AI-Assisted Building Image -> 3D Reconstruction API Endpoint
export async function reconstructBuildingFromImages(
  payload: import("../types/cadastre").BuildingImageReconstructionRequest
): Promise<import("../types/cadastre").BuildingImageReconstructionResponse> {
  const res = await fetch(`${API_BASE}/ai/building/reconstruct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Building image reconstruction failed (${res.status})`);
  }
  return res.json();
}

// Phase 5: Drone Survey / Survey Data Workspace API Endpoint
export async function analyzeDroneSurvey(
  payload: import("../types/droneSurvey").DroneSurveyAnalysisRequest
): Promise<import("../types/droneSurvey").DroneSurveyAnalysisResponse> {
  const res = await fetch(`${API_BASE}/survey/drone/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Drone survey analysis failed (${res.status})`);
  }
  return res.json();
}
