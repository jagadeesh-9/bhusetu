import React from "react";

export const LandingFooter: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: "1px solid #DCE3F2",
        backgroundColor: "#FFFFFF",
        padding: "20px 32px 18px 32px",
        fontSize: "10.5px",
        color: "#6B7086",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#16255C", marginBottom: "2px" }}>
              <span style={{ color: "#16255C" }}>Bhu</span>
              <span style={{ color: "#1F7AE0" }}>Setu</span>
              <span style={{ color: "#46516B", fontWeight: 500, fontSize: "11px", marginLeft: "6px" }}>
                3D ULPIN &amp; Vertical Property Mapping System
              </span>
            </div>
            <div style={{ fontSize: "10px", color: "#6B7086" }}>
              Smart India Hackathon 2024 (SIH26011) · Team SHRAMIKS
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "10.5px" }}>
            <span style={{ color: "#16255C", fontWeight: 600, cursor: "pointer" }}>GitHub</span>
            <span>·</span>
            <span style={{ color: "#16255C", fontWeight: 600, cursor: "pointer" }}>Prototype</span>
            <span>·</span>
            <span style={{ color: "#16255C", fontWeight: 600, cursor: "pointer" }}>Technical References</span>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #EEF2F7",
            paddingTop: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "10px",
          }}
        >
          <span>Research Prototype · Geospatial Analytics · SIH26011</span>
          <span>Non-authoritative 3D Cadastral Operating System</span>
        </div>
      </div>
    </footer>
  );
};
