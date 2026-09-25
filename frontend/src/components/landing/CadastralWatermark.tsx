import React from "react";

interface CadastralWatermarkProps {
  variant?: "hero" | "grid" | "wireframe" | "strata";
  style?: React.CSSProperties;
}

export const CadastralWatermark: React.FC<CadastralWatermarkProps> = ({
  variant = "grid",
  style,
}) => {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
        opacity: 0.035,
        ...style,
      }}
    >
      {variant === "hero" && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 600"
          preserveAspectRatio="none"
          fill="none"
          stroke="#16255C"
        >
          <defs>
            <pattern id="cadastral-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#16255C" strokeWidth="0.5" />
              <circle cx="0" cy="0" r="1.2" fill="#16255C" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cadastral-grid)" opacity="0.3" />
          <polygon points="120,80 460,50 540,340 160,410" strokeWidth="1" strokeDasharray="5 3" />
          <polygon points="460,50 900,30 1000,380 540,340" strokeWidth="1" strokeDasharray="5 3" />
          <polygon points="160,410 540,340 620,560 190,570" strokeWidth="1" strokeDasharray="5 3" />
          <g transform="translate(740, 130)">
            <polygon points="40,220 200,160 320,220 160,280" strokeWidth="1.2" />
            <polygon points="40,170 200,110 320,170 160,230" strokeWidth="0.75" strokeDasharray="3 3" />
            <polygon points="40,120 200,60 320,120 160,180" strokeWidth="0.75" strokeDasharray="3 3" />
            <polygon points="40,70 200,10 320,70 160,130" strokeWidth="0.75" strokeDasharray="3 3" />
            <polygon points="40,20 200,-40 320,20 160,80" strokeWidth="1.2" />
            <line x1="40" y1="20" x2="40" y2="220" strokeWidth="1.2" />
            <line x1="200" y1="-40" x2="200" y2="160" strokeWidth="1.2" />
            <line x1="320" y1="20" x2="320" y2="220" strokeWidth="1.2" />
            <line x1="160" y1="80" x2="160" y2="280" strokeWidth="1.2" />
          </g>
          <text x="30" y="25" fontSize="9" fontFamily="monospace" fill="#16255C">17°26'55"N 78°22'34"E</text>
          <text x="1030" y="585" fontSize="9" fontFamily="monospace" fill="#16255C">EPSG:32644 UTM-44N</text>
        </svg>
      )}

      {variant === "wireframe" && (
        <svg width="100%" height="100%" fill="none" stroke="#16255C">
          <line x1="0" y1="25%" x2="100%" y2="25%" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="50%" x2="100%" y2="50%" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="75%" x2="100%" y2="75%" strokeWidth="0.5" strokeDasharray="4 4" />
        </svg>
      )}

      {variant === "grid" && (
        <svg width="100%" height="100%" fill="none" stroke="#16255C">
          <defs>
            <pattern id="light-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#16255C" strokeWidth="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#light-grid)" />
        </svg>
      )}
    </div>
  );
};
