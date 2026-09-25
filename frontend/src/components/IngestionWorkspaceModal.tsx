import React, { useState } from "react";
import type {
  IngestionValidationResponse,
  SourceRegistrationResponse
} from "../types/cadastre";
import { validateIngestionSource, registerIngestionSource } from "../api/cadastreApi";

interface IngestionWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReviewWorkspace?: (unitId?: string) => void;
}

const PRESET_SOURCES = [
  {
    label: "LiDAR Point Cloud (LAS)",
    sourceType: "POINT_CLOUD_LAS",
    filename: "prototype_tower_a.las",
    sourceCrs: 32644,
    payload: "",
    metadata: { sensor: "Airborne LiDAR Riegl VUX-1UAV", scan_date: "2026-03-15", crs: "EPSG:32644" }
  },
  {
    label: "3D PolyhedralSurface (WKT)",
    sourceType: "POLYHEDRALSURFACE_WKT",
    filename: "tower_a_floor3.wkt",
    sourceCrs: 32644,
    payload: `POLYHEDRALSURFACE Z (
  ((219405 1932502.5 549.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5)),
  ((219405 1932502.5 552.5, 219425 1932502.5 552.5, 219425 1932517.5 552.5, 219405 1932517.5 552.5, 219405 1932502.5 552.5)),
  ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 552.5, 219405 1932502.5 552.5, 219405 1932502.5 549.5)),
  ((219425 1932502.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 552.5, 219425 1932502.5 552.5, 219425 1932502.5 549.5)),
  ((219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 552.5, 219425 1932517.5 552.5, 219425 1932517.5 549.5)),
  ((219405 1932517.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 552.5, 219405 1932517.5 552.5, 219405 1932517.5 549.5))
)`,
    metadata: { unit_level: "Floor 3", unit_type: "RESIDENTIAL" }
  },
  {
    label: "2D Cadastral Parcel (GeoJSON WGS84)",
    sourceType: "PARCEL_GEOJSON",
    filename: "cadastral_boundary_wgs84.geojson",
    sourceCrs: 4326,
    payload: JSON.stringify({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [73.8567, 18.5204],
          [73.8570, 18.5204],
          [73.8570, 18.5207],
          [73.8567, 18.5207],
          [73.8567, 18.5204]
        ]]
      },
      properties: { ulpin_2d: "MH-PUN-001", survey_no: "101/A" }
    }, null, 2),
    metadata: { survey_agency: "District Land Records Office", source_crs: 4326 }
  },
  {
    label: "BIM / IFC Model (STEP Header)",
    sourceType: "BIM_IFC",
    filename: "tower_a_structural.ifc",
    sourceCrs: 32644,
    payload: `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('tower_a_structural.ifc','2026-09-06T12:00:00',('Architect'),('Gov'),'IFC Engine','Revit 2024','Approved');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0Yv$8V0Xv5$v4m0Z1w2X3Y',#2,'Tower A Prototype Project',$,$,$,$,(#10),#11);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,1700000000,$,$,1700000000);
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#12,$);
#20=IFCBUILDING('1A2B3C4D5E6F7G8H9I0J1K',#2,'Tower A',$,$,#30,$,'Tower A Building',.ELEMENT.,$,$,$);
ENDSEC;
END-ISO-10303-21;`,
    metadata: { bim_author: "Structural Engineering Firm", lod: "LOD300" }
  },
  {
    label: "CAD / DXF Floor Plan",
    sourceType: "CAD_DXF",
    filename: "tower_a_floorplan.dxf",
    sourceCrs: 32644,
    payload: `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1027
  9
$INSUNITS
 70
     6
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
LINE
  8
WALLS_FLOOR_01
 10
385485.0
 20
2049985.0
 30
540.0
 11
385515.0
 21
2049985.0
 31
540.0
  0
ENDSEC
  0
EOF`,
    metadata: { cad_software: "AutoCAD 2024", drawing_type: "Architectural Layout" }
  },
  {
    label: "Raster DEM Surface (GeoTIFF)",
    sourceType: "RASTER_DEM",
    filename: "terrain_dem_1m.tif",
    sourceCrs: 32644,
    payload: "",
    metadata: { resolution_m: 1.0, data_type: "Float32", sensor: "CartoSAT DEM" }
  }
];

export const IngestionWorkspaceModal: React.FC<IngestionWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onOpenReviewWorkspace
}) => {
  const [sourceType, setSourceType] = useState<string>("POINT_CLOUD_LAS");
  const [filename, setFilename] = useState<string>("prototype_tower_a.las");
  const [sourceCrs, setSourceCrs] = useState<string>("32644");
  const [targetCrs] = useState<number>(32644);
  const [dataPayload, setDataPayload] = useState<string>("");
  const [metadataJson, setMetadataJson] = useState<string>("{}");
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<IngestionValidationResponse | null>(null);
  const [registrationResult, setRegistrationResult] = useState<SourceRegistrationResponse | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_SOURCES[0]) => {
    setSourceType(preset.sourceType);
    setFilename(preset.filename);
    setSourceCrs(preset.sourceCrs ? String(preset.sourceCrs) : "");
    setDataPayload(preset.payload);
    setMetadataJson(JSON.stringify(preset.metadata, null, 2));
    setValidationResult(null);
    setRegistrationResult(null);
    setError(null);
  };

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    setRegistrationResult(null);
    try {
      let parsedMeta = {};
      try {
        parsedMeta = metadataJson.trim() ? JSON.parse(metadataJson) : {};
      } catch (err: any) {
        throw new Error(`Metadata JSON parsing error: ${err.message}`);
      }

      const res = await validateIngestionSource({
        source_type: sourceType,
        source_crs: sourceCrs ? parseInt(sourceCrs, 10) : undefined,
        target_crs: targetCrs,
        filename: filename.trim() || undefined,
        data_payload: dataPayload.trim() || undefined,
        metadata_json: parsedMeta
      });
      setValidationResult(res);
    } catch (err: any) {
      setError(err.message || "Validation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSource = async (generateCandidates: boolean) => {
    setLoading(true);
    setError(null);
    try {
      let parsedMeta = {};
      try {
        parsedMeta = metadataJson.trim() ? JSON.parse(metadataJson) : {};
      } catch (err: any) {
        throw new Error(`Metadata JSON parsing error: ${err.message}`);
      }

      const res = await registerIngestionSource({
        source_type: sourceType,
        dataset_name: filename.trim() || `SRC_${sourceType}`,
        filename: filename.trim() || undefined,
        source_crs: sourceCrs ? parseInt(sourceCrs, 10) : undefined,
        target_crs: targetCrs,
        data_payload: dataPayload.trim() || undefined,
        metadata_json: parsedMeta,
        parcel_ulpin_2d: "MH-PUN-001",
        building_code: "BLD-TOWER-A",
        generate_candidates: generateCandidates
      });
      setRegistrationResult(res);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal-container ingestion-workspace-modal"
        style={{
          maxWidth: "1050px",
          width: "92vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#161b22",
          color: "#e6edf3",
          border: "1px solid #30363d",
          borderRadius: "8px",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#0d1117"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#58a6ff", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Real-World 3D Cadastral Data Ingestion & Source Standardization
            </h2>
            <div style={{ fontSize: "0.82rem", color: "#8b949e", marginTop: "4px" }}>
              Multi-Source Ingestion Pipeline • SHA-256 Fingerprinting • Explicit CRS Normalization (EPSG:32644)
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            style={{
              background: "none",
              border: "none",
              color: "#8b949e",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "4px 8px"
            }}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div
          className="modal-body"
          style={{
            padding: "20px",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: "20px"
          }}
        >
          {/* Left Column: Source Input & Configuration */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Presets */}
            <div>
              <label style={{ fontSize: "0.85rem", color: "#8b949e", marginBottom: "6px", display: "block", fontWeight: 600 }}>
                Demo Source Presets:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {PRESET_SOURCES.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      backgroundColor: sourceType === p.sourceType && filename === p.filename ? "#1f6feb" : "#21262d",
                      color: sourceType === p.sourceType && filename === p.filename ? "#ffffff" : "#c9d1d9",
                      border: "1px solid #30363d",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source Type & Filename */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                  Source Format Type:
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    backgroundColor: "#0d1117",
                    color: "#e6edf3",
                    border: "1px solid #30363d",
                    borderRadius: "4px",
                    fontSize: "0.85rem"
                  }}
                >
                  <optgroup label="Fully Validated / Processed">
                    <option value="POINT_CLOUD_LAS">Point Cloud (ASPRS LAS / LAZ)</option>
                    <option value="POLYHEDRALSURFACE_WKT">3D Solid (PolyhedralSurface WKT)</option>
                    <option value="PARCEL_GEOJSON">2D Cadastral Parcel (GeoJSON)</option>
                  </optgroup>
                  <optgroup label="Metadata-Only / Deferred Processing">
                    <option value="BIM_IFC">BIM / Building Model (IFC STEP Header)</option>
                    <option value="CAD_DXF">CAD Drawing (AutoCAD DXF ASCII)</option>
                    <option value="RASTER_DEM">Raster Surface (GeoTIFF DEM/DSM)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                  Source Filename:
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g. site_scan.las"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    backgroundColor: "#0d1117",
                    color: "#e6edf3",
                    border: "1px solid #30363d",
                    borderRadius: "4px",
                    fontSize: "0.85rem"
                  }}
                />
              </div>
            </div>

            {/* CRS Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                  Source Coordinate System (EPSG):
                </label>
                <input
                  type="text"
                  value={sourceCrs}
                  onChange={(e) => setSourceCrs(e.target.value)}
                  placeholder="e.g. 32644 or 4326 (Required)"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    backgroundColor: "#0d1117",
                    color: "#e6edf3",
                    border: "1px solid #30363d",
                    borderRadius: "4px",
                    fontSize: "0.85rem"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                  Target Analysis CRS:
                </label>
                <div
                  style={{
                    padding: "6px 8px",
                    backgroundColor: "#090d13",
                    color: "#58a6ff",
                    border: "1px solid #30363d",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    fontWeight: 600
                  }}
                >
                  EPSG:32644 (UTM Zone 44N)
                </div>
              </div>
            </div>

            {/* Raw Data Payload */}
            <div>
              <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                Geometry / File Text Payload (WKT / GeoJSON / STEP / DXF):
              </label>
              <textarea
                value={dataPayload}
                onChange={(e) => setDataPayload(e.target.value)}
                placeholder="Paste WKT string, GeoJSON feature, IFC STEP header, or DXF ASCII text..."
                rows={6}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#0d1117",
                  color: "#e6edf3",
                  border: "1px solid #30363d",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Metadata JSON */}
            <div>
              <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                Supplementary Survey / Sensor Metadata (JSON):
              </label>
              <textarea
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#0d1117",
                  color: "#e6edf3",
                  border: "1px solid #30363d",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={handleValidate}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  backgroundColor: "#238636",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Validating..." : "1. Validate & Inspect Source"}
              </button>

              <button
                type="button"
                onClick={() => handleRegisterSource(false)}
                disabled={loading || !validationResult}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#21262d",
                  color: validationResult ? "#e6edf3" : "#8b949e",
                  border: "1px solid #30363d",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  cursor: loading || !validationResult ? "not-allowed" : "pointer"
                }}
              >
                2. Register Evidence
              </button>

              <button
                type="button"
                onClick={() => handleRegisterSource(true)}
                disabled={loading || !validationResult || validationResult.status !== "VALIDATED"}
                style={{
                  padding: "8px 14px",
                  backgroundColor: validationResult?.status === "VALIDATED" ? "#1f6feb" : "#21262d",
                  color: validationResult?.status === "VALIDATED" ? "#ffffff" : "#8b949e",
                  border: "1px solid #30363d",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: loading || !validationResult || validationResult.status !== "VALIDATED" ? "not-allowed" : "pointer"
                }}
              >
                Propose Candidates
              </button>
            </div>
          </div>

          {/* Right Column: Ingestion Analysis & Manifest Results */}
          <div
            style={{
              backgroundColor: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: "6px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflowY: "auto"
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.95rem", color: "#58a6ff", borderBottom: "1px solid #21262d", paddingBottom: "8px" }}>
              Standardization & Quality Analysis
            </h3>

            {error && (
              <div
                style={{
                  backgroundColor: "rgba(248, 81, 73, 0.15)",
                  border: "1px solid #f85149",
                  padding: "10px",
                  borderRadius: "4px",
                  color: "#ff7b72",
                  fontSize: "0.82rem"
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}

            {!validationResult && !error && (
              <div style={{ color: "#8b949e", fontSize: "0.85rem", textAlign: "center", marginTop: "40px" }}>
                Select a preset or enter spatial data, then click <strong>"Validate & Inspect Source"</strong> to extract metadata, compute SHA-256 source fingerprint used for provenance and reproducibility, and check quality flags.
              </div>
            )}

            {validationResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Status Badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.82rem", color: "#8b949e" }}>Ingestion Status:</span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      backgroundColor:
                        validationResult.status === "VALIDATED"
                          ? "rgba(46, 160, 67, 0.2)"
                          : validationResult.status === "RECOGNIZED_DEFERRED"
                          ? "rgba(210, 153, 34, 0.2)"
                          : "rgba(248, 81, 73, 0.2)",
                      color:
                        validationResult.status === "VALIDATED"
                          ? "#3fb950"
                          : validationResult.status === "RECOGNIZED_DEFERRED"
                          ? "#d29922"
                          : "#f85149",
                      border: `1px solid ${
                        validationResult.status === "VALIDATED"
                          ? "#2ea043"
                          : validationResult.status === "RECOGNIZED_DEFERRED"
                          ? "#bb8009"
                          : "#f85149"
                      }`
                    }}
                  >
                    {validationResult.status}
                  </span>
                </div>

                {/* SHA-256 Fingerprint */}
                {validationResult.fingerprint_sha256 && (
                  <div style={{ backgroundColor: "#161b22", padding: "8px", borderRadius: "4px", border: "1px solid #30363d" }}>
                    <div style={{ fontSize: "0.75rem", color: "#8b949e", marginBottom: "2px" }}>
                      SHA-256 Content Integrity Fingerprint:
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.74rem", color: "#58a6ff", wordBreak: "break-all" }}>
                      {validationResult.fingerprint_sha256}
                    </div>
                  </div>
                )}

                {/* Quality Flags */}
                <div>
                  <div style={{ fontSize: "0.78rem", color: "#8b949e", marginBottom: "4px" }}>Quality Flags:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {validationResult.quality_flags.map((flag, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.72rem",
                          backgroundColor:
                            flag.includes("INVALID") || flag.includes("ERROR") || flag.includes("MISSING")
                              ? "rgba(248, 81, 73, 0.15)"
                              : flag.includes("DEFERRED")
                              ? "rgba(210, 153, 34, 0.15)"
                              : "rgba(56, 139, 253, 0.15)",
                          color:
                            flag.includes("INVALID") || flag.includes("ERROR") || flag.includes("MISSING")
                              ? "#ff7b72"
                              : flag.includes("DEFERRED")
                              ? "#d29922"
                              : "#58a6ff",
                          border: "1px solid #30363d"
                        }}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Manifest Summary */}
                {validationResult.manifest && (
                  <div style={{ backgroundColor: "#161b22", padding: "10px", borderRadius: "4px", border: "1px solid #30363d" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#c9d1d9", marginBottom: "6px" }}>
                      Normalized Source Manifest:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "0.78rem" }}>
                      <div><span style={{ color: "#8b949e" }}>Format:</span> {validationResult.manifest.format}</div>
                      <div><span style={{ color: "#8b949e" }}>Original CRS:</span> {validationResult.manifest.original_crs || "None"}</div>
                      <div><span style={{ color: "#8b949e" }}>Target CRS:</span> {validationResult.manifest.normalized_crs}</div>
                      <div><span style={{ color: "#8b949e" }}>Features:</span> {validationResult.feature_count}</div>
                    </div>
                  </div>
                )}

                {/* Geometry / Point Cloud Summary */}
                {validationResult.geometry_summary && (
                  <div style={{ backgroundColor: "#161b22", padding: "10px", borderRadius: "4px", border: "1px solid #30363d" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#c9d1d9", marginBottom: "6px" }}>
                      Extracted Geometry & Elevation:
                    </div>
                    <pre style={{ margin: 0, fontSize: "0.74rem", color: "#a5d6ff", fontFamily: "monospace", maxHeight: "120px", overflowY: "auto" }}>
                      {JSON.stringify(validationResult.geometry_summary, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Pipeline Message */}
                <div style={{ fontSize: "0.8rem", color: "#c9d1d9", backgroundColor: "#1c2128", padding: "8px", borderRadius: "4px" }}>
                  {validationResult.message}
                </div>

                {/* Registration Result Banner */}
                {registrationResult && (
                  <div
                    style={{
                      backgroundColor: registrationResult.status === "SUCCESS" ? "rgba(46, 160, 67, 0.15)" : "rgba(163, 113, 247, 0.15)",
                      border: `1px solid ${registrationResult.status === "SUCCESS" ? "#2ea043" : "#8957e5"}`,
                      padding: "10px",
                      borderRadius: "4px",
                      fontSize: "0.8rem"
                    }}
                  >
                    <div style={{ fontWeight: 600, color: registrationResult.status === "SUCCESS" ? "#3fb950" : "#d2a8ff", marginBottom: "4px" }}>
                      {registrationResult.status === "SUCCESS" ? "Source Registered Successfully" : "Source Evidence Recorded"}
                    </div>
                    <div style={{ color: "#c9d1d9" }}>{registrationResult.message}</div>
                    {registrationResult.candidates_generated > 0 && onOpenReviewWorkspace && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenReviewWorkspace();
                        }}
                        style={{
                          marginTop: "8px",
                          padding: "4px 10px",
                          backgroundColor: "#1f6feb",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Open Human Review Workspace &rarr;
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div
          className="modal-footer"
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #30363d",
            backgroundColor: "#0d1117",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#8b949e", maxWidth: "80%" }}>
            <strong>Governance Notice:</strong> Ingestion routes candidates strictly in PROPOSED status. Optical LiDAR does not directly establish underground geometry; subterranean units require engineering plans, BIM/CAD, or subsurface survey. GPR may be used where available and appropriate.
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              backgroundColor: "#21262d",
              color: "#c9d1d9",
              border: "1px solid #30363d",
              borderRadius: "4px",
              fontSize: "0.82rem",
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
