import React, { useState, useMemo } from "react";
import {
  Globe,
  MapPin,
  Building2,
  Layers,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Search,
  RotateCcw,
  Maximize,
} from "lucide-react";
import type { VerticalUnit, LayerVisibility } from "../types/cadastre";

export interface VerticalExplorerProps {
  units: VerticalUnit[];
  selectedUnit: VerticalUnit | null;
  onSelectUnit: (unit: VerticalUnit | null) => void;
  isolatedUnitId?: string | null;
  onToggleIsolate?: (unitId: string) => void;
  onOpenParcelOverview?: () => void;
  layers?: LayerVisibility;
  onChangeLayers?: (layers: LayerVisibility) => void;
  onResetCamera?: () => void;
  is2DView?: boolean;
  onToggle2DView?: () => void;
  subUnitsMap?: Record<string, VerticalUnit[]>;
  expandedFloorIds?: Set<string>;
  onToggleExpandFloor?: (unitId: string) => void;
  onOpenAiReconstruction?: () => void;
  onOpenDroneSurvey?: () => void;
  onOpenGisAnalysis?: (tab?: "summary" | "layers" | "nearby" | "validation") => void;
  onOpenPropertyRegistry?: () => void;
  onOpenReviewWorkspace?: () => void;
  onOpenDossier?: () => void;
}

export const VerticalExplorer: React.FC<VerticalExplorerProps> = ({
  units,
  selectedUnit,
  onSelectUnit,
  isolatedUnitId: _isolatedUnitId,
  onToggleIsolate: _onToggleIsolate,
  onOpenParcelOverview,
  layers,
  onChangeLayers,
  onResetCamera,
  is2DView,
  onToggle2DView,
  subUnitsMap = {},
  expandedFloorIds: propExpandedFloorIds,
  onToggleExpandFloor: propOnToggleExpandFloor,
  onOpenAiReconstruction: _onOpenAiReconstruction,
  onOpenDroneSurvey: _onOpenDroneSurvey,
  onOpenGisAnalysis: _onOpenGisAnalysis,
  onOpenPropertyRegistry: _onOpenPropertyRegistry,
  onOpenReviewWorkspace: _onOpenReviewWorkspace,
  onOpenDossier: _onOpenDossier,
}) => {
  const [activeExploreItem, setActiveExploreItem] = useState<"globe" | "parcels" | "buildings" | "units">("units");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTierFilter] = useState<string>("ALL");
  const [showLayerControls, setShowLayerControls] = useState<boolean>(false);
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set(["F01", "F02", "F03"]));

  const isFloorExpanded = (floorIdOrCode: string) => {
    if (propExpandedFloorIds) {
      return propExpandedFloorIds.has(floorIdOrCode);
    }
    return localExpandedIds.has(floorIdOrCode);
  };

  const toggleExpand = (unit: VerticalUnit) => {
    if (propOnToggleExpandFloor) {
      propOnToggleExpandFloor(unit.id);
    } else {
      setLocalExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(unit.id) || next.has(unit.floor_code)) {
          next.delete(unit.id);
          next.delete(unit.floor_code);
        } else {
          next.add(unit.id);
          next.add(unit.floor_code);
        }
        return next;
      });
    }
  };

  const sortedStoreyUnits = useMemo(() => {
    const storeys = units.filter(
      (u) => !u.unit_level || u.unit_level === "STOREY" || (!u.flat_number && u.tier_code !== "CM")
    );
    return storeys.sort((a, b) => b.z_min - a.z_min);
  }, [units]);

  const filteredStoreys = useMemo(() => {
    return sortedStoreyUnits.filter((u) => {
      if (selectedTierFilter !== "ALL" && u.tier_code !== selectedTierFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const codeMatch = u.floor_code?.toLowerCase().includes(q);
      const ulpinMatch = u.prototype_ulpin_3d?.toLowerCase().includes(q);
      const typeMatch = u.unit_type?.toLowerCase().includes(q);
      const subMatch = (subUnitsMap[u.id] || []).some(
        (sub) =>
          sub.flat_number?.toLowerCase().includes(q) ||
          sub.prototype_ulpin_3d?.toLowerCase().includes(q)
      );
      return codeMatch || ulpinMatch || typeMatch || subMatch;
    });
  }, [sortedStoreyUnits, selectedTierFilter, searchQuery, subUnitsMap]);

  const getStatusBadge = (status: VerticalUnit["status"]) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 5px",
              borderRadius: "2px",
              fontFamily: "var(--font-sans, Inter)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(46, 158, 82, 0.12)",
              color: "#2E9E52",
              border: "1px solid rgba(46, 158, 82, 0.35)",
              whiteSpace: "nowrap",
            }}
          >
            VALIDATED
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 5px",
              borderRadius: "2px",
              fontFamily: "var(--font-sans, Inter)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(183, 121, 31, 0.12)",
              color: "#B7791F",
              border: "1px solid rgba(183, 121, 31, 0.35)",
              whiteSpace: "nowrap",
            }}
          >
            REVIEW
          </span>
        );
      case "PROPOSED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 5px",
              borderRadius: "2px",
              fontFamily: "var(--font-sans, Inter)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "#EBEAEA",
              color: "#2C2C2C",
              border: "1px solid #D9DEE5",
              whiteSpace: "nowrap",
            }}
          >
            PROPOSED
          </span>
        );
      case "REJECTED":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 5px",
              borderRadius: "2px",
              fontFamily: "var(--font-sans, Inter)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(192, 57, 43, 0.12)",
              color: "#C0392B",
              border: "1px solid rgba(192, 57, 43, 0.35)",
              whiteSpace: "nowrap",
            }}
          >
            CONFLICT
          </span>
        );
      default:
        return null;
    }
  };

  const getTierLabel = (tier: string, floorCode?: string) => {
    const fc = (floorCode || "").toUpperCase();
    if (tier === "SB" || tier === "UT" || fc.startsWith("B") || fc.startsWith("SB")) {
      return "Sub-Basement";
    }
    if (fc === "F00" || fc === "GF" || fc === "P00") {
      return "Ground";
    }
    if (tier === "AR" || tier === "AE" || fc.startsWith("RF") || fc.startsWith("AR")) {
      return "Air Rights";
    }
    if (tier === "CM") {
      return "Common Area";
    }
    return "Habitable Storey";
  };

  return (
    <aside
      className="vertical-explorer-panel"
      data-testid="vertical-explorer"
      style={{
        width: "260px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        borderRight: "1px solid #D9DEE5",
        color: "#162F6A",
        zIndex: 20,
        flexShrink: 0,
        boxShadow: "1px 0 4px rgba(22, 37, 92, 0.04)",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #D9DEE5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#F7F8FB",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Building2 style={{ width: "16px", height: "16px", color: "#162F6A" }} />
          <h2
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#162F6A",
            }}
          >
            Property Explorer
          </h2>
        </div>

        {onOpenParcelOverview && (
          <button
            type="button"
            onClick={onOpenParcelOverview}
            style={{
              background: "#FFFFFF",
              border: "1px solid #D9DEE5",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "10.5px",
              fontWeight: 600,
              color: "#162F6A",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 1px 2px rgba(11, 19, 32, 0.04)",
            }}
            title="Open 3D Dataset Overview Modal"
          >
            <Layers style={{ width: "11px", height: "11px" }} />
            <span>Dataset Overview</span>
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          padding: "4px 8px",
          backgroundColor: "#EBEAEA",
          borderBottom: "1px solid #D9DEE5",
        }}
      >
        {[
          { key: "globe", label: "Globe", icon: Globe, onClick: () => { setActiveExploreItem("globe"); onResetCamera && onResetCamera(); } },
          { key: "parcels", label: "Parcels", icon: MapPin, onClick: () => { setActiveExploreItem("parcels"); onOpenParcelOverview && onOpenParcelOverview(); } },
          { key: "buildings", label: "Buildings", icon: Building2, onClick: () => { setActiveExploreItem("buildings"); } },
          { key: "units", label: "Units", icon: Layers, onClick: () => { setActiveExploreItem("units"); } },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeExploreItem === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                padding: "6px 2px",
                borderRadius: "4px",
                border: "none",
                background: isActive ? "#FFFFFF" : "transparent",
                color: isActive ? "#162F6A" : "#6B7086",
                fontWeight: isActive ? 700 : 500,
                fontSize: "11px",
                cursor: "pointer",
                boxShadow: isActive ? "0 1px 3px rgba(22, 37, 92, 0.08)" : "none",
                borderBottom: isActive ? "2px solid #E0A93C" : "2px solid transparent",
                transition: "all 0.15s ease",
              }}
            >
              <Icon style={{ width: "13px", height: "13px", color: isActive ? "#162F6A" : "#6B7086" }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "8px 10px", borderBottom: "1px solid #D9DEE5", backgroundColor: "#FFFFFF" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#F7F8FB",
            border: "1px solid #D9DEE5",
            borderRadius: "4px",
            padding: "5px 8px",
          }}
        >
          <Search style={{ width: "13px", height: "13px", color: "#6B7086", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search floor, unit or property ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "11.5px",
              color: "#162F6A",
              fontFamily: "var(--font-sans, Inter)",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ background: "transparent", border: "none", color: "#6B7086", cursor: "pointer", fontSize: "12px" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "8px 12px 6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #EBEAEA",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#162F6A",
            }}
          >
            Vertical Property Strata
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "3px",
              background: "#EBEAEA",
              color: "#162F6A",
            }}
          >
            {units.length} LEVELS
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowLayerControls(!showLayerControls)}
          style={{
            background: showLayerControls ? "#EBEAEA" : "transparent",
            border: "1px solid #D9DEE5",
            borderRadius: "4px",
            padding: "3px 6px",
            fontSize: "10.5px",
            fontWeight: 500,
            color: "#2C2C2C",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
          title="Toggle Cadastral Layer Visibility"
        >
          <SlidersHorizontal style={{ width: "11px", height: "11px" }} />
          <span>Layers</span>
        </button>
      </div>

      {showLayerControls && layers && onChangeLayers && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#F7F8FB",
            borderBottom: "1px solid #D9DEE5",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          {[
            { key: "parcels", label: "2D Parcels" },
            { key: "buildings", label: "Buildings" },
            { key: "floors", label: "Storeys" },
            { key: "subUnits", label: "Units / Flats" },
          ].map((l) => (
            <label
              key={l.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                color: "#2C2C2C",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={(layers as any)[l.key]}
                onChange={(e) => onChangeLayers({ ...layers, [l.key]: e.target.checked })}
                style={{ cursor: "pointer" }}
              />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0",
          display: "flex",
          flexDirection: "column",
          gap: "0",
          backgroundColor: "#FFFFFF",
        }}
      >
        {filteredStoreys.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "#6B7086", fontSize: "11.5px" }}>
            No vertical strata matching current filter.
          </div>
        ) : (
          filteredStoreys.map((unit) => {
            const isSelected = selectedUnit?.id === unit.id;
            const subUnits = subUnitsMap[unit.id] || [];
            const hasSubUnits = subUnits.length > 0;
            const isExpanded = isFloorExpanded(unit.id) || isFloorExpanded(unit.floor_code);

            return (
              <div
                key={unit.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: isSelected ? "#EBEAEA" : "#FFFFFF",
                  borderBottom: "1px solid #EBEAEA",
                  overflow: "hidden",
                  transition: "background 0.1s ease",
                }}
              >
                <div
                  onClick={() => onSelectUnit(unit)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#EBEAEA" : "#FFFFFF",
                    borderLeft: isSelected ? "3px solid #E0A93C" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 700,
                        fontSize: "11px",
                        padding: "2px 5px",
                        borderRadius: "3px",
                        background: isSelected ? "#162F6A" : "#EBEAEA",
                        color: isSelected ? "#FFFFFF" : "#162F6A",
                        minWidth: "32px",
                        textAlign: "center",
                      }}
                    >
                      {unit.floor_code}
                    </span>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#162F6A",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {getTierLabel(unit.tier_code, unit.floor_code)}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "10px",
                          color: "#6B7086",
                        }}
                      >
                        +{unit.z_min.toFixed(1)} → +{unit.z_max.toFixed(1)} m
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {getStatusBadge(unit.status)}

                    {hasSubUnits && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(unit);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px",
                          color: "#6B7086",
                        }}
                        title={isExpanded ? "Collapse floor flats" : "Expand floor flats"}
                      >
                        {isExpanded ? (
                          <ChevronDown style={{ width: "13px", height: "13px" }} />
                        ) : (
                          <ChevronRight style={{ width: "13px", height: "13px" }} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {hasSubUnits && isExpanded && (
                  <div
                    style={{
                      borderTop: "1px solid #EBEAEA",
                      backgroundColor: "#F7F8FB",
                      padding: "4px 8px 6px 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    {subUnits.map((sub) => {
                      const isSubSelected = selectedUnit?.id === sub.id;
                      return (
                        <div
                          key={sub.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUnit(sub);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "4px 8px",
                            borderRadius: "2px",
                            background: isSubSelected ? "#EBEAEA" : "#FFFFFF",
                            border: isSubSelected ? "1px solid #E0A93C" : "1px solid #D9DEE5",
                            borderLeft: isSubSelected ? "3px solid #E0A93C" : "1px solid #D9DEE5",
                            cursor: "pointer",
                            fontSize: "11px",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#162F6A" }}>
                            Flat {sub.flat_number || sub.unit_label || sub.floor_code}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono, monospace)", color: "#6B7086", fontSize: "10px" }}>
                            {sub.prototype_ulpin_3d ? sub.prototype_ulpin_3d.slice(-6) : "STRATA"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid #D9DEE5",
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        {onToggle2DView && (
          <button
            type="button"
            onClick={onToggle2DView}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "5px 8px",
              borderRadius: "4px",
              background: is2DView ? "#162F6A" : "#EBEAEA",
              color: is2DView ? "#FFFFFF" : "#162F6A",
              border: "1px solid #D9DEE5",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>{is2DView ? "3D Perspective" : "2D Ortho Mode"}</span>
          </button>
        )}

        {onResetCamera && (
          <button
            type="button"
            onClick={onResetCamera}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "5px 8px",
              borderRadius: "4px",
              background: "#EBEAEA",
              color: "#2C2C2C",
              border: "1px solid #D9DEE5",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
            }}
            title="Reset 3D Camera"
          >
            <RotateCcw style={{ width: "12px", height: "12px" }} />
            <span>Reset</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            padding: "5px 8px",
            borderRadius: "4px",
            background: "#EBEAEA",
            color: "#2C2C2C",
            border: "1px solid #D9DEE5",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
          }}
          title="Toggle Fullscreen"
        >
          <Maximize style={{ width: "12px", height: "12px" }} />
          <span>Fullscreen</span>
        </button>
      </div>
    </aside>
  );
};
