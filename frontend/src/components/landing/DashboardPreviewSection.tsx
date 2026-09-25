import React from "react";
import { Earth } from "lucide-react";
import type { Parcel, Building, VerticalUnit } from "../../types/cadastre";

interface DashboardPreviewSectionProps {
  onLaunch3D: () => void;
  parcel: Parcel | null;
  building: Building | null;
  verticalUnits: VerticalUnit[];
}

export const DashboardPreviewSection: React.FC<DashboardPreviewSectionProps> = ({
  onLaunch3D,
  parcel,
  building,
  verticalUnits: _verticalUnits,
}) => {
  return (
    <section
      id="section-dashboard"
      style={{
        padding: "40px 24px",
        backgroundColor: "#F7F8FB",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
              INTERACTIVE 3D CADASTRE
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              3D DASHBOARD
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Inspect parcels, buildings, floors and property units in an interactive 3D cadastral environment.
            </p>
          </div>

          <button
            type="button"
            onClick={onLaunch3D}
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
              boxShadow: "0 1px 3px rgba(11, 21, 38, 0.1)",
            }}
          >
            <span>OPEN 3D DASHBOARD →</span>
          </button>
        </div>

        {/* Technical Cadastral Viewport Preview Box */}
        <div
          style={{
            background: "#10203A",
            border: "1px solid #DCE3F2",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(11, 21, 38, 0.06)",
          }}
        >
          {/* Viewport Top Bar */}
          <div
            style={{
              height: "34px",
              background: "#0B1526",
              borderBottom: "1px solid rgba(220, 227, 242, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
              fontSize: "10.5px",
              color: "#DCE3F2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Earth style={{ width: "13px", height: "13px", color: "#1F7AE0" }} />
              <span style={{ fontWeight: 700, letterSpacing: "0.03em" }}>CESIUM 3D CADASTRAL VIEWPORT (HYDERABAD MESH)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "10px", color: "#94A3B8" }}>
              <span>LAT: 17.4485°N</span>
              <span>LON: 78.3762°E</span>
              <span style={{ color: "#E0A93C", fontWeight: 600 }}>EPSG:32644 (UTM 44N)</span>
            </div>
          </div>

          {/* Viewport Interior Canvas Mockup with Real Geometry Lines */}
          <div
            style={{
              height: "240px",
              position: "relative",
              background: "linear-gradient(180deg, #10203A 0%, #0B1526 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* Perspective Cadastral Grid SVG */}
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 800 240"
              preserveAspectRatio="none"
              style={{ position: "absolute", top: 0, left: 0, opacity: 0.22 }}
            >
              <line x1="100" y1="240" x2="350" y2="30" stroke="#1F7AE0" strokeWidth="1" />
              <line x1="250" y1="240" x2="380" y2="30" stroke="#1F7AE0" strokeWidth="1" />
              <line x1="400" y1="240" x2="400" y2="30" stroke="#1F7AE0" strokeWidth="1" />
              <line x1="550" y1="240" x2="420" y2="30" stroke="#1F7AE0" strokeWidth="1" />
              <line x1="700" y1="240" x2="450" y2="30" stroke="#1F7AE0" strokeWidth="1" />
              <line x1="0" y1="190" x2="800" y2="190" stroke="#1F7AE0" strokeWidth="0.8" />
              <line x1="0" y1="140" x2="800" y2="140" stroke="#1F7AE0" strokeWidth="0.6" />
              <line x1="0" y1="90" x2="800" y2="90" stroke="#1F7AE0" strokeWidth="0.5" />
            </svg>

            {/* Central 3D Cadastral Polyhedral Wireframe */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  border: "1.5px solid #1F7AE0",
                  background: "rgba(31, 122, 224, 0.12)",
                  padding: "14px 24px",
                  borderRadius: "4px",
                  boxShadow: "0 0 16px rgba(31, 122, 224, 0.15)",
                  marginBottom: "10px",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#E0A93C", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  ACTIVE VOLUMETRIC EXTENT
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginTop: "2px" }}>
                  {parcel ? (building?.building_name || "Surya Heights Residential Apartment") : "Selected Volumetric Extent"}
                </div>
                <div style={{ fontSize: "10.5px", fontFamily: "monospace", color: "#DCE3F2", marginTop: "3px" }}>
                  ULPIN: {parcel ? parcel.ulpin_2d : "36A1B2C3D4E5F9"} · H: 21.0m · 5 Storeys + Basement
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ fontSize: "9px", background: "rgba(46, 158, 82, 0.2)", color: "#2E9E52", padding: "2px 7px", borderRadius: "2px", border: "1px solid rgba(46, 158, 82, 0.4)", fontWeight: 700 }}>
                  2-MANIFOLD POLYHEDRAL SOLID
                </span>
                <span style={{ fontSize: "9px", background: "rgba(31, 122, 224, 0.2)", color: "#1F7AE0", padding: "2px 7px", borderRadius: "2px", border: "1px solid rgba(31, 122, 224, 0.4)", fontWeight: 700 }}>
                  ZERO SPATIAL COLLISION
                </span>
              </div>
            </div>

            {/* Bottom Left HUD Overlay */}
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                left: "10px",
                background: "rgba(11, 21, 38, 0.85)",
                border: "1px solid rgba(220, 227, 242, 0.15)",
                borderRadius: "2px",
                padding: "4px 8px",
                fontSize: "9.5px",
                color: "#CBD5E1",
                fontFamily: "monospace",
              }}
            >
              <div>BASE DEM: +540.0m (Copernicus 30m)</div>
              <div>ROOF Z: +561.0m MSL</div>
            </div>

            {/* Bottom Right Layer Legend */}
            <div
              style={{
                position: "absolute",
                bottom: "8px",
                right: "10px",
                display: "flex",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9.5px", color: "#CBD5E1" }}>
                <span style={{ width: "7px", height: "7px", background: "#E0A93C", borderRadius: "2px" }} />
                <span>Parcel Boundary</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9.5px", color: "#CBD5E1" }}>
                <span style={{ width: "7px", height: "7px", background: "#1F7AE0", borderRadius: "2px" }} />
                <span>Strata Units</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
