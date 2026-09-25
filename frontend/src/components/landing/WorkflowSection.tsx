import React from "react";

export const WorkflowSection: React.FC = () => {
  const steps = [
    { num: "01", title: "2D LAND RECORD", desc: "RoR, Cadastral Map, Land Parcel Boundary (EPSG:4326 / 32644)" },
    { num: "02", title: "SPATIAL DATA", desc: "Copernicus DEM 30m, OSM Reference Footprints, Drone Orthophotos" },
    { num: "03", title: "3D RECONSTRUCTION", desc: "Volumetric Extrusion, Facade Feature Matching, Polyhedral LoD2 Solids" },
    { num: "04", title: "VERTICAL STRATA", desc: "Multi-Storey Floor Decomposition, Zmin/Zmax Bounds, Unit Subdivision" },
    { num: "05", title: "VALIDATION", desc: "SFCGAL / PostGIS Topological QC, Non-Overlap Proofs, Containment Checks" },
    { num: "06", title: "3D PROPERTY IDENTITY", desc: "Unique 3D ULPIN Assignment, Volumetric Registry, Institutional Handoff" },
  ];

  return (
    <section
      id="section-workflow"
      style={{
        padding: "36px 24px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
            ENGINEERING PIPELINE
          </span>
          <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
            HOW BHUSETU WORKS
          </h2>
          <p style={{ fontSize: "12.5px", color: "#46516B", margin: "4px auto 0 auto", maxWidth: "620px" }}>
            Continuous volumetric cadastral pipeline transforming flat survey parcels into legal 3D spatial units.
          </p>
        </div>

        {/* Engineering blocks chain */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
            alignItems: "stretch",
          }}
        >
          {steps.map((step, idx) => (
            <div
              key={step.num}
              style={{
                background: "#F7F8FB",
                border: "1px solid #DCE3F2",
                borderRadius: "3px",
                padding: "12px 10px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#1F7AE0", fontFamily: "monospace" }}>
                  {step.num}
                </span>
                {idx < steps.length - 1 && (
                  <span style={{ fontSize: "10px", color: "#6B7086", fontWeight: 700 }}>→</span>
                )}
              </div>
              <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#16255C", textTransform: "uppercase", margin: "0 0 4px 0", letterSpacing: "0.03em" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "10px", color: "#46516B", lineHeight: 1.4, margin: 0 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
