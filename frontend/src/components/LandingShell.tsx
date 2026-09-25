import React, { useState, useEffect } from "react";
import {
  Layers,
  Sparkles,
  Plane,
  ShieldCheck,
  Building2,
  Compass,
  Database,
  Earth,
  ChevronDown,
  CheckCircle2,
  Box,
} from "lucide-react";
import type { Parcel, Building, VerticalUnit, BuildingCandidate } from "../types/cadastre";
import { ViewModeToggle } from "./ViewModeToggle";
import { GovernmentHeader } from "./landing/GovernmentHeader";
import { HeroSection } from "./landing/HeroSection";
import { WorkflowSection } from "./landing/WorkflowSection";
import { DashboardPreviewSection } from "./landing/DashboardPreviewSection";
import { RegistryPreviewSection } from "./landing/RegistryPreviewSection";
import { VerticalStrataSection } from "./landing/VerticalStrataSection";
import { GISAnalysisSection } from "./landing/GISAnalysisSection";
import { ValidationSection } from "./landing/ValidationSection";
import { AISection } from "./landing/AISection";
import { DroneSurveySection } from "./landing/DroneSurveySection";
import { PrototypeSection } from "./landing/PrototypeSection";
import { GovernmentValueSection } from "./landing/GovernmentValueSection";
import { LandingFooter } from "./landing/LandingFooter";

export type UserRole = "ADMIN" | "SURVEYOR" | "ANALYST" | "VIEWER";

export interface LandingShellProps {
  currentView?: "landing" | "dashboard";
  onToggleView?: (view: "landing" | "dashboard") => void;
  onLaunch3D: () => void;
  onOpenGisAnalysis: (tab?: "summary" | "layers" | "nearby" | "validation") => void;
  onOpenPropertyRegistry?: () => void;
  onOpenVerticalStrata?: () => void;
  onOpenAiReconstruction?: () => void;
  onOpenDroneSurvey?: () => void;
  parcel: Parcel | null;
  building: Building | null;
  verticalUnits: VerticalUnit[];
  buildingCandidate?: BuildingCandidate | null;
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
}

export const LandingShell: React.FC<LandingShellProps> = ({
  currentView = "landing",
  onToggleView,
  onLaunch3D,
  onOpenGisAnalysis,
  onOpenPropertyRegistry,
  onOpenVerticalStrata,
  onOpenAiReconstruction,
  onOpenDroneSurvey,
  parcel,
  building,
  verticalUnits,
  activeRole,
  onChangeRole,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("section-hero");

  const roles: UserRole[] = ["ADMIN", "SURVEYOR", "ANALYST", "VIEWER"];

  // Active section tracking for navbar highlighting
  useEffect(() => {
    const sectionIds = [
      "section-hero",
      "section-workflow",
      "section-dashboard",
      "section-registry",
      "section-strata",
      "section-gis",
      "section-validation",
      "section-ai",
      "section-drone",
      "section-prototype",
      "section-gov-value",
    ];

    const container = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        root: container || null,
        rootMargin: "-60px 0px -40% 0px",
        threshold: 0.1,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: string, fallbackAction?: () => void) => {
    const container = containerRef.current;
    const el = document.getElementById(sectionId);
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScroll = container.scrollTop + (elRect.top - containerRect.top) - 50;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    } else if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (fallbackAction) {
      fallbackAction();
    }
  };

  const getNavButtonStyle = (isActive: boolean) => ({
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: "5px",
    padding: "5px 8px",
    borderRadius: "3px",
    fontSize: "11.5px",
    fontWeight: (isActive ? 700 : 500) as 700 | 500,
    cursor: "pointer" as const,
    background: isActive ? "rgba(224, 169, 60, 0.14)" : "transparent",
    color: isActive ? "#FFFFFF" : "#CBD5E1",
    border: isActive ? "1px solid rgba(224, 169, 60, 0.45)" : "1px solid transparent",
    transition: "all 0.15s ease",
  });

  return (
    <div
      ref={containerRef}
      data-testid="landing-shell"
      className="landing-shell landing-shell-root"
      style={{
        width: "100%",
        height: "100vh",
        maxHeight: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        backgroundColor: "#F7F8FB",
        color: "#16255C",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        scrollBehavior: "smooth",
      }}
    >
      {/* ========================================================= */}
      {/* 1. TOP WHITE OFFICIAL GOVERNMENT HEADER                   */}
      {/* ========================================================= */}
      <GovernmentHeader />

      {/* ========================================================= */}
      {/* 2. MAIN STICKY NAVIGATION BAR (#16255C DARK NAVY)         */}
      {/* ========================================================= */}
      <header
        className="command-navbar"
        style={{
          height: "48px",
          borderBottom: "1px solid rgba(217, 222, 229, 0.15)",
          backgroundColor: "#16255C",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          gap: "10px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        {/* BRANDING */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "3px",
              background: "rgba(224, 169, 60, 0.15)",
              border: "1px solid rgba(224, 169, 60, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#E0A93C",
            }}
          >
            <Box style={{ width: "14px", height: "14px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            <span
              style={{
                fontFamily: "var(--font-sans, Inter)",
                fontWeight: 700,
                fontSize: "13.5px",
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
                fontSize: "9px",
                fontWeight: 500,
                color: "#94A3B8",
                letterSpacing: "0.02em",
                lineHeight: 1.1,
              }}
            >
              Vertical Property Mapping
            </span>
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 5px",
              borderRadius: "2px",
              background: "rgba(224, 169, 60, 0.15)",
              border: "1px solid rgba(224, 169, 60, 0.4)",
              fontSize: "8.5px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#E0A93C",
              whiteSpace: "nowrap",
            }}
          >
            RESEARCH PROTOTYPE
          </span>

          <span
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              color: "#64748B",
              borderLeft: "1px solid rgba(217, 222, 229, 0.15)",
              paddingLeft: "7px",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            SIH26011
          </span>
        </div>

        {/* CENTER MODULE NAVIGATION (DUAL: SCROLL ANCHOR ON LANDING / DIRECT ACTION) */}
        <nav style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          {/* LANDING BUTTON */}
          <button
            type="button"
            data-testid="nav-landing"
            onClick={() => scrollToSection("section-hero", () => onToggleView && onToggleView("landing"))}
            style={getNavButtonStyle(activeSection === "section-hero")}
          >
            <Building2 style={{ width: "12px", height: "12px", color: activeSection === "section-hero" ? "#E0A93C" : "inherit" }} />
            <span>Landing</span>
          </button>

          {/* 3D DASHBOARD */}
          <button
            type="button"
            data-testid="nav-3d-dashboard"
            onClick={() => scrollToSection("section-dashboard", onLaunch3D)}
            style={getNavButtonStyle(activeSection === "section-dashboard")}
          >
            <Earth style={{ width: "12px", height: "12px" }} />
            <span>3D Dashboard</span>
          </button>

          {/* 3D REGISTRY */}
          <button
            type="button"
            data-testid="nav-property-registry"
            onClick={() => scrollToSection("section-registry", onOpenPropertyRegistry)}
            style={getNavButtonStyle(activeSection === "section-registry")}
          >
            <Database style={{ width: "12px", height: "12px" }} />
            <span>3D Registry</span>
          </button>

          {/* VERTICAL STRATA */}
          <button
            type="button"
            data-testid="nav-vertical-strata"
            onClick={() => scrollToSection("section-strata", onOpenVerticalStrata || onLaunch3D)}
            style={getNavButtonStyle(activeSection === "section-strata")}
          >
            <Layers style={{ width: "12px", height: "12px" }} />
            <span>Vertical Strata</span>
          </button>

          {/* GIS ANALYSIS */}
          <button
            type="button"
            data-testid="nav-gis-analysis"
            onClick={() => scrollToSection("section-gis", () => onOpenGisAnalysis("summary"))}
            style={getNavButtonStyle(activeSection === "section-gis")}
          >
            <Compass style={{ width: "12px", height: "12px" }} />
            <span>GIS Analysis</span>
          </button>

          {/* VALIDATION */}
          <button
            type="button"
            data-testid="nav-validation"
            onClick={() => scrollToSection("section-validation", () => onOpenGisAnalysis("validation"))}
            style={getNavButtonStyle(activeSection === "section-validation")}
          >
            <ShieldCheck style={{ width: "12px", height: "12px" }} />
            <span>Validation</span>
          </button>

          {/* AI IMAGE -> 3D */}
          {onOpenAiReconstruction && (
            <button
              type="button"
              data-testid="nav-ai-reconstruction"
              onClick={() => scrollToSection("section-ai", onOpenAiReconstruction)}
              style={getNavButtonStyle(activeSection === "section-ai")}
            >
              <Sparkles style={{ width: "12px", height: "12px", color: "#F2C96B" }} />
              <span>AI Image → 3D</span>
            </button>
          )}

          {/* DRONE SURVEY */}
          {onOpenDroneSurvey && (
            <button
              type="button"
              data-testid="nav-drone-survey"
              onClick={() => scrollToSection("section-drone", onOpenDroneSurvey)}
              style={getNavButtonStyle(activeSection === "section-drone")}
            >
              <Plane style={{ width: "12px", height: "12px", color: "#4CB8C4" }} />
              <span>Drone Survey</span>
            </button>
          )}
        </nav>

        {/* RIGHT CONTROLS */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {onToggleView && (
            <ViewModeToggle currentView={currentView} onToggleView={onToggleView} />
          )}

          {/* Role selector */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              data-testid="role-menu-button"
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 7px",
                borderRadius: "3px",
                fontSize: "10.5px",
                fontWeight: 600,
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(217, 222, 229, 0.2)",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "#94A3B8", fontWeight: 400 }}>ROLE:</span>
              <span>{activeRole}</span>
              <ChevronDown style={{ width: "10px", height: "10px", opacity: 0.7 }} />
            </button>

            {roleMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 4px)",
                  background: "#16255C",
                  border: "1px solid rgba(217, 222, 229, 0.2)",
                  borderRadius: "3px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
                  padding: "3px",
                  zIndex: 100,
                  minWidth: "110px",
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
                      onChangeRole(r);
                      setRoleMenuOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 7px",
                      borderRadius: "2px",
                      fontSize: "10.5px",
                      fontWeight: activeRole === r ? 600 : 400,
                      color: activeRole === r ? "#E0A93C" : "#CBD5E1",
                      background: activeRole === r ? "rgba(255, 255, 255, 0.1)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{r}</span>
                    {activeRole === r && <CheckCircle2 style={{ width: "10px", height: "10px", color: "#2E9E52" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "3px",
              background: "rgba(46, 158, 82, 0.12)",
              border: "1px solid rgba(46, 158, 82, 0.35)",
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#2E9E52",
            }}
          >
            <span
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                backgroundColor: "#2E9E52",
              }}
            />
            <span>ONLINE</span>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 3. HERO SECTION                                           */}
      {/* ========================================================= */}
      <HeroSection
        onLaunch3D={onLaunch3D}
        onOpenGisAnalysis={onOpenGisAnalysis}
        parcel={parcel}
        building={building}
        verticalUnits={verticalUnits}
      />

      {/* ========================================================= */}
      {/* 4. HOW BHUSETU WORKS (6-STEP CONTINUOUS ENGINEERING CHAIN)*/}
      {/* ========================================================= */}
      <WorkflowSection />

      {/* ========================================================= */}
      {/* 5. 3D DASHBOARD SECTION (CESIUM PREVIEW + CTA)            */}
      {/* ========================================================= */}
      <DashboardPreviewSection
        onLaunch3D={onLaunch3D}
        parcel={parcel}
        building={building}
        verticalUnits={verticalUnits}
      />

      {/* ========================================================= */}
      {/* 6. 3D PROPERTY REGISTRY SECTION                           */}
      {/* ========================================================= */}
      <RegistryPreviewSection
        onOpenPropertyRegistry={onOpenPropertyRegistry}
        parcel={parcel}
        building={building}
        verticalUnits={verticalUnits}
      />

      {/* ========================================================= */}
      {/* 7. VERTICAL PROPERTY STRATA SECTION                       */}
      {/* ========================================================= */}
      <VerticalStrataSection
        onOpenVerticalStrata={onOpenVerticalStrata}
        onLaunch3D={onLaunch3D}
      />

      {/* ========================================================= */}
      {/* 8. GIS & SPATIAL ANALYSIS SECTION                         */}
      {/* ========================================================= */}
      <GISAnalysisSection
        onOpenGisAnalysis={onOpenGisAnalysis}
      />

      {/* ========================================================= */}
      {/* 9. SPATIAL & TOPOLOGY VALIDATION SECTION                  */}
      {/* ========================================================= */}
      <ValidationSection
        onOpenValidation={() => onOpenGisAnalysis("validation")}
      />

      {/* ========================================================= */}
      {/* 10. AI-ASSISTED BUILDING RECONSTRUCTION SECTION           */}
      {/* ========================================================= */}
      <AISection
        onOpenAiReconstruction={onOpenAiReconstruction}
      />

      {/* ========================================================= */}
      {/* 11. DRONE SURVEY INTEGRATION SECTION                      */}
      {/* ========================================================= */}
      <DroneSurveySection
        onOpenDroneSurvey={onOpenDroneSurvey}
      />

      {/* ========================================================= */}
      {/* 12. CURRENT PROTOTYPE SECTION (CREDIBILITY & METRICS)     */}
      {/* ========================================================= */}
      <PrototypeSection />

      {/* ========================================================= */}
      {/* 13. GOVERNMENT VALUE SECTION (CAUSAL CHAIN)               */}
      {/* ========================================================= */}
      <GovernmentValueSection />

      {/* ========================================================= */}
      {/* 14. INSTITUTIONAL FOOTER                                  */}
      {/* ========================================================= */}
      <LandingFooter />
    </div>
  );
};
