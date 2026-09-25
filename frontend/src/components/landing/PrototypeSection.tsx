import React from "react";
import { MapPin } from "lucide-react";

export const PrototypeSection: React.FC = () => {
  const metrics = [
    { label: "DETAILED BUILDINGS", val: "7 Detailed Buildings" },
    { label: "VERTICAL FLOORS", val: "68 Vertical Floors" },
    { label: "PROPERTY EXTENTS", val: "3D Property Volumes" },
    { label: "CADASTRAL INTEGRITY", val: "Dynamic Spatial Validation" },
  ];

  return (
    <section
      id="section-prototype"
      style={{
        padding: "40px 24px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
            REAL REFERENCE IMPLEMENTATION
          </span>
          <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
            CURRENT PROTOTYPE
          </h2>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "4px", fontSize: "12.5px", fontWeight: 600, color: "#16255C" }}>
            <MapPin style={{ width: "13px", height: "13px", color: "#1F7AE0" }} />
            <span>Hyderabad — HITEC City / Madhapur (Telangana, India)</span>
          </div>
        </div>

        {/* Compact Factual Metrics from Real App */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
          {metrics.map((m, i) => (
            <div
              key={i}
              style={{
                background: "#F7F8FB",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "14px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "9px", fontWeight: 800, color: "#6B7086", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "3px" }}>
                {m.label}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#16255C" }}>
                {m.val}
              </div>
            </div>
          ))}
        </div>

        {/* Data Context & Credibility Note */}
        <div
          style={{
            background: "#EEF2F7",
            border: "1px solid #DCE3F2",
            borderRadius: "3px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "10.5px",
            color: "#46516B",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, color: "#16255C" }}>DATA CONTEXT:</span>
            <span>OSM Reference Footprints</span>
            <span>·</span>
            <span>Copernicus DEM 30m</span>
            <span>·</span>
            <span>QGIS Spatial Topology</span>
          </div>

          <div style={{ fontStyle: "italic", color: "#6B7086", maxWidth: "600px" }}>
            Research prototype using available geospatial reference data; authoritative cadastral/survey inputs are required for production deployment.
          </div>
        </div>
      </div>
    </section>
  );
};
