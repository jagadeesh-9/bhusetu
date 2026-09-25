import React from "react";
import { CheckCircle2 } from "lucide-react";

interface ValidationSectionProps {
  onOpenValidation: () => void;
}

export const ValidationSection: React.FC<ValidationSectionProps> = ({
  onOpenValidation,
}) => {
  const checks = [
    {
      name: "Containment",
      status: "PASSED",
      desc: "Building footprint polygon lies 100% inside parcel cadastre boundary (ST_Contains).",
    },
    {
      name: "Overlap",
      status: "PASSED",
      desc: "Zero volumetric intersection between adjacent 3D vertical units (ST_3DIntersects = false).",
    },
    {
      name: "Floor Ordering",
      status: "PASSED",
      desc: "Strict monotonic sequence Zmin[k+1] == Zmax[k] with zero unassigned vertical gaps.",
    },
    {
      name: "Height Consistency",
      status: "PASSED",
      desc: "Aggregate floor elevations match measured building height envelope (+21.0m above ground).",
    },
    {
      name: "Geometry Integrity",
      status: "PASSED",
      desc: "All strata units form closed 2-manifold polyhedral solids (SFCGAL is_valid = true).",
    },
  ];

  return (
    <section
      id="section-validation"
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
              TOPOLOGICAL ASSURANCE
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              SPATIAL &amp; TOPOLOGY VALIDATION
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              Rigorous SFCGAL and PostGIS topological validation ensuring zero volumetric overlap and strict cadastral containment.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenValidation}
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
            <span>RUN VALIDATION →</span>
          </button>
        </div>

        {/* Validation Checks Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
          {checks.map((c, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "12px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                boxShadow: "0 1px 2px rgba(11, 21, 38, 0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#16255C", textTransform: "uppercase" }}>
                  {c.name}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    fontSize: "8.5px",
                    fontWeight: 700,
                    color: "#2E9E52",
                    background: "rgba(46, 158, 82, 0.1)",
                    padding: "2px 5px",
                    borderRadius: "2px",
                  }}
                >
                  <CheckCircle2 style={{ width: "8.5px", height: "8.5px" }} />
                  {c.status}
                </span>
              </div>
              <p style={{ fontSize: "10px", color: "#46516B", lineHeight: 1.4, margin: 0 }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
