import React from "react";
import { Home, Box } from "lucide-react";

export interface ViewModeToggleProps {
  currentView: "landing" | "dashboard";
  onToggleView: (view: "landing" | "dashboard") => void;
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  currentView,
  onToggleView,
  className = "",
  style = {},
  compact = false,
}) => {
  const isLanding = currentView === "landing";
  const isDashboard = currentView === "dashboard";

  return (
    <div
      role="radiogroup"
      aria-label="Application View Mode"
      className={`view-mode-toggle-container ${className}`}
      data-testid="view-mode-toggle"
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "rgba(16, 32, 58, 0.85)",
        border: "1px solid rgba(220, 227, 242, 0.16)",
        borderRadius: "4px",
        padding: "2px",
        gap: "2px",
        userSelect: "none",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Landing Segment */}
      <button
        type="button"
        role="radio"
        aria-checked={isLanding}
        data-testid="toggle-landing-btn"
        onClick={() => onToggleView("landing")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleView("landing");
          }
        }}
        title="Switch to Landing & Product Overview"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: compact ? "3px 8px" : "4px 10px",
          borderRadius: "4px",
          border: isLanding
            ? "1px solid rgba(220, 227, 242, 0.22)"
            : "1px solid transparent",
          backgroundColor: isLanding
            ? "rgba(22, 37, 92, 0.8)"
            : "transparent",
          color: isLanding ? "#F7F8FB" : "#AAB4C8",
          fontSize: compact ? "0.70rem" : "0.74rem",
          fontWeight: isLanding ? 700 : 500,
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
          outline: "none",
          boxShadow: "none",
          whiteSpace: "nowrap",
        }}
      >
        {/* Indicator Dot */}
        <span
          style={{
            display: "inline-block",
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: isLanding ? "var(--color-accent)" : "rgba(220, 227, 242, 0.3)",
            transition: "all 0.15s ease",
          }}
        />
        <Home style={{ width: compact ? "11px" : "12px", height: compact ? "11px" : "12px", color: isLanding ? "var(--color-accent)" : "#AAB4C8" }} />
        <span>Landing</span>
      </button>

      {/* 3D Dashboard Segment */}
      <button
        type="button"
        role="radio"
        aria-checked={isDashboard}
        data-testid="toggle-dashboard-btn"
        onClick={() => onToggleView("dashboard")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleView("dashboard");
          }
        }}
        title="Switch to 3D Cadastral Workspace"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: compact ? "3px 8px" : "4px 10px",
          borderRadius: "4px",
          border: isDashboard
            ? "1px solid rgba(220, 227, 242, 0.22)"
            : "1px solid transparent",
          backgroundColor: isDashboard
            ? "rgba(22, 37, 92, 0.8)"
            : "transparent",
          color: isDashboard ? "#F7F8FB" : "#AAB4C8",
          fontSize: compact ? "0.70rem" : "0.74rem",
          fontWeight: isDashboard ? 700 : 500,
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
          outline: "none",
          boxShadow: "none",
          whiteSpace: "nowrap",
        }}
      >
        {/* Indicator Dot */}
        <span
          style={{
            display: "inline-block",
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: isDashboard ? "var(--color-accent)" : "rgba(220, 227, 242, 0.3)",
            transition: "all 0.15s ease",
          }}
        />
        <Box style={{ width: compact ? "11px" : "12px", height: compact ? "11px" : "12px", color: isDashboard ? "var(--color-accent)" : "#AAB4C8" }} />
        <span>3D Dashboard</span>
      </button>
    </div>
  );
};
