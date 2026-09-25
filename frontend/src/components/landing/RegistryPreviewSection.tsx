import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { Parcel, Building, VerticalUnit } from "../../types/cadastre";

interface RegistryPreviewSectionProps {
  onOpenPropertyRegistry?: () => void;
  parcel: Parcel | null;
  building: Building | null;
  verticalUnits: VerticalUnit[];
}

export const RegistryPreviewSection: React.FC<RegistryPreviewSectionProps> = ({
  onOpenPropertyRegistry,
  parcel,
  building,
  verticalUnits: _verticalUnits,
}) => {
  const sampleRows = [
    {
      parcel: parcel?.ulpin_2d || "36A1B2C3D4E5F9",
      bldg: parcel ? (building?.building_name || "Surya Heights") : "Unassigned",
      floor: "Floor 1",
      unit: "Surya-101",
      id3d: `${parcel?.ulpin_2d || "36A1B2C3D4E5F9"}-F01-U01`,
      zspan: "+540.0m → +544.2m",
      status: "VERIFIED",
    },
    {
      parcel: parcel?.ulpin_2d || "36A1B2C3D4E5F9",
      bldg: parcel ? (building?.building_name || "Surya Heights") : "Unassigned",
      floor: "Floor 2",
      unit: "Surya-201",
      id3d: `${parcel?.ulpin_2d || "36A1B2C3D4E5F9"}-F02-U01`,
      zspan: "+544.2m → +548.4m",
      status: "VERIFIED",
    },
    {
      parcel: parcel?.ulpin_2d || "36A1B2C3D4E5F9",
      bldg: parcel ? (building?.building_name || "Surya Heights") : "Unassigned",
      floor: "Ground Floor",
      unit: "Surya-G01",
      id3d: `${parcel?.ulpin_2d || "36A1B2C3D4E5F9"}-F00-U01`,
      zspan: "+540.0m → +544.2m",
      status: "VERIFIED",
    },
    {
      parcel: parcel?.ulpin_2d || "36A1B2C3D4E5F9",
      bldg: parcel ? (building?.building_name || "Surya Heights") : "Unassigned",
      floor: "Sub-Basement",
      unit: "Surya-B01",
      id3d: `${parcel?.ulpin_2d || "36A1B2C3D4E5F9"}-B01-P01`,
      zspan: "+536.5m → +540.0m",
      status: "VERIFIED",
    },
  ];

  return (
    <section
      id="section-registry"
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
              VOLUMETRIC CADASTRE DIRECTORY
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              3D PROPERTY REGISTRY
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Authoritative spatial directory linking 2D land parcel rights with 3D vertical units and height extents.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPropertyRegistry}
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
            <span>OPEN REGISTRY →</span>
          </button>
        </div>

        {/* Registry Table Preview */}
        <div
          style={{
            border: "1px solid #DCE3F2",
            borderRadius: "4px",
            overflow: "hidden",
            background: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(11, 21, 38, 0.03)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#F7F8FB", borderBottom: "1px solid #DCE3F2", color: "#46516B" }}>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>PARCEL (2D ULPIN)</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>BUILDING</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>FLOOR</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>UNIT</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>3D PROPERTY ID</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>ZMIN / ZMAX</th>
                <th style={{ padding: "9px 12px", fontWeight: 700, textTransform: "uppercase", fontSize: "9.5px" }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < sampleRows.length - 1 ? "1px solid #EEF2F7" : "none" }}>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 600, color: "#16255C" }}>{row.parcel}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "#16255C" }}>{row.bldg}</td>
                  <td style={{ padding: "9px 12px", color: "#46516B" }}>{row.floor}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "#16255C" }}>{row.unit}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#1F7AE0", fontWeight: 700 }}>{row.id3d}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#46516B" }}>{row.zspan}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        padding: "2px 7px",
                        borderRadius: "2px",
                        background: "rgba(46, 158, 82, 0.1)",
                        border: "1px solid rgba(46, 158, 82, 0.3)",
                        color: "#2E9E52",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 style={{ width: "9px", height: "9px" }} />
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
