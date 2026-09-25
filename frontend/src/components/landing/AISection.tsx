import React from "react";

interface AISectionProps {
  onOpenAiReconstruction?: () => void;
}

export const AISection: React.FC<AISectionProps> = ({
  onOpenAiReconstruction,
}) => {
  const steps = [
    { name: "IMAGE EVIDENCE", desc: "Multi-view facade imagery, nadir aerial, ground-level photos" },
    { name: "AI ANALYSIS", desc: "Edge detection, floor-band segmentation, height estimation" },
    { name: "BUILDING GEOMETRY", desc: "3D wireframe envelope, polyhedral mesh boundary" },
    { name: "3D RECONSTRUCTION", desc: "LoD2 volumetric model, provisional vertical strata" },
  ];

  const capabilities = [
    { title: "Height Estimation", tag: "ESTIMATED", detail: "Inferred vertical height: 21.0m ±0.4m from facade fenestration rhythm" },
    { title: "Building Typology Classification", tag: "AI-ASSISTED", detail: "Classified as Multi-storey Reinforced Concrete Residential Apartment" },
    { title: "Anomaly Detection", tag: "AI-ASSISTED", detail: "Zero structural overhang intrusion; floor boundaries aligned with ground DEM" },
    { title: "Data Enrichment", tag: "ESTIMATED", detail: "Provisional unit count & floor level attributes linked to 2D ULPIN registry" },
  ];

  return (
    <section
      id="section-ai"
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
              COMPUTER VISION ASSIST
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              AI-ASSISTED BUILDING RECONSTRUCTION
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Automated extraction of 3D building envelopes and vertical floor levels from multi-view facade evidence.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAiReconstruction}
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
            <span>OPEN AI WORKFLOW →</span>
          </button>
        </div>

        {/* Process Flow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" }}>
          {steps.map((st, i) => (
            <div
              key={i}
              style={{
                background: "#F7F8FB",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#16255C" }}>{st.name}</span>
                {i < steps.length - 1 && <span style={{ fontSize: "10px", color: "#1F7AE0", fontWeight: 700 }}>↓</span>}
              </div>
              <p style={{ fontSize: "9.5px", color: "#6B7086", margin: 0, lineHeight: 1.35 }}>{st.desc}</p>
            </div>
          ))}
        </div>

        {/* Capabilities with Mandatory AI-ASSISTED / ESTIMATED Labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {capabilities.map((c, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "10px",
                background: "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#16255C" }}>{c.title}</span>
                <span
                  style={{
                    fontSize: "8px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "2px 4px",
                    borderRadius: "2px",
                    background: "rgba(31, 122, 224, 0.1)",
                    color: "#1F7AE0",
                    border: "1px solid rgba(31, 122, 224, 0.3)",
                  }}
                >
                  {c.tag}
                </span>
              </div>
              <p style={{ fontSize: "10px", color: "#46516B", margin: 0, lineHeight: 1.4 }}>{c.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
