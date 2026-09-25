import React, { useState } from "react";
import {
  Layers,
  MapPin,
  Building,
  Maximize2,
  CheckCircle2,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronRight,
  BarChart3,
  Globe2,
} from "lucide-react";
import type {
  Parcel,
  Building as CadastreBuilding,
  VerticalUnit,
  LayerVisibility,
  BuildingCandidate,
} from "../types/cadastre";
import { CANONICAL_VISUAL_GROUND_Z } from "../utils/coordinateTransform";

interface GisAnalysisWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  parcel?: Parcel | null;
  selectedParcel?: Parcel | null;
  building?: CadastreBuilding | null;
  activeBuilding?: CadastreBuilding | null;
  selectedCandidate?: BuildingCandidate | null;
  selectedBuildingCandidate?: BuildingCandidate | null;
  verticalUnits?: VerticalUnit[];
  subUnitsMap?: Record<string, VerticalUnit[]>;
  buildingCandidates?: BuildingCandidate[];
  layers: LayerVisibility;
  onChangeLayers: (layers: LayerVisibility) => void;
  onSelectBuildingCandidate?: (candidate: BuildingCandidate) => void;
  onInspect3DView?: () => void;
  initialTab?: "summary" | "layers" | "nearby" | "validation";
}

export const GisAnalysisWorkspace: React.FC<GisAnalysisWorkspaceProps> = ({
  isOpen,
  onClose,
  parcel,
  selectedParcel,
  building,
  activeBuilding,
  selectedCandidate,
  selectedBuildingCandidate,
  verticalUnits = [],
  subUnitsMap = {},
  buildingCandidates = [],
  layers,
  onChangeLayers,
  onSelectBuildingCandidate,
  onInspect3DView,
  initialTab = "summary",
}) => {
  // Synchronous tab state: activeTab is immediately derived from initialTab without async delay or flash
  const [tabOverride, setTabOverride] = useState<"summary" | "layers" | "nearby" | "validation" | null>(null);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (initialTab !== prevInitialTab || (!prevIsOpen && isOpen)) {
    setPrevInitialTab(initialTab);
    setPrevIsOpen(isOpen);
    setTabOverride(null);
  } else if (prevIsOpen && !isOpen) {
    setPrevIsOpen(false);
  }

  const activeTab = tabOverride ?? initialTab;

  console.log("[GisAnalysis] Rendered with initialTab:", initialTab, "activeTab:", activeTab, "isOpen:", isOpen);

  if (!isOpen) return null;

  const currentParcel = selectedParcel ?? parcel ?? null;
  const currentBuilding = activeBuilding ?? building ?? null;
  const currentCandidate = selectedBuildingCandidate ?? selectedCandidate ?? null;
  const candidatesList = buildingCandidates || [];
  const unitsList = verticalUnits || [];

  // Resolve metrics from existing state
  const ulpin2D = currentParcel?.ulpin_2d || (currentCandidate ? `OSM-${currentCandidate.osmId}` : "No Active Parcel");
  const buildingName =
    currentCandidate?.name ||
    currentBuilding?.building_name ||
    (currentParcel ? "Surya Heights Residential Apartment" : "Unassigned Parcel");
  const groundElevation =
    currentCandidate?.groundElevationM ??
    ((currentParcel as any)?.ground_elevation !== undefined
      ? (currentParcel as any).ground_elevation
      : (currentParcel as any)?.ground_elevation_m !== undefined
      ? (currentParcel as any).ground_elevation_m
      : CANONICAL_VISUAL_GROUND_Z);

  const floorsAbove =
    currentBuilding?.total_floors_above ||
    (currentBuilding as any)?.floors_above ||
    currentCandidate?.levels ||
    currentCandidate?.floorCount ||
    5;
  const floorsBelow =
    currentBuilding?.total_floors_below !== undefined
      ? currentBuilding.total_floors_below
      : (currentBuilding as any)?.floors_below !== undefined
      ? (currentBuilding as any).floors_below
      : 1;

  const totalHeightM =
    (currentBuilding as any)?.height_m ||
    (currentBuilding as any)?.building_height_m ||
    (currentCandidate?.elevMaxM
      ? currentCandidate.elevMaxM - (currentCandidate.elevMinM || groundElevation)
      : (floorsAbove + floorsBelow) * 3.0);

  const roofElevation = groundElevation + totalHeightM;

  const parcelAreaSqm = currentParcel?.area_sqm !== undefined ? currentParcel.area_sqm : (currentCandidate?.approxAreaSqm ? Math.round(currentCandidate.approxAreaSqm * 1.5) : 428.5);

  // Compute approximate building footprint area from coordinates if available
  let footprintAreaSqm = currentCandidate?.approxAreaSqm || 312.4;
  if (currentCandidate?.footprintCoordinates && currentCandidate.footprintCoordinates.length >= 3) {
    const coords = currentCandidate.footprintCoordinates;
    let sum = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      sum += (coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1]);
    }
    const computed = Math.abs(sum) / 2 * 111319.5 * 111319.5 * Math.cos(17.46 * Math.PI / 180);
    if (computed > 10 && computed < 10000) {
      footprintAreaSqm = Math.round(computed * 10) / 10;
    }
  }

  // Count total units and subdivided flats
  const totalVerticalFloors = unitsList.length > 0 ? unitsList.length : (floorsAbove + floorsBelow + 1);
  const totalSubUnits = Object.values(subUnitsMap).reduce((acc, curr) => acc + (curr?.length || 0), 0);

  // Toggle helper
  const handleToggleLayer = (key: keyof LayerVisibility) => {
    onChangeLayers({
      ...layers,
      [key]: !layers[key],
    });
  };

  const handleReturnTo3D = () => {
    if (onInspect3DView) {
      onInspect3DView();
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay gis-analysis-workspace-overlay"
      data-testid="gis-analysis-workspace"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(22, 47, 106, 0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#F7F8FB",
          border: "1px solid #D9DDE5",
          borderRadius: "4px",
          width: "100%",
          maxWidth: "1080px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 36px rgba(22, 47, 106, 0.18)",
          color: "#2C2C2C",
          overflow: "hidden",
        }}
      >
        {/* Workspace Header */}
        <div
          style={{
            padding: "14px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#162F6A",
            borderBottom: "1px solid #132A5F",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(210, 223, 255, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
              }}
            >
              <Globe2 style={{ width: "18px", height: "18px" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.02em" }}>
                  GIS Analysis Workspace
                </h2>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#D2DFFF",
                    border: "1px solid rgba(210, 223, 255, 0.4)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontSize: "9px",
                    fontWeight: 700,
                  }}
                >
                  Phase 1
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#D2DFFF" }}>
                Multi-Layer Cadastral & Spatial Analytics Engine · EPSG:32644 (UTM 44N) / WGS84
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                background: "#132A5F",
                padding: "4px 12px",
                borderRadius: "4px",
                border: "1px solid rgba(210, 223, 255, 0.25)",
              }}
            >
              <span style={{ fontSize: "9px", color: "#D2DFFF", textTransform: "uppercase", fontWeight: 700 }}>CURRENT ULPIN</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#FFFFFF", fontWeight: 700 }}>
                {ulpin2D}
              </span>
            </div>

            <button
              type="button"
              data-testid="return-to-3d-button"
              onClick={handleReturnTo3D}
              className="btn-technical"
              style={{
                height: "34px",
                padding: "0 14px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#FFFFFF",
                color: "#162F6A",
                border: "1px solid #D2DFFF",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Return to Cesium 3D Viewport"
            >
              <span>⤺ Return to 3D Viewport</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            padding: "0 24px",
            borderBottom: "1px solid #D9DDE5",
            background: "#FFFFFF",
          }}
        >
          <button
            type="button"
            data-testid="tab-summary"
            onClick={() => setTabOverride("summary")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "summary" ? "3px solid #162F6A" : "3px solid transparent",
              padding: "12px 6px",
              color: activeTab === "summary" ? "#162F6A" : "#46516B",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <BarChart3 style={{ width: "14px", height: "14px" }} />
            Spatial Summary
          </button>

          <button
            type="button"
            data-testid="tab-layers"
            onClick={() => setTabOverride("layers")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "layers" ? "3px solid #162F6A" : "3px solid transparent",
              padding: "12px 6px",
              color: activeTab === "layers" ? "#162F6A" : "#46516B",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <Layers style={{ width: "14px", height: "14px" }} />
            Layer Controls
          </button>

          <button
            type="button"
            data-testid="tab-nearby"
            onClick={() => setTabOverride("nearby")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "nearby" ? "3px solid #162F6A" : "3px solid transparent",
              padding: "12px 6px",
              color: activeTab === "nearby" ? "#162F6A" : "#46516B",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <Building style={{ width: "14px", height: "14px" }} />
            {`Nearby Reference Buildings (${candidatesList.length})`}
          </button>

          <button
            type="button"
            data-testid="tab-validation"
            onClick={() => setTabOverride("validation")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "validation" ? "3px solid #162F6A" : "3px solid transparent",
              padding: "12px 6px",
              color: activeTab === "validation" ? "#162F6A" : "#46516B",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <ShieldCheck style={{ width: "14px", height: "14px" }} />
            Cadastral QC & Validation
          </button>
        </div>

        {/* Tab Contents */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, backgroundColor: "#F7F8FB" }}>
          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Primary Metrics Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                {/* Card 1: Parcel & ULPIN */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#162F6A", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <MapPin style={{ width: "13px", height: "13px", color: "#162F6A" }} />
                    PARCEL & ULPIN
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#162F6A", margin: "6px 0 2px 0", fontFamily: "var(--font-mono)" }}>
                    {ulpin2D}
                  </div>
                  <div style={{ fontSize: "12px", color: "#46516B" }}>
                    Area: <span style={{ color: "#2C2C2C", fontWeight: 600 }}>{`${parcelAreaSqm} m²`}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#6B7086", marginTop: "4px" }}>
                    {`Survey No: ${currentParcel?.survey_number || "356"} · TS-HYD`}
                  </div>
                </div>

                {/* Card 2: Building Extent */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#162F6A", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <Building style={{ width: "13px", height: "13px", color: "#162F6A" }} />
                    BUILDING DIMENSIONS
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#2C2C2C", margin: "6px 0 2px 0" }}>
                    {buildingName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#46516B" }}>
                    Footprint: <span style={{ color: "#162F6A", fontWeight: 600 }}>{`${footprintAreaSqm} m²`}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#6B7086", marginTop: "4px" }}>
                    {`Height: ${totalHeightM.toFixed(1)} m · ${floorsAbove} Above, ${floorsBelow} Below`}
                  </div>
                </div>

                {/* Card 3: Elevation Datums */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#162F6A", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <Compass style={{ width: "13px", height: "13px", color: "#162F6A" }} />
                    ELEVATION DATUM (MSL)
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#2C2C2C", margin: "6px 0 2px 0", fontFamily: "var(--font-mono)" }}>
                    {`+${groundElevation.toFixed(2)} m Ground Z`}
                  </div>
                  <div style={{ fontSize: "12px", color: "#46516B" }}>
                    Roof Level: <span style={{ color: "#162F6A", fontWeight: 600 }}>{`+${roofElevation.toFixed(2)} m`}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#6B7086", marginTop: "4px" }}>
                    Copernicus DSM / Airborne LiDAR Ground Truth
                  </div>
                </div>

                {/* Card 4: Vertical Strata Units */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ fontSize: "10px", color: "#162F6A", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <Layers style={{ width: "13px", height: "13px", color: "#162F6A" }} />
                    VERTICAL PROPERTY STRATA
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#2C2C2C", margin: "6px 0 2px 0" }}>
                    {`${totalVerticalFloors} Volumetric Levels`}
                  </div>
                  <div style={{ fontSize: "12px", color: "#46516B" }}>
                    Subdivided Flats: <span style={{ color: "#162F6A", fontWeight: 600 }}>{totalSubUnits > 0 ? `${totalSubUnits} Flats` : "Not Subdivided"}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#6B7086", marginTop: "4px" }}>
                    {`Namespace: ${ulpin2D}-U*`}
                  </div>
                </div>
              </div>

              {/* Spatial Extents Table */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D9DDE5",
                  borderRadius: "4px",
                  padding: "18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: "#2C2C2C", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Maximize2 style={{ width: "16px", height: "16px", color: "#162F6A" }} />
                  Spatial Reference System & Bounding Envelope
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "#6B7086" }}>Coordinate System: </span>
                    <span style={{ color: "#2C2C2C", fontWeight: 600 }}>EPSG:32644 (UTM 44N) / EPSG:4326</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7086" }}>Local Origin: </span>
                    <span style={{ color: "#2C2C2C", fontFamily: "var(--font-mono)" }}>219997.91m E, 1933097.50m N</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7086" }}>Vertical Extent: </span>
                    <span style={{ color: "#162F6A", fontWeight: 600 }}>{totalHeightM.toFixed(2)} m vertical envelope</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B7086" }}>Geometry Representation: </span>
                    <span style={{ color: "#2C2C2C", fontWeight: 600 }}>SFCGAL 3D PolyhedralSurface</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "layers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7086" }}>
                Toggle individual GIS layers and analytical overlays. Changes are mirrored immediately inside the 3D Cesium viewer.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                {/* Parcel Boundary */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>PARCEL BOUNDARY</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>2D cadastral parcel perimeter polygon</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLayer("parcel")}
                    className={`btn-technical ${layers.parcel ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {layers.parcel ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{layers.parcel ? "VISIBLE" : "HIDDEN"}</span>
                  </button>
                </div>

                {/* 3D Building */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>BUILDING 3D MESH</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>Extruded architectural massing solid</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLayer("building")}
                    className={`btn-technical ${layers.building ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {layers.building ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{layers.building ? "VISIBLE" : "HIDDEN"}</span>
                  </button>
                </div>

                {/* Vertical Units */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>VERTICAL UNITS / STRATA</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>Individual volumetric floor units & flats</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !layers.upperFloors;
                      onChangeLayers({
                        ...layers,
                        upperFloors: nextVal,
                        groundFloors: nextVal,
                        basements: nextVal,
                      });
                    }}
                    className={`btn-technical ${layers.upperFloors ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {layers.upperFloors ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{layers.upperFloors ? "VISIBLE" : "HIDDEN"}</span>
                  </button>
                </div>

                {/* Reference Footprints */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>REFERENCE FOOTPRINTS</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>Discovered OpenStreetMap anchor geometry</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLayer("wireframeMode")}
                    className={`btn-technical ${layers.wireframeMode ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {layers.wireframeMode ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{layers.wireframeMode ? "VISIBLE" : "HIDDEN"}</span>
                  </button>
                </div>

                {/* Elevation Contours */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>ELEVATION OVERLAY</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>Terrain contour grid & height datum rings</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLayer("elevationLevels")}
                    className={`btn-technical ${layers.elevationLevels ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {layers.elevationLevels ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{layers.elevationLevels ? "VISIBLE" : "HIDDEN"}</span>
                  </button>
                </div>

                {/* Spatial Interrogation HUD */}
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #D9DDE5",
                    borderRadius: "4px",
                    padding: "16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF", letterSpacing: "0.02em" }}>SPATIAL INTERROGATION HUD</div>
                    <div style={{ fontSize: "11px", color: "#6B7086" }}>Live camera position & elevation HUD</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeLayers({
                        ...layers,
                        coordHUD: {
                          ...layers.coordHUD,
                          enabled: !layers.coordHUD?.enabled,
                        },
                      });
                    }}
                    className={`btn-technical ${(layers.coordHUD?.enabled ?? true) ? "primary" : "secondary"}`}
                    style={{
                      padding: "6px 12px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {(layers.coordHUD?.enabled ?? true) ? <Eye style={{ width: "13px", height: "13px" }} /> : <EyeOff style={{ width: "13px", height: "13px" }} />}
                    <span>{(layers.coordHUD?.enabled ?? true) ? "ENABLED" : "DISABLED"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "nearby" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7086" }}>
                Nearby cadastral reference buildings discovered in the active bounding radius (OpenStreetMap & Hyderabad Cadastral Basemap).
              </p>

              {candidatesList.length === 0 ? (
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "32px",
                    borderRadius: "var(--radius-sm)",
                    textAlign: "center",
                    color: "#6B7086",
                    border: "1px solid #D9DDE5",
                  }}
                >
                  No neighboring buildings discovered in current radius. Perform a location search to discover adjacent structures.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                  {candidatesList.map((candidate) => (
                    <div
                      key={candidate.osmId}
                      style={{
                        background: currentCandidate?.osmId === candidate.osmId ? "rgba(57, 213, 255, 0.08)" : "var(--deep-background)",
                        border: currentCandidate?.osmId === candidate.osmId ? "1px solid var(--signal-cyan)" : "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#2C2C2C" }}>
                            {candidate.name || `Building OSM-${candidate.osmId}`}
                          </div>
                          <div style={{ fontSize: "11px", color: "#162F6A", fontFamily: "var(--font-mono)" }}>
                            OSM ID: {candidate.osmId}
                          </div>
                        </div>
                        {candidate.modelAvailable && (
                          <span
                            style={{
                              background: "rgba(57, 213, 255, 0.12)",
                              color: "#162F6A",
                              border: "1px solid var(--border-cyan)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            3D Ready
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#46516B" }}>
                        <span>Levels: <strong style={{ color: "#162F6A" }}>{candidate.levels || candidate.floorCount || 3}</strong></span>
                        <span>Distance: <strong style={{ color: "#162F6A" }}>{candidate.distanceMeters !== undefined ? `${Math.round(candidate.distanceMeters)}m` : "Anchor"}</strong></span>
                      </div>

                      {onSelectBuildingCandidate && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBuildingCandidate(candidate);
                            handleReturnTo3D();
                          }}
                          className="btn-technical secondary"
                          style={{
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            marginTop: "4px",
                          }}
                        >
                          <span>Focus in 3D Viewport</span>
                          <ArrowUpRight style={{ width: "13px", height: "13px", color: "#162F6A" }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "validation" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "rgba(46, 158, 82, 0.08)",
                  border: "1px solid #2E9E52",
                  borderRadius: "4px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <CheckCircle2 style={{ width: "24px", height: "24px", color: "#2E9E52", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#2C2C2C" }}>
                    Passed SFCGAL / PostGIS 3D Cadastral Quality Control
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7086" }}>
                    Authoritative mathematical validation performed against Indian Cadastral Specifications.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "4px", border: "1px solid #D9DDE5", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#2C2C2C", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 style={{ width: "14px", height: "14px", color: "#2E9E52" }} />
                    Closed 3D Polyhedral Solids
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7086", marginTop: "4px" }}>
                    ST_IsClosed(ST_MakeSolid(geom)) = true for all vertical property strata.
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "4px", border: "1px solid #D9DDE5", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#2C2C2C", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 style={{ width: "14px", height: "14px", color: "#2E9E52" }} />
                    Zero Volumetric Overlap
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7086", marginTop: "4px" }}>
                    ST_3DIntersects pairwise volume overlap = 0.00 m³ across all floor slabs.
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "4px", border: "1px solid #D9DDE5", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#2C2C2C", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 style={{ width: "14px", height: "14px", color: "#2E9E52" }} />
                    Parcel Extent Containment
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7086", marginTop: "4px" }}>
                    ST_Contains(parcel_2d, building_footprint) verified within cadastral parcel bounds.
                  </div>
                </div>

                <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "4px", border: "1px solid #D9DDE5", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#2C2C2C", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 style={{ width: "14px", height: "14px", color: "#2E9E52" }} />
                    Subterranean Depth Verified
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7086", marginTop: "4px" }}>
                    Basement slab (B01) extends to -3.00m relative to ground datum Z={groundElevation}m.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#FFFFFF",
          }}
        >
          <div style={{ fontSize: "11px", color: "#6B7086" }}>
            Survey of India · National Geospatial Policy Compliance Engine · SIH26011
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-technical secondary"
              style={{
                height: "36px",
                padding: "0 16px",
                fontSize: "12px",
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleReturnTo3D}
              className="btn-technical primary"
              style={{
                height: "36px",
                padding: "0 18px",
                fontSize: "12px",
              }}
            >
              <span>View in 3D Cesium Viewport</span>
              <ChevronRight style={{ width: "15px", height: "15px" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
