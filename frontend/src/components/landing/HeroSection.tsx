import React from "react";
import { ArrowRight, Maximize2, Building2 } from "lucide-react";
import type { Parcel, Building, VerticalUnit } from "../../types/cadastre";
import { CadastralWatermark } from "./CadastralWatermark";

interface HeroSectionProps {
  onLaunch3D: () => void;
  onOpenGisAnalysis: (tab?: "summary" | "layers" | "nearby" | "validation") => void;
  parcel: Parcel | null;
  building: Building | null;
  verticalUnits: VerticalUnit[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onLaunch3D,
  onOpenGisAnalysis,
  parcel,
  building,
  verticalUnits,
}) => {
  return (
    <section
      id="section-hero"
      style={{
        position: "relative",
        padding: "40px 24px 32px 24px",
        backgroundColor: "#F7F8FB",
        borderBottom: "1px solid #DCE3F2",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <CadastralWatermark variant="hero" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1080px", width: "100%", margin: "0 auto" }}>
        {/* Eyebrow */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 12px",
            borderRadius: "3px",
            background: "#EEF2F7",
            border: "1px solid #DCE3F2",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "#16255C",
            textTransform: "uppercase",
            marginBottom: "14px",
          }}
        >
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#1F7AE0" }} />
          <span>NEXT-GENERATION VOLUMETRIC CADASTRAL INFRASTRUCTURE</span>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
            fontSize: "32px",
            fontWeight: 800,
            color: "#16255C",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            margin: "0 0 12px 0",
          }}
        >
          From 2D Land Parcels to 3D Vertical Property Strata
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontSize: "13.5px",
            color: "#46516B",
            maxWidth: "680px",
            margin: "0 auto 20px auto",
            lineHeight: 1.6,
          }}
        >
          Transforming conventional parcel records into structured, validated vertical property information.
          SIH26011 Research Prototype enabling multi-level urban tenure, topological non-overlap proofs, and volumetric cadastral identity.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "26px" }}>
          <button
            type="button"
            data-testid="launch-3d-dashboard-button"
            onClick={onLaunch3D}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 20px",
              borderRadius: "4px",
              background: "#16255C",
              color: "#FFFFFF",
              border: "1px solid #16255C",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(22, 37, 92, 0.15)",
              transition: "all 0.15s ease",
            }}
          >
            <span>LAUNCH 3D DASHBOARD →</span>
            <span style={{ fontSize: "10.5px", opacity: 0.85 }}>(Launch 3D Dashboard)</span>
          </button>

          <button
            type="button"
            data-testid="explore-gis-analysis-button"
            onClick={() => onOpenGisAnalysis("summary")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              borderRadius: "4px",
              background: "#FFFFFF",
              color: "#16255C",
              border: "1px solid #DCE3F2",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(11, 21, 38, 0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <span>EXPLORE GIS ANALYSIS</span>
            <span style={{ fontSize: "10.5px", color: "#6B7086" }}>(Explore GIS Analysis)</span>
            <ArrowRight style={{ width: "12px", height: "12px" }} />
          </button>
        </div>

        {/* Active Cadastral Context Card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE3F2",
            borderRadius: "4px",
            padding: "14px 18px",
            boxShadow: "0 1px 2px rgba(11, 21, 38, 0.03)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "3px",
                  background: "#EEF2F7",
                  border: "1px solid #DCE3F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#16255C",
                }}
              >
                <Building2 style={{ width: "14px", height: "14px" }} />
              </div>
              <div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#6B7086", letterSpacing: "0.06em", textTransform: "uppercase", display: "block" }}>
                  {parcel ? "ACTIVE CADASTRAL PROPERTY CONTEXT" : "No Active Property Selected"}
                </span>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#16255C" }}>
                  {parcel ? (building?.building_name || "Surya Heights Residential Apartment — OSM Reference Anchor") : "No Property Selected"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLaunch3D}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "3px",
                background: "#16255C",
                color: "#FFFFFF",
                border: "none",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>Inspect in Cesium 3D</span>
              <Maximize2 style={{ width: "11px", height: "11px" }} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
              borderTop: "1px solid #EEF2F7",
              paddingTop: "8px",
            }}
          >
            <div>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                PROTOTYPE ULPIN
              </span>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "11px", fontWeight: 700, color: "#16255C" }}>
                {parcel ? parcel.ulpin_2d : "Unassigned"}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                SURVEY NUMBER
              </span>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#16255C" }}>
                {parcel ? parcel.survey_number : "SY-142/OSM (Synthetic Demo Parcel)"}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                ELEVATION SPAN
              </span>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "11px", fontWeight: 600, color: "#16255C" }}>
                +540.0m → +561.0m
              </div>
            </div>

            <div>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#6B7086", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                VERTICAL UNITS
              </span>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#2E9E52" }}>
                {parcel ? `${verticalUnits.length || 3} Strata Units` : "0 Strata Units"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
