import React from "react";

interface GISAnalysisSectionProps {
  onOpenGisAnalysis: (tab?: "summary" | "layers" | "nearby" | "validation") => void;
}

export const GISAnalysisSection: React.FC<GISAnalysisSectionProps> = ({
  onOpenGisAnalysis,
}) => {
  const steps = [
    {
      step: "PARCEL",
      detail: "2D Cadastral Polygon (1,420.5 m²)",
      sub: "EPSG:32644 Projected Coordinates",
    },
    {
      step: "BUILDING",
      detail: "Footprint Extrusion (428.0 m²)",
      sub: "30.13% Plot Coverage Ratio",
    },
    {
      step: "ELEVATION",
      detail: "Copernicus DEM 30m (+540.0m Base)",
      sub: "Absolute Ellipsoidal Height Model",
    },
    {
      step: "SPATIAL RELATIONSHIP",
      detail: "Setback (4.5m) & Boundary Containment",
      sub: "100% Parcel Polygon Invariant",
    },
  ];

  return (
    <section
      id="section-gis"
      style={{
        padding: "40px 24px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
              GEOSPATIAL INTELLIGENCE
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              GIS &amp; SPATIAL ANALYSIS
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Deep geospatial analysis integrating parcel geometries, terrain elevations, and spatial relationships.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenGisAnalysis("summary")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "4px",
              background: "#16255C",
              color: "#FFFFFF",
              border: "none",
              fontSize: "11.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>OPEN GIS ANALYSIS →</span>
          </button>
        </div>

        {/* Visual Sequence: PARCEL -> BUILDING -> ELEVATION -> SPATIAL RELATIONSHIP */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          {steps.map((s, idx) => (
            <div
              key={idx}
              style={{
                background: "#F7F8FB",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "14px",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#16255C", letterSpacing: "0.03em" }}>
                  {s.step}
                </span>
                {idx < steps.length - 1 && (
                  <span style={{ fontSize: "11px", color: "#1F7AE0", fontWeight: 700 }}>→</span>
                )}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#16255C", marginBottom: "3px" }}>
                {s.detail}
              </div>
              <div style={{ fontSize: "10.5px", color: "#6B7086" }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
