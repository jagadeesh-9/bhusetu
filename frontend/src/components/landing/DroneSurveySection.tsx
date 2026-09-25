import React from "react";

interface DroneSurveySectionProps {
  onOpenDroneSurvey?: () => void;
}

export const DroneSurveySection: React.FC<DroneSurveySectionProps> = ({
  onOpenDroneSurvey,
}) => {
  const steps = [
    { title: "SURVEY IMAGES", detail: "UAV autonomous grid flights with nadir & 45° oblique facade camera capture" },
    { title: "EVIDENCE AUDIT", detail: "Photogrammetry quality audit: GSD 1.8 cm/px, 98.4% forward/side image overlap" },
    { title: "DERIVED SPATIAL DATA", detail: "Dense point clouds, DSM, true orthomosaics, and 3D textured mesh models" },
    { title: "3D CADASTRAL WORKFLOW", detail: "Boundary extraction and floor-level geometry fed into statutory 3D review" },
  ];

  return (
    <section
      id="section-drone"
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
              UAV PHOTOGRAMMETRY INGESTION
            </span>
            <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
              DRONE SURVEY INTEGRATION
            </h2>
            <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
              High-resolution drone photogrammetry and waypoint flight survey ingestion for high-precision 3D digital cadastre.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenDroneSurvey}
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
            <span>OPEN DRONE SURVEY →</span>
          </button>
        </div>

        {/* Photogrammetry Flow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          {steps.map((st, i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "14px",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#16255C", letterSpacing: "0.03em" }}>
                  {st.title}
                </span>
                {i < steps.length - 1 && (
                  <span style={{ fontSize: "10px", color: "#1F7AE0", fontWeight: 700 }}>→</span>
                )}
              </div>
              <p style={{ fontSize: "10.5px", color: "#46516B", margin: 0, lineHeight: 1.45 }}>
                {st.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
