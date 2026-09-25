import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  Plane,
  ShieldCheck,
  Database,
  Earth,
  ChevronDown,
  CheckCircle2,
  Box,
  ArrowLeft,
} from "lucide-react";
import type { Parcel, Building, VerticalUnit, LocationSearchResult } from "../types/cadastre";
import type { UserRole } from "./LandingShell";
import { LocationSearchBar } from "./LocationSearchBar";
import { ViewModeToggle } from "./ViewModeToggle";

interface HeaderProps {
  currentView?: "landing" | "dashboard";
  onToggleView?: (view: "landing" | "dashboard") => void;
  parcels: Parcel[];
  selectedParcel: Parcel | null;
  onSelectParcel: (parcel: Parcel) => void;
  onSearchUlpin?: (ulpin: string) => Promise<void> | void;
  onSelectLocation?: (result: LocationSearchResult, options?: { autoSelectBestBuilding?: boolean }) => void;
  isConnected: boolean;
  onOpenGisAnalysis?: (tab?: "summary" | "layers" | "nearby" | "validation") => void;
  onOpenPropertyRegistry?: () => void;
  onOpenVerticalStrata?: () => void;
  onOpenAiReconstruction?: () => void;
  onOpenDroneSurvey?: () => void;
  onOpenReviewWorkspace?: () => void;
  onReturnToLanding?: () => void;
  buildings?: Building[];
  verticalUnits?: VerticalUnit[];
  buildingCandidate?: any;
  onToggleTheme?: () => void;
  theme?: any;
  activeRole?: UserRole;
  onChangeRole?: (role: UserRole) => void;
  showSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView = "dashboard",
  onToggleView,
  parcels = [],
  selectedParcel,
  onSelectParcel,
  onSearchUlpin,
  onSelectLocation,
  isConnected,
  onOpenGisAnalysis,
  onOpenPropertyRegistry,
  onOpenVerticalStrata,
  onOpenAiReconstruction,
  onOpenDroneSurvey,
  onReturnToLanding,
  activeRole = "ADMIN",
  onChangeRole,
  showSearch = false,
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roles: UserRole[] = ["ADMIN", "SURVEYOR", "ANALYST", "VIEWER"];

  return (
    <header
      className="command-navbar"
      style={{
        height: "54px",
        borderBottom: "1px solid rgba(220, 227, 242, 0.15)",
        backgroundColor: "#162F6A", // Dominant Midnight Navy
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      {/* LEFT: BRANDING & CADASTRAL IDENTIFIER */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {onReturnToLanding && (
          <button
            type="button"
            data-testid="return-to-landing-button"
            onClick={onReturnToLanding}
            title="Return to National Overview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(220, 227, 242, 0.2)",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: "13px", height: "13px" }} />
            <span>Landing</span>
          </button>
        )}

        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "4px",
            background: "rgba(224, 169, 60, 0.15)",
            border: "1px solid rgba(224, 169, 60, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#E0A93C",
          }}
        >
          <Box style={{ width: "15px", height: "15px" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
          <span
            style={{
              fontFamily: "var(--font-sans, Inter)",
              fontWeight: 700,
              fontSize: "14.5px",
              letterSpacing: "0.04em",
              color: "#FFFFFF",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            3D ULPIN
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              color: "#D2DFFF",
              letterSpacing: "0.02em",
              lineHeight: 1.1,
            }}
          >
            Vertical Property Mapping
          </span>
        </div>


      </div>

      {/* CENTER: MODULE NAVIGATION */}
      <nav style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <button
          type="button"
          data-testid="nav-3d-dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            background: "rgba(255, 255, 255, 0.08)",
            color: "#FFFFFF",
            border: "1px solid rgba(217, 222, 229, 0.2)",
            borderBottom: "2px solid #E0A93C",
            transition: "all 0.15s ease",
          }}
        >
          <Earth style={{ width: "13px", height: "13px", color: "#E0A93C" }} />
          <span>3D Dashboard</span>
        </button>

        <button
          type="button"
          data-testid="nav-property-registry"
          onClick={onOpenPropertyRegistry}
          title="Open 3D Property Registry Explorer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Database style={{ width: "13px", height: "13px" }} />
          <span>3D Registry</span>
        </button>

        <button
          type="button"
          data-testid="nav-vertical-strata"
          onClick={onOpenVerticalStrata}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Layers style={{ width: "13px", height: "13px" }} />
          <span>Vertical Strata</span>
        </button>

        <button
          type="button"
          data-testid="nav-gis-analysis"
          onClick={() => onOpenGisAnalysis && onOpenGisAnalysis("summary")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Layers style={{ width: "13px", height: "13px" }} />
          <span>GIS Analysis</span>
        </button>

        <button
          type="button"
          data-testid="nav-validation"
          onClick={() => onOpenGisAnalysis && onOpenGisAnalysis("validation")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <ShieldCheck style={{ width: "13px", height: "13px" }} />
          <span>Validation</span>
        </button>

        {/* INTELLIGENCE TOOLS */}
        <button
          type="button"
          data-testid="nav-ai-reconstruction"
          onClick={onOpenAiReconstruction}
          title="AI Multi-View Facade to 3D Building Reconstruction (SIH26011)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Sparkles style={{ width: "13px", height: "13px", color: "#F2C96B" }} />
          <span>AI Image → 3D</span>
        </button>

        <button
          type="button"
          data-testid="nav-drone-survey"
          onClick={onOpenDroneSurvey}
          title="Autonomous Drone Photogrammetry & LiDAR Survey Simulator"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 9px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Plane style={{ width: "13px", height: "13px", color: "#4CB8C4" }} />
          <span>Drone Survey</span>
        </button>
      </nav>

      {/* RIGHT: SEARCH, STATUS, ROLE & TOGGLE */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {/* GLOBAL SEARCH CONTAINER (REMOVED FROM HEADER BY DEFAULT - ONLY LOWER/MAIN SEARCH BAR REMAINS) */}
        {showSearch && (
          <div data-testid="global-search-container" style={{ width: "240px" }}>
            <LocationSearchBar
              onSelectLocation={onSelectLocation || (() => {})}
              onSearchUlpin={onSearchUlpin ? async (u) => { await onSearchUlpin(u); } : undefined}
              onSelectParcel={onSelectParcel}
              parcels={parcels}
              selectedParcel={selectedParcel}
              onOpenPropertyRegistry={onOpenPropertyRegistry}
            />
          </div>
        )}

        {/* ACTIVE ULPIN PILL */}
        {selectedParcel && (
          <div
            data-testid="live-ulpin-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(224, 169, 60, 0.12)",
              border: "1px solid rgba(224, 169, 60, 0.35)",
              fontSize: "11px",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              color: "#F2C96B",
            }}
          >
            <span style={{ fontSize: "9px", color: "#CBD5E1", fontWeight: 500 }}>ULPIN:</span>
            <span>{selectedParcel.ulpin_2d}</span>
          </div>
        )}

        {/* VIEW MODE TOGGLE */}
        {onToggleView && (
          <ViewModeToggle currentView={currentView} onToggleView={onToggleView} />
        )}

        {/* ROLE SELECTOR */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            data-testid="role-menu-button"
            onClick={() => setRoleMenuOpen(!roleMenuOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(220, 227, 242, 0.2)",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "#94A3B8", fontWeight: 400 }}>ROLE:</span>
            <span>{activeRole}</span>
            <ChevronDown style={{ width: "11px", height: "11px", opacity: 0.7 }} />
          </button>

          {roleMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "#162F6A",
                border: "1px solid rgba(220, 227, 242, 0.2)",
                borderRadius: "4px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.4)",
                padding: "4px",
                zIndex: 100,
                minWidth: "120px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    if (onChangeRole) onChangeRole(r);
                    setRoleMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 8px",
                    borderRadius: "3px",
                    fontSize: "11px",
                    fontWeight: activeRole === r ? 600 : 400,
                    color: activeRole === r ? "#E0A93C" : "#CBD5E1",
                    background: activeRole === r ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>{r}</span>
                  {activeRole === r && <CheckCircle2 style={{ width: "11px", height: "11px", color: "#2E9E52" }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ONLINE STATUS INDICATOR */}
        <div
          data-testid="system-online-indicator"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 7px",
            borderRadius: "4px",
            background: isConnected ? "rgba(46, 158, 82, 0.12)" : "rgba(192, 57, 43, 0.12)",
            border: `1px solid ${isConnected ? "rgba(46, 158, 82, 0.35)" : "rgba(192, 57, 43, 0.35)"}`,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: isConnected ? "#2E9E52" : "#C0392B",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: isConnected ? "#2E9E52" : "#C0392B",
            }}
          />
          <span>{isConnected ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>
    </header>
  );
};
