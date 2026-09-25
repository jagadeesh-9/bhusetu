import React from "react";

interface VerticalStrataSectionProps {
  onOpenVerticalStrata?: () => void;
  onLaunch3D: () => void;
}

export const VerticalStrataSection: React.FC<VerticalStrataSectionProps> = ({
  onOpenVerticalStrata,
  onLaunch3D,
}) => {
  const handleClick = onOpenVerticalStrata || onLaunch3D;

  const strataLevels = [
    { level: "Rooftop / Air Rights", z: "+561.0m → +563.5m", type: "Common Area & Solar Infrastructure", color: "#E0A93C" },
    { level: "Floor 5", z: "+556.8m → +561.0m", type: "Residential Strata Units (Penthouse)", color: "#1F7AE0" },
    { level: "Floor 4", z: "+552.6m → +556.8m", type: "Residential Strata Units (Surya-401, 402)", color: "#1F7AE0" },
    { level: "Floor 3", z: "+548.4m → +552.6m", type: "Residential Strata Units (Surya-301, 302)", color: "#1F7AE0" },
    { level: "Floor 2", z: "+544.2m → +548.4m", type: "Residential Strata Units (Surya-201, 202)", color: "#1F7AE0" },
    { level: "Floor 1", z: "+540.0m → +544.2m", type: "Residential Strata Units (Surya-101, 102)", color: "#1F7AE0" },
    { level: "Ground Floor (G)", z: "+540.0m (Datum)", type: "Entrance Lobby & Commercial Units", color: "#2E9E52" },
    { level: "Sub-Basement (-1)", z: "+536.5m → +540.0m", type: "Automated Parking & Utilities Infrastructure", color: "#6B7086" },
  ];

  return (
    <section
      id="section-strata"
      style={{
        padding: "40px 24px",
        backgroundColor: "#F7F8FB",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
              VOLUMETRIC DECOMPOSITION
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              VERTICAL PROPERTY STRATA
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Decomposes a building into discrete vertical property spaces.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClick}
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
            <span>EXPLORE VERTICAL STRATA →</span>
          </button>
        </div>

        {/* Technical Building Section Diagram */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE3F2",
            borderRadius: "4px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(11, 21, 38, 0.03)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {strataLevels.map((lvl, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "170px 150px 1fr",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: "2px",
                  background: lvl.level.includes("Ground") ? "rgba(46, 158, 82, 0.06)" : lvl.level.includes("Basement") ? "#EEF2F7" : "#F7F8FB",
                  borderLeft: `3px solid ${lvl.color}`,
                  borderTop: "1px solid #EEF2F7",
                  borderRight: "1px solid #EEF2F7",
                  borderBottom: "1px solid #EEF2F7",
                  fontSize: "11.5px",
                }}
              >
                <div style={{ fontWeight: 700, color: "#16255C" }}>
                  {lvl.level}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "10.5px", color: "#46516B" }}>
                  {lvl.z}
                </div>
                <div style={{ color: "#6B7086", fontSize: "11px" }}>
                  {lvl.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
