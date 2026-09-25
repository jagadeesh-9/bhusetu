import React from "react";

export const GovernmentHeader: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #DCE3F2",
        padding: "10px 32px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* LEFT: Government of India / Department of Rural Development */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <img
          src="/assets/gov-rural-dev-logo.png"
          alt="Government of India - Department of Rural Development"
          style={{
            height: "76px",
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

      {/* CENTER: BhuSetu Brand Name & Descriptor (Calibrated Hierarchy) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: "25px",
            fontWeight: 800,
            lineHeight: "1.15",
            letterSpacing: "-0.01em",
          }}
        >
          <span style={{ color: "#16255C" }}>Bhu</span>
          <span style={{ color: "#1F7AE0" }}>Setu</span>
        </div>
        <div
          style={{
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            color: "#46516B",
            letterSpacing: "0.03em",
            marginTop: "3px",
            textTransform: "uppercase",
          }}
        >
          3D ULPIN &amp; Vertical Property Mapping System
        </div>
      </div>

      {/* RIGHT: Swachh Bharat Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <img
          src="/assets/swachh-bharat-logo.png"
          alt="Swachh Bharat - Ek Kadam Swachhata Ki Aur"
          style={{
            height: "72px",
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
