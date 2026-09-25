import React from "react";

export const GovernmentValueSection: React.FC = () => {
  const chain = [
    { title: "3D PROPERTY DATA", desc: "Volumetric spatial bounds with vertical extents" },
    { title: "BETTER SPATIAL INFORMATION", desc: "Unified cadastral baseline for land & multi-level buildings" },
    { title: "BETTER GOVERNMENT DECISIONS", desc: "Evidence-based urban management & policy execution" },
    { title: "PLANNING • ASSESSMENT • VERIFICATION", desc: "Property tax assessment, building clearance & dispute resolution" },
  ];

  const outcomes = [
    { title: "BETTER SERVICES", desc: "Citizen self-service verification of apartment strata and air rights" },
    { title: "GREATER TRANSPARENCY", desc: "Eliminates duplicate registrations and fraudulent multi-floor claims" },
    { title: "SMARTER URBAN GOVERNANCE", desc: "Enables 3D spatial digital twins for municipal administration" },
  ];

  return (
    <section
      id="section-gov-value"
      style={{
        padding: "40px 24px",
        backgroundColor: "#F7F8FB",
        borderBottom: "1px solid #DCE3F2",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1F7AE0", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
            PUBLIC VALUE ARCHITECTURE
          </span>
          <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#16255C", margin: 0 }}>
            GOVERNMENT VALUE
          </h2>
          <p style={{ fontSize: "12.5px", color: "#46516B", margin: "3px 0 0 0" }}>
            How 3D volumetric cadastral infrastructure drives municipal administration, taxation, and land governance.
          </p>
        </div>

        {/* Causal Value Chain Diagram */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {chain.map((c, i) => (
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#16255C" }}>{c.title}</span>
                {i < chain.length - 1 && <span style={{ fontSize: "11px", color: "#1F7AE0", fontWeight: 700 }}>→</span>}
              </div>
              <p style={{ fontSize: "10.5px", color: "#46516B", margin: 0, lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Three Institutional Outcomes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {outcomes.map((o, i) => (
            <div
              key={i}
              style={{
                background: "#16255C",
                color: "#FFFFFF",
                borderRadius: "4px",
                padding: "14px 18px",
                boxShadow: "0 1px 4px rgba(22, 37, 92, 0.08)",
              }}
            >
              <div style={{ fontSize: "11.5px", fontWeight: 800, letterSpacing: "0.03em", color: "#E0A93C", marginBottom: "3px" }}>
                {o.title}
              </div>
              <div style={{ fontSize: "11px", color: "#CBD5E1", lineHeight: 1.45 }}>
                {o.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
