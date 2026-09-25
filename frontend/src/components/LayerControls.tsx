import React, { useState } from "react";
import {
  Layers,
  Building as BuildingIcon,
  MapPin,
  Box,
  Ruler,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from "lucide-react";
import type { LayerVisibility, MeasurementMode } from "../types/cadastre";
import {
  setMeasurementMode,
  clearMeasurement,
  DEFAULT_MEASUREMENT_STATE,
} from "../utils/measurementUtils";

interface LayerControlsProps {
  layers: LayerVisibility;
  onChangeLayers: (layers: LayerVisibility) => void;
  onResetCamera: () => void;
  is2DView: boolean;
  onToggle2DView: () => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layers,
  onChangeLayers,
  onResetCamera,
  is2DView,
  onToggle2DView,
}) => {
  const [showAdvancedTools, setShowAdvancedTools] = useState<boolean>(false);

  const toggle = (key: keyof LayerVisibility) => {
    onChangeLayers({
      ...layers,
      [key]: !layers[key],
    });
  };

  const showAll = () => {
    onChangeLayers({
      ...layers,
      parcel: true,
      building: true,
      groundFloors: true,
      upperFloors: true,
      basements: true,
      utilities: true,
      rooftopElevated: true,
      commonCirculation: true,
      showVerified: true,
      showProposed: true,
      showUnderReview: true,
      showRejected: true,
      showConflictsOnly: false,
    });
  };

  const hideAll = () => {
    onChangeLayers({
      ...layers,
      parcel: false,
      building: false,
      groundFloors: false,
      upperFloors: false,
      basements: false,
      utilities: false,
      rooftopElevated: false,
      commonCirculation: false,
    });
  };

  const handleSetMeasurementMode = (mode: MeasurementMode) => {
    const currentState = layers.measurement || DEFAULT_MEASUREMENT_STATE;
    const newState = setMeasurementMode(currentState, mode);
    onChangeLayers({
      ...layers,
      measurement: newState,
    });
  };

  const handleClearMeasurement = () => {
    const currentState = layers.measurement || DEFAULT_MEASUREMENT_STATE;
    const newState = clearMeasurement(currentState);
    onChangeLayers({
      ...layers,
      measurement: newState,
    });
  };

  return (
    <div className="panel layer-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title">
          <Layers className="panel-icon" />
          <span>Cadastral Layers</span>
        </div>
        <div className="panel-actions">
          <button className="btn-text" onClick={showAll} title="Show all layers">
            All
          </button>
          <span className="divider">|</span>
          <button className="btn-text" onClick={hideAll} title="Hide all layers">
            None
          </button>
        </div>
      </div>

      {/* Primary Layer Checkboxes */}
      <div className="layer-list" style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: "5px" }}>
        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.parcel}
            onChange={() => toggle("parcel")}
          />
          <MapPin className="layer-item-icon icon-parcel" />
          <span className="layer-item-label">2D Parent Parcel Boundary</span>
        </label>

        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.building}
            onChange={() => toggle("building")}
          />
          <BuildingIcon className="layer-item-icon icon-building" />
          <span className="layer-item-label">Building Envelope / Footprint</span>
        </label>

        <div className="layer-section-title" style={{ marginTop: "4px" }}>3D Building Strata</div>

        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.rooftopElevated}
            onChange={() => toggle("rooftopElevated")}
          />
          <span className="tier-indicator tier-ar" />
          <span className="layer-item-label">Rooftop Common Terrace (RF01)</span>
        </label>

        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.upperFloors}
            onChange={() => toggle("upperFloors")}
          />
          <span className="tier-indicator tier-f" />
          <span className="layer-item-label">Upper Floors (F01–F05)</span>
        </label>

        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.groundFloors}
            onChange={() => toggle("groundFloors")}
          />
          <span className="tier-indicator tier-ground" />
          <span className="layer-item-label">Ground Floor / Stilt (F00)</span>
        </label>

        <label className="layer-item">
          <input
            type="checkbox"
            checked={layers.basements}
            onChange={() => toggle("basements")}
          />
          <span className="tier-indicator tier-sb" />
          <span className="layer-item-label">Basement Parking (B01)</span>
        </label>
      </div>

      {/* Primary Quick Actions */}
      <div style={{ padding: "6px 12px", display: "flex", gap: "6px" }}>
        <button
          className={`btn-mode ${layers.undergroundMode ? "active" : ""}`}
          onClick={() => toggle("undergroundMode")}
          style={{ flex: 1, padding: "5px 8px", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
          title="Make ground translucent to reveal subterranean parking"
        >
          <Box style={{ width: "12px", height: "12px" }} />
          <span>Underground</span>
        </button>

        <button
          className="btn-mode"
          onClick={onToggle2DView}
          style={{ flex: 1, padding: "5px 8px", fontSize: "0.72rem" }}
          title="Toggle 2D / 3D Perspective"
        >
          <span>{is2DView ? "3D Perspective" : "2D Top-Down"}</span>
        </button>
      </div>

      <div style={{ padding: "0 12px 6px 12px" }}>
        <button
          className="btn-secondary"
          onClick={onResetCamera}
          style={{ width: "100%", padding: "5px 8px", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
        >
          <RotateCcw style={{ width: "12px", height: "12px" }} />
          <span>Reset Camera on Building</span>
        </button>
      </div>

      {/* Collapsible Advanced Tools Drawer */}
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: "4px" }}>
        <button
          type="button"
          onClick={() => setShowAdvancedTools(!showAdvancedTools)}
          style={{
            width: "100%",
            background: "rgba(255, 255, 255, 0.03)",
            border: "none",
            padding: "8px 12px",
            color: "#94a3b8",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>Advanced GIS & 3D Measurement Tools</span>
          {showAdvancedTools ? <ChevronUp style={{ width: "14px", height: "14px" }} /> : <ChevronDown style={{ width: "14px", height: "14px" }} />}
        </button>

        {showAdvancedTools && (
          <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(15, 23, 42, 0.5)" }}>
            {/* 1. VISUALIZATION MODES */}
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em", color: "#38bdf8", marginBottom: "6px" }}>
                VISUALIZATION OVERLAYS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button
                  type="button"
                  className={`btn-mode ${layers.wireframeMode ? "active" : ""}`}
                  onClick={() => toggle("wireframeMode")}
                  style={{ padding: "4px 6px", fontSize: "0.68rem" }}
                  title="Show wireframe overlay on building"
                >
                  Wireframe
                </button>
                <button
                  type="button"
                  className={`btn-mode ${layers.cutaway?.enabled ? "active" : ""}`}
                  onClick={() => {
                    const cur = layers.cutaway || { enabled: false, axis: "Y", positionPercent: 50, invert: false, opacity: 0.15 };
                    onChangeLayers({
                      ...layers,
                      cutaway: { ...cur, enabled: !cur.enabled },
                    });
                  }}
                  style={{ padding: "4px 6px", fontSize: "0.68rem" }}
                  title="Enable sectional cutaway"
                >
                  Section Cutaway
                </button>
                <button
                  type="button"
                  className={`btn-mode ${layers.elevationLevels ? "active" : ""}`}
                  onClick={() => toggle("elevationLevels")}
                  style={{ padding: "4px 6px", fontSize: "0.68rem", gridColumn: "span 2", borderColor: layers.elevationLevels ? "#38bdf8" : undefined }}
                  title="Show architectural vertical elevation guide lines and labels"
                >
                  Elevation Levels
                </button>
              </div>
            </div>

            {/* 2. 3D MEASUREMENT */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                <Ruler style={{ width: "12px", height: "12px", color: "#f59e0b" }} />
                <span>3D SPATIAL MEASUREMENT</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                {[
                  { mode: "POINT_COORDS", label: "Point Pick" },
                  { mode: "DISTANCE_2D", label: "Horizontal Dist" },
                  { mode: "ELEVATION_DELTA", label: "Vertical Height" },
                  { mode: "DISTANCE_3D", label: "3D Distance" },
                ].map((item) => {
                  const isActive = layers.measurement?.mode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      className={`btn-mode ${isActive ? "active" : ""}`}
                      onClick={() => handleSetMeasurementMode(item.mode as MeasurementMode)}
                      style={{ padding: "4px", fontSize: "0.68rem" }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {layers.measurement?.mode !== "OFF" && (
                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                  <button
                    onClick={handleClearMeasurement}
                    style={{ flex: 1, padding: "3px", fontSize: "0.68rem", background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "3px", cursor: "pointer" }}
                  >
                    Clear Points
                  </button>
                  <button
                    onClick={() => handleSetMeasurementMode("OFF")}
                    style={{ flex: 1, padding: "3px", fontSize: "0.68rem", background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px", cursor: "pointer" }}
                  >
                    Exit Tool
                  </button>
                </div>
              )}
            </div>

            {/* 3. LIFECYCLE STATUS FILTERING */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "6px" }}>
                LIFECYCLE STATUS FILTERING
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#e2e8f0" }}>
                  <input type="checkbox" checked={layers.showVerified} onChange={() => toggle("showVerified")} />
                  <span>Verified</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#e2e8f0" }}>
                  <input type="checkbox" checked={layers.showUnderReview} onChange={() => toggle("showUnderReview")} />
                  <span>Review</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#e2e8f0" }}>
                  <input type="checkbox" checked={layers.showProposed} onChange={() => toggle("showProposed")} />
                  <span>Proposed</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "#e2e8f0" }}>
                  <input type="checkbox" checked={layers.showRejected} onChange={() => toggle("showRejected")} />
                  <span>Rejected</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
