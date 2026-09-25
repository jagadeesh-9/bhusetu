import React, { useEffect, useState } from "react";
import * as Cesium from "cesium";

interface CesiumCompassProps {
  viewer: Cesium.Viewer | null;
}

export interface AxisProjection {
  name: "X" | "Y" | "Z";
  label: string;
  x: number;
  y: number;
  depth: number;
  color: string;
  darkColor: string;
}

export interface CardinalScreenPosition {
  x: number;
  y: number;
  relativeAngleDeg: number; // 0 = top, 90 = right, 180 = bottom, 270 = left
  screenDirection: "top" | "right" | "bottom" | "left" | "top-right" | "bottom-right" | "bottom-left" | "top-left";
}

/**
 * Computes the screen-space position and direction of a cardinal marker (N, E, S, W)
 * given the camera's geographic heading in degrees.
 *
 * Geographic frame:
 *   North = 0°
 *   East  = 90°
 *   South = 180°
 *   West  = 270°
 *
 * Screen-space angle relative to top of screen (0°):
 *   relAngle = (cardinalBaseAngle - cameraHeadingDeg) mod 360
 */
export function computeCardinalScreenPosition(
  cardinalBaseAngleDeg: number,
  cameraHeadingDeg: number,
  center = 55,
  radius = 35
): CardinalScreenPosition {
  const relAngle = ((cardinalBaseAngleDeg - cameraHeadingDeg) % 360 + 360) % 360;
  const rad = (relAngle * Math.PI) / 180;
  const x = Number((center + radius * Math.sin(rad)).toFixed(1));
  const y = Number((center - radius * Math.cos(rad)).toFixed(1));

  let screenDirection: CardinalScreenPosition["screenDirection"];
  if (Math.abs(relAngle - 0) < 5 || Math.abs(relAngle - 360) < 5) screenDirection = "top";
  else if (Math.abs(relAngle - 90) < 5) screenDirection = "right";
  else if (Math.abs(relAngle - 180) < 5) screenDirection = "bottom";
  else if (Math.abs(relAngle - 270) < 5) screenDirection = "left";
  else if (relAngle > 0 && relAngle < 90) screenDirection = "top-right";
  else if (relAngle > 90 && relAngle < 180) screenDirection = "bottom-right";
  else if (relAngle > 180 && relAngle < 270) screenDirection = "bottom-left";
  else screenDirection = "top-left";

  return { x, y, relativeAngleDeg: relAngle, screenDirection };
}

/**
 * Projects a 3D unit vector from the geographic East-North-Up (ENU) frame:
 *   +X: East
 *   +Y: North
 *   +Z: Up
 * into screen-space 2D coordinates according to camera heading and pitch.
 */
export function project3DAxisVector(
  vx: number, // East component
  vy: number, // North component
  vz: number, // Up component
  headingDeg: number,
  pitchDeg: number,
  center = 55,
  axisLength = 25
) {
  const hRad = (headingDeg * Math.PI) / 180;
  const pRad = (pitchDeg * Math.PI) / 180;

  // 1. Horizontal rotation by heading into camera horizontal plane:
  //    Right   = +xh (along screen X)
  //    Forward = +yh (into horizon)
  const xh = Math.cos(hRad) * vx - Math.sin(hRad) * vy;
  const yh = Math.sin(hRad) * vx + Math.cos(hRad) * vy;

  // 2. Vertical tilt projection by camera pitch:
  //    Screen X: unchanged (orthogonal to pitch axis)
  //    Screen Y: forward tilted up into screen (-yh * sin(pitch)) plus vertical height (vz * cos(pitch))
  //    Depth Z:  depth into screen
  const sx = xh;
  const sy = -yh * Math.sin(pRad) + vz * Math.cos(pRad);
  const sz = yh * Math.cos(pRad) + vz * Math.sin(pRad);

  return {
    x: Number((center + sx * axisLength).toFixed(1)),
    y: Number((center - sy * axisLength).toFixed(1)), // SVG Y increases downward
    depth: Number(sz.toFixed(2)),
    sx,
    sy,
    sz,
  };
}

export const CesiumCompass: React.FC<CesiumCompassProps> = ({ viewer }) => {
  const [orientation, setOrientation] = useState<{ heading: number; pitch: number }>({
    heading: 0,
    pitch: -26,
  });

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    let lastH = -9999;
    let lastP = -9999;

    const updateOrientation = () => {
      try {
        if (!viewer || viewer.isDestroyed()) return;
        const headingRad = viewer.camera?.heading ?? 0;
        const pitchRad = viewer.camera?.pitch ?? Cesium.Math.toRadians(-26);

        const rawHDeg = Cesium.Math.toDegrees(headingRad);
        const normHDeg = ((rawHDeg % 360) + 360) % 360;
        const hDeg = Math.round(normHDeg * 10) / 10;
        const pDeg = Math.round(Cesium.Math.toDegrees(pitchRad) * 10) / 10;

        if (Math.abs(hDeg - lastH) >= 0.2 || Math.abs(pDeg - lastP) >= 0.2) {
          lastH = hDeg;
          lastP = pDeg;
          setOrientation({ heading: hDeg, pitch: pDeg });
        }
      } catch {
        // Safeguard against destroyed scene during unmount
      }
    };

    if (viewer.camera) {
      viewer.camera.percentageChanged = 0.001;
      viewer.camera.changed.addEventListener(updateOrientation);
    }
    if (viewer.scene?.postRender) {
      viewer.scene.postRender.addEventListener(updateOrientation);
    }

    // Initial orientation read
    updateOrientation();

    return () => {
      try {
        if (!viewer.isDestroyed()) {
          if (viewer.camera) {
            viewer.camera.changed.removeEventListener(updateOrientation);
          }
          if (viewer.scene?.postRender) {
            viewer.scene.postRender.removeEventListener(updateOrientation);
          }
        }
      } catch {
        // Safeguard during teardown
      }
    };
  }, [viewer]);

  // Proportional 110px dimensions: center at (55, 55), axis length = 25px
  const center = 55;
  const axisLength = 25;

  const projectVector = (
    vx: number,
    vy: number,
    vz: number,
    name: "X" | "Y" | "Z",
    color: string,
    darkColor: string
  ): AxisProjection => {
    const proj = project3DAxisVector(vx, vy, vz, orientation.heading, orientation.pitch, center, axisLength);
    return {
      name,
      label: name,
      x: proj.x,
      y: proj.y,
      depth: proj.depth,
      color,
      darkColor,
    };
  };

  // Geographic reference frame: X = East (+X), Y = North (+Y), Z = Up (+Z)
  const axisX = projectVector(1, 0, 0, "X", "#ef4444", "#991b1b");
  const axisY = projectVector(0, 1, 0, "Y", "#10b981", "#065f46");
  const axisZ = projectVector(0, 0, 1, "Z", "#06b6d4", "#0e7490");

  // Depth-sort axes so closest axis to viewer is rendered in foreground
  const sortedAxes = [axisX, axisY, axisZ].sort((a, b) => a.depth - b.depth);

  return (
    <div
      className="cesium-navigation-widget cesium-compass-control"
      data-testid="cesium-navigation-widget"
      style={{
        position: "absolute",
        bottom: "22px",
        right: "22px",
        width: "110px",
        height: "110px",
        borderRadius: "50%",
        backgroundColor: "transparent",
        backdropFilter: "none",
        border: "none",
        boxShadow: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        pointerEvents: "auto",
        userSelect: "none",
        cursor: "default",
      }}
      title={`3D Coordinate Gizmo & Compass (Heading: ${Math.round(orientation.heading)}°, Pitch: ${Math.round(orientation.pitch)}°)`}
      aria-label="3D Coordinate Orientation Gizmo and Compass"
      role="region"
    >
      <svg
        width="110"
        height="110"
        viewBox="0 0 110 110"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Subtle background reference grid / bezel */}
        <circle
          cx={center}
          cy={center}
          r="48.5"
          fill="none"
          stroke="rgba(17, 17, 17, 0.22)"
          strokeWidth="1.2"
        />

        {/* Outer Compass Cardinal Ring (rotates continuously by -heading) */}
        <g
          data-testid="compass-needle-group"
          style={{
            transformOrigin: `${center}px ${center}px`,
            transform: `rotate(${-orientation.heading}deg)`,
            transition: "transform 0.05s linear",
          }}
        >
          {/* North directional pointer arrow */}
          <polygon points="55,3 50.5,12 59.5,12" fill="#ef4444" />
          <polygon points="55,3 50.5,12 55,10.5" fill="#dc2626" />

          {/* 45° bearing ticks (NE, SE, SW, NW) */}
          <line x1="88" y1="22" x2="85" y2="25" stroke="rgba(17, 17, 17, 0.4)" strokeWidth="1.2" />
          <line x1="88" y1="88" x2="85" y2="85" stroke="rgba(17, 17, 17, 0.4)" strokeWidth="1.2" />
          <line x1="22" y1="88" x2="25" y2="85" stroke="rgba(17, 17, 17, 0.4)" strokeWidth="1.2" />
          <line x1="22" y1="22" x2="25" y2="25" stroke="rgba(17, 17, 17, 0.4)" strokeWidth="1.2" />

          {/* Cardinal Markers: N, E, S, W in dark #111111 with high-contrast halo */}
          <text
            data-testid="cardinal-N"
            x="55"
            y="21"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111111"
            fontSize="10"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            style={{ filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))" }}
          >
            N
          </text>
          <text
            data-testid="cardinal-E"
            x="97"
            y="55"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111111"
            fontSize="9"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            style={{ filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))" }}
          >
            E
          </text>
          <text
            data-testid="cardinal-S"
            x="55"
            y="97"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111111"
            fontSize="9"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            style={{ filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))" }}
          >
            S
          </text>
          <text
            data-testid="cardinal-W"
            x="13"
            y="55"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111111"
            fontSize="9"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            style={{ filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.95))" }}
          >
            W
          </text>
        </g>

        {/* 3D Coordinate Axis Gizmo Triad (Depth-Sorted) */}
        <g data-testid="axis-gizmo-group">
          {sortedAxes.map((axis) => {
            const dx = axis.x - center;
            const dy = axis.y - center;
            const dist = Math.hypot(dx, dy);

            // Calculate directional arrowhead base points
            const ux = dist > 2 ? dx / dist : 0;
            const uy = dist > 2 ? dy / dist : -1;
            const nx = -uy;
            const ny = ux;

            const arrowBaseX = axis.x - ux * 6;
            const arrowBaseY = axis.y - uy * 6;
            const arrowSide1X = arrowBaseX + nx * 3.5;
            const arrowSide1Y = arrowBaseY + ny * 3.5;
            const arrowSide2X = arrowBaseX - nx * 3.5;
            const arrowSide2Y = arrowBaseY - ny * 3.5;

            // Opacity cue for depth
            const opacity = axis.depth < -0.3 ? 0.75 : 1.0;

            return (
              <g key={axis.name} data-testid={`axis-${axis.name}`} opacity={opacity}>
                {/* Main Axis Shaft Line */}
                <line
                  x1={center}
                  y1={center}
                  x2={axis.x}
                  y2={axis.y}
                  stroke={axis.color}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Directional Arrowhead */}
                {dist > 4 && (
                  <polygon
                    points={`${axis.x},${axis.y} ${arrowSide1X},${arrowSide1Y} ${arrowSide2X},${arrowSide2Y}`}
                    fill={axis.color}
                  />
                )}

                {/* High-Readability Circular Axis Badge */}
                <circle
                  cx={axis.x}
                  cy={axis.y}
                  r="7"
                  fill={axis.color}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <text
                  x={axis.x}
                  y={axis.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="800"
                  fontFamily="Inter, sans-serif"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}

          {/* Central Origin Pivot Dot */}
          <circle cx={center} cy={center} r="4.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.8" />
          <circle cx={center} cy={center} r="1.8" fill="#38bdf8" />
        </g>
      </svg>
    </div>
  );
};
