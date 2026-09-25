import React, { useState } from "react";
import {
  Compass,
  Plane,
  Upload,
  X,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Sliders,
  Eye,
  Trash2,
  Info,
  Layers,
  Cpu,
  FileCheck
} from "lucide-react";
import type {
  Parcel,
  Building as CadastreBuilding,
  BuildingImageViewItem
} from "../types/cadastre";
import type {
  DroneSurveyImageItem,
  DroneSurveyMetadata,
  DroneSurveyAnalysisResponse
} from "../types/droneSurvey";
import { analyzeDroneSurvey } from "../api/cadastreApi";

// Pre-packaged SVG Data URIs with Survey Gold (#E7B66D) & Cyan (#39D5FF) theme
const DEMO_DRONE_NADIR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23061316"/><path d="M50 80 L350 70 L340 230 L40 240 Z" fill="%23123F46" fill-opacity="0.35" stroke="%2339D5FF" stroke-width="1.5" stroke-dasharray="4 4"/><rect x="100" y="85" width="200" height="130" fill="%23164C54" stroke="%23E7B66D" stroke-width="2.5" rx="3"/><rect x="160" y="125" width="80" height="50" fill="%230C2228" stroke="%2339D5FF" stroke-width="1.2"/><circle cx="200" cy="150" r="12" fill="none" stroke="%23E7B66D" stroke-width="1.5"/><circle cx="200" cy="150" r="4" fill="%2339D5FF"/><text x="200" y="45" fill="%23E7B66D" font-family="sans-serif" font-size="13" text-anchor="middle" font-weight="bold">DRONE NADIR AERIAL ORTHOPHOTO (TOP VIEW)</text><text x="200" y="275" fill="%23B8DAD4" font-family="sans-serif" font-size="11" text-anchor="middle">GSD: 1.8 cm/px · Altitude: 50m AGL · Flight Path: Grid-44N</text></svg>`;

const DEMO_DRONE_OBLIQUE_SOUTH_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23061316"/><polygon points="80,60 320,60 310,240 90,240" fill="%23164C54" stroke="%2339D5FF" stroke-width="1.5"/><g fill="%23EAF7F5"><rect x="110" y="80" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="180" y="80" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="250" y="80" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="110" y="125" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="180" y="125" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="250" y="125" width="40" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="175" y="215" width="50" height="25" fill="%23E7B66D"/></g><text x="200" y="35" fill="%23E7B66D" font-family="sans-serif" font-size="13" text-anchor="middle" font-weight="bold">DRONE SOUTH OBLIQUE 45° (FRONT PERSPECTIVE)</text><text x="200" y="275" fill="%23B8DAD4" font-family="sans-serif" font-size="11" text-anchor="middle">Pitch: -45° · Azimuth: 180° (South) · Alt: 45m AGL</text></svg>`;

const DEMO_DRONE_OBLIQUE_WEST_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23061316"/><polygon points="95,65 305,65 295,240 105,240" fill="%23164C54" stroke="%2339D5FF" stroke-width="1.5"/><g fill="%23EAF7F5"><rect x="125" y="80" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="185" y="80" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="245" y="80" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="125" y="125" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="185" y="125" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/><rect x="245" y="125" width="35" height="30" rx="2" fill="%231B5961" stroke="%2339D5FF" stroke-width="0.8"/></g><text x="200" y="35" fill="%23E7B66D" font-family="sans-serif" font-size="13" text-anchor="middle" font-weight="bold">DRONE WEST OBLIQUE 45° (SIDE PERSPECTIVE)</text><text x="200" y="275" fill="%23B8DAD4" font-family="sans-serif" font-size="11" text-anchor="middle">Pitch: -45° · Azimuth: 270° (West) · Alt: 45m AGL</text></svg>`;

export interface DroneSurveyWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  parcel?: Parcel | null;
  building?: CadastreBuilding | null;
  initialAnalysisResult?: DroneSurveyAnalysisResponse | null;
  onSendToAiReconstruction?: (
    handoffImages: BuildingImageViewItem[],
    surveyId: string,
    groundZ?: number | null
  ) => void;
}

export const DroneSurveyWorkspace: React.FC<DroneSurveyWorkspaceProps> = ({
  isOpen,
  onClose,
  parcel,
  building: _building,
  initialAnalysisResult,
  onSendToAiReconstruction
}) => {
  // Survey Images State
  const [images, setImages] = useState<DroneSurveyImageItem[]>([]);

  // Mission Metadata State
  const [surveyId, setSurveyId] = useState<string>("SRV-2026-HYD-DEMO1");
  const [captureDate, setCaptureDate] = useState<string>("2026-09-17");
  const [operatorAgency, setOperatorAgency] = useState<string>(
    "Telangana Geospatial Drone Survey Unit (Prototype)"
  );
  const [cameraSource, setCameraSource] = useState<string>(
    "DJI Zenmuse P1 / 35mm Equivalent Optical Sensor"
  );
  const [approxAreaSqm, setApproxAreaSqm] = useState<number>(1850.0);
  const [crs, setCrs] = useState<string>("EPSG:32644");
  const [groundControlAvailable, setGroundControlAvailable] = useState<boolean>(true);
  const [gcpCount, setGcpCount] = useState<number>(4);
  const [hasPointCloud, setHasPointCloud] = useState<boolean>(false);
  const [pointCloudRef, setPointCloudRef] = useState<string>("prototype_tower_a.las");
  const [surveyMode, setSurveyMode] = useState<"NADIR" | "OBLIQUE" | "LiDAR">("NADIR");

  // Analysis & Processing State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DroneSurveyAnalysisResponse | null>(
    initialAnalysisResult || null
  );
  const [previewImageIdx, setPreviewImageIdx] = useState<number | null>(null);

  React.useEffect(() => {
    if (initialAnalysisResult) {
      setAnalysisResult(initialAnalysisResult);
    }
  }, [initialAnalysisResult]);

  if (!isOpen) return null;

  // 1-Click Load Demo Survey Data
  const handleLoadDemoSurvey = () => {
    setSurveyId("SRV-DEMO-UAV-44N");
    setCaptureDate("2026-09-17");
    setOperatorAgency("Telangana Geospatial Drone Survey Unit (Demonstration)");
    setCameraSource("DJI Zenmuse P1 / 45MP Full-Frame UAV Sensor");
    setApproxAreaSqm(1950.0);
    setCrs("EPSG:32644");
    setGroundControlAvailable(true);
    setGcpCount(4);
    setHasPointCloud(true);
    setPointCloudRef("prototype_tower_a.las");
    setSurveyMode("NADIR");

    const demoItems: DroneSurveyImageItem[] = [
      {
        image_base64: DEMO_DRONE_NADIR_SVG,
        filename: "DJI_0041_NADIR_ROOF.SVG",
        file_size_bytes: 14200,
        view_type: "TOP",
        flight_altitude_m: 50.0,
        camera_model: "Zenmuse P1",
        has_geotag: true,
        latitude: 17.44356,
        longitude: 78.37722,
        notes: "Nadir flight strip #3 (GSD: 1.8cm/px)"
      },
      {
        image_base64: DEMO_DRONE_OBLIQUE_SOUTH_SVG,
        filename: "DJI_0042_OBLIQUE_SOUTH.SVG",
        file_size_bytes: 15800,
        view_type: "FRONT",
        flight_altitude_m: 45.0,
        camera_model: "Zenmuse P1",
        has_geotag: true,
        latitude: 17.44302,
        longitude: 78.37721,
        notes: "South oblique facade elevation (Pitch: -45°)"
      },
      {
        image_base64: DEMO_DRONE_OBLIQUE_WEST_SVG,
        filename: "DJI_0043_OBLIQUE_WEST.SVG",
        file_size_bytes: 15200,
        view_type: "SIDE",
        flight_altitude_m: 45.0,
        camera_model: "Zenmuse P1",
        has_geotag: true,
        latitude: 17.44355,
        longitude: 78.37681,
        notes: "West oblique depth profile (Pitch: -45°)"
      }
    ];

    setImages(demoItems);
    setAnalysisResult(null);
    setAnalysisError(null);
    setPreviewImageIdx(0);
  };

  // Upload user survey files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImages((prev) => [
          ...prev,
          {
            image_base64: base64,
            filename: file.name,
            file_size_bytes: file.size,
            mime_type: file.type || "image/jpeg",
            view_type: idx === 0 ? "TOP" : idx === 1 ? "FRONT" : idx === 2 ? "SIDE" : "UNSPECIFIED",
            flight_altitude_m: 50.0,
            has_geotag: true,
            notes: "Uploaded drone survey image"
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (previewImageIdx === index) {
      setPreviewImageIdx(null);
    }
  };

  const handleUpdateImageViewType = (index: number, viewType: any) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, view_type: viewType } : img))
    );
  };

  // Analyze Drone Survey
  const handleExecuteAnalysis = async () => {
    if (images.length === 0) {
      setAnalysisError("Please upload drone imagery or click 'Load Demo Drone Survey'.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const meta: DroneSurveyMetadata = {
        survey_id: surveyId,
        capture_date: captureDate,
        operator_agency: operatorAgency,
        camera_source: cameraSource,
        approx_area_sqm: approxAreaSqm,
        crs: crs,
        ground_control_available: groundControlAvailable,
        gcp_count: gcpCount,
        has_point_cloud: hasPointCloud,
        point_cloud_ref: hasPointCloud ? pointCloudRef : null
      };

      let targetLat: number | null = null;
      let targetLon: number | null = null;

      const geotaggedImg = images.find(
        (img) =>
          img.latitude !== undefined &&
          img.latitude !== null &&
          Math.abs(img.latitude) <= 90 &&
          img.longitude !== undefined &&
          img.longitude !== null &&
          Math.abs(img.longitude) <= 180
      );

      if (geotaggedImg) {
        targetLat = geotaggedImg.latitude!;
        targetLon = geotaggedImg.longitude!;
      } else if (parcel?.geom_2d?.geojson?.coordinates?.[0]?.[0]) {
        const firstPt = parcel.geom_2d.geojson.coordinates[0][0];
        if (Math.abs(firstPt[0]) <= 180 && Math.abs(firstPt[1]) <= 90) {
          targetLon = firstPt[0];
          targetLat = firstPt[1];
        }
      }

      const res = await analyzeDroneSurvey({
        images,
        metadata: meta,
        parcel_id: parcel?.id,
        target_latitude: targetLat,
        target_longitude: targetLon,
        estimated_building_height_prior_m: 15.0
      });

      setAnalysisResult(res);
    } catch (err: any) {
      setAnalysisError(err?.message || "Failed to analyze drone survey.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handoff to Existing AI Image -> 3D Reconstruction
  const handleHandoffToAi = () => {
    if (!analysisResult) return;
    if (onSendToAiReconstruction) {
      onSendToAiReconstruction(
        analysisResult.handoff_payload.images,
        analysisResult.survey_id,
        analysisResult.handoff_payload.ground_z_override
      );
    }
  };

  // Evaluated Survey Quality Checks based on actual state
  const coverageStatus = images.length >= 2 ? "PASS" : images.length === 1 ? "REVIEW" : "NOT PROVIDED";
  const georefStatus = images.some((img) => img.has_geotag) ? "PASS" : "REVIEW";
  const crsStatus = crs ? "PASS" : "NOT PROVIDED";
  const gcpStatus = groundControlAvailable && gcpCount > 0 ? "PASS" : "REVIEW";
  const completenessStatus = images.length >= 3 ? "PASS" : images.length > 0 ? "REVIEW" : "NOT PROVIDED";

  // Filter displayed images based on mode selector if applied
  const filteredImages = images.filter((img) => {
    if (surveyMode === "NADIR") return img.view_type === "TOP" || img.view_type === "UNSPECIFIED" || true;
    if (surveyMode === "OBLIQUE") return img.view_type === "FRONT" || img.view_type === "SIDE" || img.view_type === "PERSPECTIVE" || true;
    return true;
  });

  return (
    <div
      className="modal-backdrop-command"
      data-testid="drone-survey-workspace"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 21, 38, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}
    >
      <div
        className="modal-dialog-command"
        style={{
          width: "98vw",
          maxWidth: "1540px",
          height: "94vh",
          maxHeight: "960px",
          backgroundColor: "#F7F8FB",
          border: "1px solid #D9DDE5",
          borderRadius: "4px",
          boxShadow: "0 12px 36px rgba(11, 21, 38, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* ========================================================= */}
        {/* 1. TOP GOVERNMENT HEADER                                  */}
        {/* ========================================================= */}
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "#162F6A",
            borderBottom: "2px solid #E0A93C",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#FFFFFF"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "4px",
                backgroundColor: "rgba(224, 169, 60, 0.16)",
                border: "1px solid rgba(224, 169, 60, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#E0A93C"
              }}
            >
              <Plane style={{ width: "20px", height: "20px" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    color: "#FFFFFF"
                  }}
                >
                  DRONE SURVEY / SURVEY DATA WORKSPACE
                </h2>
                <span
                  style={{
                    fontSize: "9px",
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    letterSpacing: "0.06em"
                  }}
                >
                  SURVEY EVIDENCE PIPELINE
                </span>
                {analysisResult?.is_demo_survey && (
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      backgroundColor: "rgba(224, 169, 60, 0.25)",
                      color: "#E0A93C",
                      border: "1px solid rgba(224, 169, 60, 0.5)",
                      letterSpacing: "0.06em"
                    }}
                  >
                    DEMO DATA
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255, 255, 255, 0.82)" }}>
                UPSTREAM PHOTOGRAMMETRIC SURVEY INGESTION · EVIDENCE AUDIT · AI-ASSISTED RECONSTRUCTION · CADASTRAL HANDOFF
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={handleLoadDemoSurvey}
              data-testid="btn-load-demo-drone-survey"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                backgroundColor: "#E0A93C",
                color: "#0B1526",
                border: "1px solid #C48E28",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer"
              }}
              title="Load prepared demonstration drone flight imagery"
            >
              <Sparkles style={{ width: "14px", height: "14px" }} />
              <span>Load Demo Drone Survey</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.75)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Close workspace"
            >
              <X style={{ width: "18px", height: "18px" }} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CORE WORKFLOW TRACK (01 -> 02 -> 03 -> 04 -> 05 -> 06)   */}
        {/* ========================================================= */}
        <div
          className="gis-workflow-track"
          data-testid="drone-workflow-pipeline-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 20px",
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #D9DDE5",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "var(--font-mono, monospace)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: images.length > 0 ? "#2E9E52" : "#162F6A" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>01 — SURVEY INPUT</span>
          </div>
          <span style={{ color: "#9CA3AF" }}>↓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: images.length > 0 ? "#2E9E52" : "#6B7086" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>02 — IMAGE EVIDENCE</span>
          </div>
          <span style={{ color: "#9CA3AF" }}>↓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: analysisResult ? "#2E9E52" : images.length > 0 ? "#1F7AE0" : "#6B7086" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>03 — SURVEY QUALITY</span>
          </div>
          <span style={{ color: "#9CA3AF" }}>↓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: analysisResult ? "#2E9E52" : "#6B7086" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>04 — DERIVED PRODUCTS</span>
          </div>
          <span style={{ color: "#9CA3AF" }}>↓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: analysisResult ? "#1F7AE0" : "#6B7086" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>05 — AI RECONSTRUCTION</span>
          </div>
          <span style={{ color: "#9CA3AF" }}>↓</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: analysisResult ? "#E0A93C" : "#6B7086" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "currentColor" }} />
            <span>06 — CADASTRAL HANDOFF</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3-COLUMN GOVERNMENT WORKSPACE LAYOUT                      */}
        {/* ========================================================= */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1.25fr 1.05fr",
            gap: "12px",
            padding: "12px",
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#F7F8FB"
          }}
        >
          {/* ======================================================= */}
          {/* LEFT COLUMN: 01 SURVEY INPUT + 02 IMAGE EVIDENCE        */}
          {/* ======================================================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 01 — SURVEY INPUT */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sliders style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                  01 — SURVEY INPUT: Mission Parameters
                </span>
                <span style={{ fontSize: "10px", color: "#6B7086", fontFamily: "var(--font-mono, monospace)" }}>
                  CRS: {crs}
                </span>
              </div>

              {/* Workflow Flow Badge */}
              <div style={{ padding: "4px 8px", backgroundColor: "#EEF1F4", borderRadius: "3px", fontSize: "10px", color: "#46516B", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>SURVEY MISSION</span>
                <span>→</span>
                <span>SPATIAL REFERENCE</span>
                <span>→</span>
                <span>CONTROL DATA</span>
              </div>

              {/* Mode Selector */}
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Survey Capture Mode
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(['NADIR', 'OBLIQUE', 'LiDAR'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSurveyMode(m)}
                      style={{
                        flex: 1,
                        padding: "5px 0",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "3px",
                        border: surveyMode === m ? "1px solid #162F6A" : "1px solid #D9DDE5",
                        backgroundColor: surveyMode === m ? "#162F6A" : "#FFFFFF",
                        color: surveyMode === m ? "#FFFFFF" : "#46516B",
                        cursor: "pointer"
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metadata Inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                    Survey ID
                  </label>
                  <input
                    type="text"
                    value={surveyId}
                    onChange={(e) => setSurveyId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "11px",
                      border: "1px solid #D9DDE5",
                      borderRadius: "3px",
                      backgroundColor: "#FFFFFF",
                      color: "#0B1526",
                      fontFamily: "var(--font-mono, monospace)",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                    Capture Date
                  </label>
                  <input
                    type="date"
                    value={captureDate}
                    onChange={(e) => setCaptureDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "11px",
                      border: "1px solid #D9DDE5",
                      borderRadius: "3px",
                      backgroundColor: "#FFFFFF",
                      color: "#0B1526",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                  Operating Agency
                </label>
                <input
                  type="text"
                  value={operatorAgency}
                  onChange={(e) => setOperatorAgency(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    fontSize: "11px",
                    border: "1px solid #D9DDE5",
                    borderRadius: "3px",
                    backgroundColor: "#FFFFFF",
                    color: "#0B1526",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                    Approx Area (m²)
                  </label>
                  <input
                    type="number"
                    value={approxAreaSqm}
                    onChange={(e) => setApproxAreaSqm(parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "11px",
                      border: "1px solid #D9DDE5",
                      borderRadius: "3px",
                      backgroundColor: "#FFFFFF",
                      color: "#0B1526",
                      fontFamily: "var(--font-mono, monospace)",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                    Spatial Reference / CRS
                  </label>
                  <input
                    type="text"
                    value={crs}
                    disabled
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      fontSize: "11px",
                      border: "1px solid #D9DDE5",
                      borderRadius: "3px",
                      backgroundColor: "#EEF1F4",
                      color: "#46516B",
                      fontFamily: "var(--font-mono, monospace)"
                    }}
                  />
                </div>
              </div>

              {/* Control Data Checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #EEF1F4", paddingTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0B1526", cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={groundControlAvailable}
                      onChange={(e) => setGroundControlAvailable(e.target.checked)}
                      style={{ accentColor: "#162F6A" }}
                    />
                    <span>Ground Control (GCP)</span>
                  </label>
                  {groundControlAvailable && (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#2E9E52", fontFamily: "var(--font-mono, monospace)" }}>
                      {gcpCount} DGPS Points Surveyed
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0B1526", cursor: "pointer", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={hasPointCloud}
                      onChange={(e) => setHasPointCloud(e.target.checked)}
                      style={{ accentColor: "#162F6A" }}
                    />
                    <span>LiDAR / Point Cloud</span>
                  </label>
                  {hasPointCloud && (
                    <span style={{ fontSize: "10px", color: "#1F7AE0", fontFamily: "var(--font-mono, monospace)" }}>
                      {pointCloudRef}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 02 — IMAGE EVIDENCE */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flex: 1
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plane style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                  02 — IMAGE EVIDENCE
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#46516B", fontFamily: "var(--font-mono, monospace)" }}>
                  {images.length} Photo(s) Staged
                </span>
              </div>

              {/* Upload Dropzone */}
              <label
                style={{
                  border: "1px dashed #B8C2D3",
                  borderRadius: "4px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backgroundColor: "#F7F8FB",
                  textAlign: "center",
                  gap: "3px"
                }}
              >
                <Upload style={{ width: "16px", height: "16px", color: "#162F6A" }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0B1526" }}>
                  DRONE SURVEY PHOTOS
                </span>
                <div style={{ fontSize: "10px", color: "#6B7086", lineHeight: "1.3" }}>
                  Supported evidence:
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "2px" }}>
                    <span>• Nadir / top-view images</span>
                    <span>• Oblique / angled images</span>
                    <span>• Multi-image survey capture</span>
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,.svg"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>

              {/* Selected Image Detailed Inspection Drawer */}
              {previewImageIdx !== null && images[previewImageIdx] && (
                <div
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #E0A93C",
                    backgroundColor: "#FFFDF5",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                  data-testid="drone-image-inspection-drawer"
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ fontWeight: 700, color: "#0B1526", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Eye style={{ width: "14px", height: "14px", color: "#E0A93C" }} />
                      Inspection: {images[previewImageIdx].filename || `Photo #${previewImageIdx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewImageIdx(null)}
                      style={{ fontSize: "10px", color: "#6B7086", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Close Preview
                    </button>
                  </div>
                  <div style={{ height: "120px", backgroundColor: "#EEF1F4", border: "1px solid #D9DDE5", borderRadius: "3px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    {images[previewImageIdx].image_base64 ? (
                      <img
                        src={images[previewImageIdx].image_base64}
                        alt="Inspection Preview"
                        style={{ height: "100%", width: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <Plane style={{ width: "28px", height: "28px", color: "#9CA3AF" }} />
                    )}
                    <span style={{ position: "absolute", top: "4px", left: "4px", padding: "2px 6px", borderRadius: "2px", fontSize: "9px", fontWeight: 700, backgroundColor: "rgba(11, 21, 38, 0.85)", color: "#FFFFFF", fontFamily: "var(--font-mono, monospace)" }}>
                      VIEW: {images[previewImageIdx].view_type}
                    </span>
                    <span style={{ position: "absolute", bottom: "4px", right: "4px", padding: "2px 6px", borderRadius: "2px", fontSize: "9px", backgroundColor: "rgba(11, 21, 38, 0.85)", color: "#E0A93C", fontFamily: "var(--font-mono, monospace)" }}>
                      Alt: {images[previewImageIdx].flight_altitude_m || 50}m AGL
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#46516B", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono, monospace)" }}>
                    <span>Location: {images[previewImageIdx].latitude ? `${images[previewImageIdx].latitude}° N, ${images[previewImageIdx].longitude}° E` : "Spatial Reference Validated"}</span>
                    <span style={{ color: "#2E9E52", fontWeight: 700 }}>STAGED EVIDENCE</span>
                  </div>
                </div>
              )}

              {/* Evidence Table/Grid */}
              <div style={{ flex: 1, minHeight: "140px", maxHeight: "260px", overflowY: "auto" }}>
                {filteredImages.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {filteredImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "3px",
                          border: previewImageIdx === idx ? "1px solid #162F6A" : "1px solid #D9DDE5",
                          backgroundColor: previewImageIdx === idx ? "#F0F4FC" : "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px"
                        }}
                      >
                        <div
                          onClick={() => setPreviewImageIdx(idx)}
                          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", flex: 1, minWidth: 0 }}
                        >
                          <div style={{ width: "38px", height: "28px", borderRadius: "2px", backgroundColor: "#EEF1F4", border: "1px solid #D9DDE5", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {img.image_base64 ? (
                              <img src={img.image_base64} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <Plane style={{ width: "14px", height: "14px", color: "#9CA3AF" }} />
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0B1526", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {img.filename || `Photo #${idx + 1}`}
                              </span>
                              <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: "#E8F5E9", color: "#2E9E52", border: "1px solid #A5D6A7" }}>
                                STAGED
                              </span>
                            </div>
                            <span style={{ fontSize: "10px", color: "#6B7086", display: "block", fontFamily: "var(--font-mono, monospace)" }}>
                              Alt: {img.flight_altitude_m || 50}m AGL · {img.latitude ? `${img.latitude}°N` : "Georeferenced"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <select
                            value={img.view_type}
                            onChange={(e) => handleUpdateImageViewType(idx, e.target.value)}
                            style={{
                              fontSize: "10px",
                              backgroundColor: "#FFFFFF",
                              color: "#162F6A",
                              border: "1px solid #D9DDE5",
                              borderRadius: "3px",
                              padding: "2px 4px",
                              fontWeight: 600
                            }}
                          >
                            <option value="TOP">TOP (Nadir)</option>
                            <option value="FRONT">FRONT (South)</option>
                            <option value="SIDE">SIDE (West)</option>
                            <option value="PERSPECTIVE">PERSPECTIVE</option>
                            <option value="UNSPECIFIED">UNSPECIFIED</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", padding: "2px" }}
                            title="Remove photo"
                          >
                            <Trash2 style={{ width: "13px", height: "13px" }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      height: "100%",
                      minHeight: "100px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px",
                      backgroundColor: "#F7F8FB",
                      border: "1px dashed #D9DDE5",
                      borderRadius: "4px",
                      textAlign: "center",
                      color: "#6B7086",
                      fontSize: "11px"
                    }}
                  >
                    <span>No survey photographs staged.</span>
                    <span style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "4px" }}>
                      Click 'Load Demo Drone Survey' or upload files above.
                    </span>
                  </div>
                )}
              </div>

              {analysisError && (
                <div style={{ padding: "6px 8px", borderRadius: "3px", backgroundColor: "#FDEDEC", border: "1px solid #F5B7B1", color: "#C0392B", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                  <span>{analysisError}</span>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================= */}
          {/* CENTER COLUMN: 03 QUALITY + 04 PRODUCTS + 05 AI         */}
          {/* ======================================================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 03 — SURVEY QUALITY */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileCheck style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                    03 — SURVEY QUALITY
                  </span>
                  <span style={{ fontSize: "10px", color: "#6B7086", fontWeight: 600 }}>
                    Stage 2: Quality Checklist
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: analysisResult ? "#E8F5E9" : "#EEF1F4",
                    color: analysisResult ? "#2E9E52" : "#6B7086",
                    border: analysisResult ? "1px solid #A5D6A7" : "1px solid #D9DDE5"
                  }}
                >
                  {analysisResult ? "AUDIT COMPLETE" : "PENDING AUDIT"}
                </span>
              </div>

              {/* Quality Audit Checks Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                <div style={{ padding: "6px 4px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px", textAlign: "center" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Coverage</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: coverageStatus === "PASS" ? "#2E9E52" : coverageStatus === "REVIEW" ? "#B7791F" : "#6B7086" }}>
                    {coverageStatus}
                  </span>
                </div>
                <div style={{ padding: "6px 4px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px", textAlign: "center" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Georeferencing</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: georefStatus === "PASS" ? "#2E9E52" : "#B7791F" }}>
                    {georefStatus}
                  </span>
                </div>
                <div style={{ padding: "6px 4px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px", textAlign: "center" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Spatial Ref</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: crsStatus === "PASS" ? "#2E9E52" : "#6B7086" }}>
                    {crsStatus}
                  </span>
                </div>
                <div style={{ padding: "6px 4px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px", textAlign: "center" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Ground Control</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: gcpStatus === "PASS" ? "#2E9E52" : "#B7791F" }}>
                    {gcpStatus}
                  </span>
                </div>
                <div style={{ padding: "6px 4px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px", textAlign: "center" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Completeness</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: completenessStatus === "PASS" ? "#2E9E52" : completenessStatus === "REVIEW" ? "#B7791F" : "#6B7086" }}>
                    {completenessStatus}
                  </span>
                </div>
              </div>

              {/* Detailed Checklist Table if analysisResult present */}
              {analysisResult && (
                <div style={{ border: "1px solid #D9DDE5", borderRadius: "3px", overflow: "hidden", maxHeight: "150px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", textAlign: "left" }}>
                    <thead style={{ backgroundColor: "#EEF1F4", color: "#46516B", borderBottom: "1px solid #D9DDE5" }}>
                      <tr>
                        <th style={{ padding: "4px 8px", fontWeight: 700 }}>Checkpoint</th>
                        <th style={{ padding: "4px 8px", fontWeight: 700 }}>Category</th>
                        <th style={{ padding: "4px 8px", fontWeight: 700 }}>Status</th>
                        <th style={{ padding: "4px 8px", fontWeight: 700 }}>Assessment Details</th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: "#FFFFFF" }}>
                      {analysisResult.quality_checks.map((chk, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #EEF1F4" }}>
                          <td style={{ padding: "4px 8px", fontWeight: 600, color: "#0B1526" }}>{chk.check_name}</td>
                          <td style={{ padding: "4px 8px", color: "#6B7086" }}>{chk.category}</td>
                          <td style={{ padding: "4px 8px" }}>
                            <span style={{
                              padding: "1px 4px",
                              borderRadius: "2px",
                              fontSize: "9px",
                              fontWeight: 700,
                              backgroundColor: chk.status === "AVAILABLE" ? "#E8F5E9" : chk.status === "ESTIMATED" ? "#E3F2FD" : "#FFF8E1",
                              color: chk.status === "AVAILABLE" ? "#2E9E52" : chk.status === "ESTIMATED" ? "#1F7AE0" : "#B7791F",
                              border: "1px solid currentColor"
                            }}>
                              {chk.status}
                            </span>
                          </td>
                          <td style={{ padding: "4px 8px", color: "#46516B" }}>{chk.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Elevation Datum Reference Section */}
              <div
                style={{
                  padding: "8px",
                  borderRadius: "3px",
                  backgroundColor: "#F7F8FB",
                  border: "1px solid #D9DDE5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px"
                }}
                data-testid="drone-survey-ground-datum"
              >
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#46516B", textTransform: "uppercase", display: "block" }}>
                    Prototype Vertical Elevation Reference
                  </span>
                  {analysisResult?.survey_coverage_metadata.ground_elevation_datum_m != null ? (
                    <>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#162F6A", fontFamily: "var(--font-mono, monospace)" }}>
                        {`Ground Z: ${analysisResult.survey_coverage_metadata.ground_elevation_datum_m.toFixed(1)} m`}
                      </span>
                      <span style={{ fontSize: "10px", color: "#6B7086", display: "block" }}>
                        Source: DEM-derived prototype reference
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#C0392B", display: "block" }}>
                        Ground Z unavailable
                      </span>
                      <span style={{ fontSize: "10px", color: "#6B7086", display: "block" }}>
                        Authoritative/reference elevation required
                      </span>
                    </>
                  )}
                </div>

                <div style={{ textAlign: "right", fontSize: "10px", color: "#46516B" }}>
                  <span style={{ fontWeight: 700, display: "block", color: "#162F6A" }}>
                    Flight Alt: {analysisResult?.survey_coverage_metadata.average_flight_altitude_m || 50}m AGL
                  </span>
                  <span>Spatial Reference: {crs}</span>
                </div>
              </div>

              {/* Statutory Distinction: Flight altitude / AGL ≠ Ground Z ≠ absolute cadastral elevation datum */}
              <div style={{ padding: "6px 8px", borderRadius: "3px", backgroundColor: "#EEF1F4", border: "1px solid #D9DDE5", fontSize: "10px", color: "#46516B", display: "flex", alignItems: "start", gap: "6px", lineHeight: "1.4" }}>
                <Info style={{ width: "13px", height: "13px", color: "#1F7AE0", flexShrink: 0, marginTop: "1px" }} />
                <div>
                  <span style={{ fontWeight: 700, color: "#0B1526" }}>
                    Flight altitude / AGL ≠ Ground Z ≠ absolute cadastral elevation datum.
                  </span>
                  {" "}
                  Drone imagery provides surface/visual elevation evidence. Ground Z is resolved from available DEM/reference geospatial data.
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleExecuteAnalysis}
                disabled={isAnalyzing || images.length === 0}
                data-testid="btn-analyze-survey"
                style={{
                  height: "34px",
                  borderRadius: "4px",
                  border: "1px solid #162F6A",
                  backgroundColor: images.length > 0 ? "#162F6A" : "#EEF1F4",
                  color: images.length > 0 ? "#FFFFFF" : "#9CA3AF",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: images.length > 0 ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {isAnalyzing ? (
                  <>
                    <RotateCcw style={{ width: "14px", height: "14px" }} className="animate-spin" />
                    <span>Auditing Survey Imagery & Quality Checks...</span>
                  </>
                ) : (
                  <>
                    <Eye style={{ width: "14px", height: "14px" }} />
                    <span>Analyze Survey & Audit Evidence</span>
                    <ArrowRight style={{ width: "14px", height: "14px" }} />
                  </>
                )}
              </button>
            </div>

            {/* 04 — DERIVED PRODUCTS */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                  04 — DERIVED PRODUCTS
                </span>
                <span style={{ fontSize: "10px", color: "#6B7086" }}>
                  Transformation Pipeline
                </span>
              </div>

              {/* Transformation sequence diagram */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#F7F8FB", borderRadius: "3px", border: "1px solid #D9DDE5", fontSize: "9px", fontWeight: 700, color: "#46516B", fontFamily: "var(--font-mono, monospace)" }}>
                <span>DRONE IMAGES</span>
                <span>↓</span>
                <span>ORTHO / IMAGE MOSAIC</span>
                <span>↓</span>
                <span>ELEVATION / DSM</span>
                <span>↓</span>
                <span>3D / POINT-CLOUD EVIDENCE</span>
                <span>↓</span>
                <span>BUILDING GEOMETRY</span>
              </div>

              {/* Technical Product Blocks */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>True Orthomosaic (TIF/COG)</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: analysisResult?.is_demo_survey ? "#FFF8E1" : "#E8F5E9", color: analysisResult?.is_demo_survey ? "#B7791F" : "#2E9E52" }}>
                      {analysisResult?.is_demo_survey ? "DEMO / STAGED" : analysisResult ? "DERIVED" : "STAGED"}
                    </span>
                  </div>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", marginTop: "2px" }}>
                    0.021m GSD nadir composite · RGB Ortho
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Elevation / DSM</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: analysisResult?.is_demo_survey ? "#FFF8E1" : "#E8F5E9", color: analysisResult?.is_demo_survey ? "#B7791F" : "#2E9E52" }}>
                      {analysisResult?.is_demo_survey ? "DEMO / STAGED" : analysisResult ? "DERIVED" : "STAGED"}
                    </span>
                  </div>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", marginTop: "2px" }}>
                    Copernicus DEM + Drone Surface Reference
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>3D / Point-Cloud Evidence</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: hasPointCloud ? "#E8F5E9" : "#F5F5F5", color: hasPointCloud ? "#2E9E52" : "#6B7086" }}>
                      {hasPointCloud ? (analysisResult?.is_demo_survey ? "DEMO / STAGED" : "AVAILABLE") : "NOT AVAILABLE"}
                    </span>
                  </div>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", marginTop: "2px" }}>
                    {hasPointCloud ? pointCloudRef : "Photogrammetric dense point cloud"}
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Building Geometry</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: analysisResult ? "#E3F2FD" : "#F5F5F5", color: analysisResult ? "#1F7AE0" : "#6B7086" }}>
                      {analysisResult ? "DERIVED" : "STAGED"}
                    </span>
                  </div>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", marginTop: "2px" }}>
                    LoD1 Polyhedral Boundary Extrusion Wireframe
                  </span>
                </div>
              </div>
            </div>

            {/* 05 — AI RECONSTRUCTION */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Cpu style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                  05 — AI RECONSTRUCTION (Assistance Layer)
                </span>
                <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "2px", backgroundColor: "#E3F2FD", color: "#1F7AE0", border: "1px solid #90CAF9" }}>
                  AI-ASSISTED
                </span>
              </div>

              {/* Relationship Diagram */}
              <div style={{ padding: "4px 8px", backgroundColor: "#F7F8FB", borderRadius: "3px", border: "1px solid #D9DDE5", fontSize: "9px", color: "#46516B", textAlign: "center", fontWeight: 600 }}>
                SURVEY EVIDENCE + EXISTING GIS DATA → AI-ASSISTED ANALYSIS → BUILDING / HEIGHT / ATTRIBUTE OUTPUT
              </div>

              {/* 4 Capabilities */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Height Estimation</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#1F7AE0" }}>AI-ASSISTED</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", display: "block", marginTop: "2px" }}>
                    ~15.0 m (Estimated)
                  </span>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block" }}>
                    Oblique shadow & parallax triangulation
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Building Typology</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#B7791F" }}>ESTIMATED</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", display: "block", marginTop: "2px" }}>
                    Commercial G+4
                  </span>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block" }}>
                    Facade window rhythm & roof structure
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Anomaly Detection</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#1F7AE0" }}>AI-ASSISTED</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#2E9E52", display: "block", marginTop: "2px" }}>
                    Zero Encroachment
                  </span>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block" }}>
                    Within registered parcel footprint envelope
                  </span>
                </div>

                <div style={{ padding: "6px 8px", borderRadius: "3px", border: "1px solid #D9DDE5", backgroundColor: "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>Data Enrichment</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#B7791F" }}>ESTIMATED</span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", display: "block", marginTop: "2px" }}>
                    Spatial Anchoring
                  </span>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block" }}>
                    EXIF geotag & Ground Z integration
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* RIGHT COLUMN: 06 CADASTRAL HANDOFF + STATUS + NOTICES   */}
          {/* ======================================================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 06 — CADASTRAL HANDOFF */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Compass style={{ width: "14px", height: "14px", color: "#162F6A" }} />
                  06 — CADASTRAL HANDOFF
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: "#FFF8E1",
                    color: "#B7791F",
                    border: "1px solid #FFE082"
                  }}
                >
                  PROPOSED
                </span>
              </div>

              {/* Workflow Flow */}
              <div style={{ padding: "4px 8px", backgroundColor: "#F7F8FB", borderRadius: "3px", border: "1px solid #D9DDE5", fontSize: "9px", color: "#46516B", textAlign: "center", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                SURVEY EVIDENCE ↓ VALIDATED GEOMETRY ↓ 3D BUILDING ↓ VERTICAL PROPERTY STRATA ↓ PROPOSED 3D PROPERTY ID
              </div>

              {/* Proposed Property ID Header */}
              <div style={{ padding: "8px", backgroundColor: "#F0F4FC", borderRadius: "3px", border: "1px solid #C2D4F8" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#162F6A", textTransform: "uppercase" }}>
                    PROPOSED 3D PROPERTY ID
                  </span>
                  <span style={{ fontSize: "8px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px", backgroundColor: "#FFFFFF", color: "#6B7086", border: "1px solid #D9DDE5" }}>
                    NON-AUTHORITATIVE RESEARCH OUTPUT
                  </span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#162F6A", fontFamily: "var(--font-mono, monospace)", display: "block", marginTop: "2px" }}>
                  {`3D-PROP-${(parcel?.ulpin_2d || 'TS-HYD-044').slice(-8)}-${surveyId.slice(-6)}`}
                </span>
              </div>

              {/* Compact Handoff Panel Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>PARENT PARCEL</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526", fontFamily: "var(--font-mono, monospace)" }}>
                    {parcel?.ulpin_2d || parcel?.id || "TS-HYD-044-PARCEL-01"}
                  </span>
                </div>

                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>BUILDING</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>
                    {_building?.building_code || _building?.building_name || "TOWER-A (COMMERCIAL)"}
                  </span>
                </div>

                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>FLOOR / UNIT</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526" }}>
                    {_building?.unit_count ? `${_building.unit_count} Units (G+${_building.total_floors_above || 4})` : "Ground to Roof (G+4)"}
                  </span>
                </div>

                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>STATUS</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#B7791F" }}>
                    PROPOSED
                  </span>
                </div>

                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Z-MIN (Ground)</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526", fontFamily: "var(--font-mono, monospace)" }}>
                    {analysisResult?.survey_coverage_metadata.ground_elevation_datum_m != null
                      ? `${analysisResult.survey_coverage_metadata.ground_elevation_datum_m.toFixed(1)} m`
                      : "540.0 m (Est)"}
                  </span>
                </div>

                <div style={{ padding: "6px 8px", backgroundColor: "#F7F8FB", border: "1px solid #D9DDE5", borderRadius: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#6B7086", display: "block", fontWeight: 700 }}>Z-MAX (Roof)</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#0B1526", fontFamily: "var(--font-mono, monospace)" }}>
                    {analysisResult?.survey_coverage_metadata.ground_elevation_datum_m != null
                      ? `${(analysisResult.survey_coverage_metadata.ground_elevation_datum_m + 15.0).toFixed(1)} m`
                      : "555.0 m (Est)"}
                  </span>
                </div>
              </div>

              {/* Handoff Execution Action */}
              <button
                type="button"
                onClick={handleHandoffToAi}
                disabled={!analysisResult}
                data-testid="btn-send-to-ai"
                style={{
                  height: "36px",
                  borderRadius: "4px",
                  border: "1px solid #C48E28",
                  backgroundColor: analysisResult ? "#E0A93C" : "#EEF1F4",
                  color: analysisResult ? "#0B1526" : "#9CA3AF",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: analysisResult ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  marginTop: "4px"
                }}
              >
                <span>STAGE 4: Cadastral Handoff to AI Image → 3D</span>
                <ArrowRight style={{ width: "14px", height: "14px" }} />
              </button>
            </div>

            {/* SURVEY STATUS & METADATA */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D9DDE5",
                borderRadius: "4px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEF1F4", paddingBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#162F6A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  SURVEY STATUS & KEY OUTPUTS
                </span>
                <span style={{ fontSize: "10px", color: "#2E9E52", fontWeight: 700 }}>
                  {analysisResult ? "VALIDATED" : "STAGED"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", color: "#46516B" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6B7086" }}>Survey ID:</span>
                  <span style={{ fontWeight: 700, color: "#0B1526", fontFamily: "var(--font-mono, monospace)" }}>{surveyId}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6B7086" }}>Operating Agency:</span>
                  <span style={{ fontWeight: 600, color: "#0B1526" }}>{operatorAgency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6B7086" }}>CRS Projection:</span>
                  <span style={{ fontWeight: 700, color: "#0B1526", fontFamily: "var(--font-mono, monospace)" }}>{crs}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6B7086" }}>Staged Photographs:</span>
                  <span style={{ fontWeight: 700, color: "#0B1526" }}>{images.length} Evidence Views</span>
                </div>
              </div>
            </div>

            {/* STATUTORY & REGULATORY NOTICES */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Statutory Underground Disclaimer Banner */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "4px",
                  backgroundColor: "#FFF8E1",
                  border: "1px solid #FFE082",
                  fontSize: "10px",
                  color: "#7A5200",
                  display: "flex",
                  alignItems: "start",
                  gap: "8px",
                  lineHeight: "1.4"
                }}
                data-testid="drone-survey-underground-notice"
              >
                <ShieldAlert style={{ width: "16px", height: "16px", color: "#B7791F", flexShrink: 0, marginTop: "1px" }} />
                <div>
                  <span style={{ fontWeight: 800, color: "#5A3B00", display: "block" }}>
                    STATUTORY LIMITATION NOTICE: Subsurface Structures & Basements
                  </span>
                  Drone photogrammetry and optical sensors cannot detect underground structures or subsurface utilities. Basement levels and foundation geometry require building sanction plans, as-built architectural drawings, or ground-penetrating radar (GPR) validation.
                </div>
              </div>

              {/* Photogrammetric / LiDAR architecture support notice */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "4px",
                  backgroundColor: "#EEF1F4",
                  border: "1px solid #D9DDE5",
                  fontSize: "10px",
                  color: "#46516B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Info style={{ width: "14px", height: "14px", color: "#1F7AE0", flexShrink: 0 }} />
                  <span>
                    PHOTOGRAMMETRY & LIDAR POINT CLOUD INTEGRATION: Dense point clouds (LAS / LAZ / E57 / COPC) supported as observational upstream evidence.
                  </span>
                </div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#162F6A", fontFamily: "var(--font-mono, monospace)", flexShrink: 0 }}>
                  LAS / LAZ / E57 / COPC
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
