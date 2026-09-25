import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  CesiumCompass,
  computeCardinalScreenPosition,
  project3DAxisVector,
} from "../components/CesiumCompass";

describe("Cesium Navigation Widget & Geographic Reference", () => {
  describe("Visual Styling & Dark Cardinal Markers", () => {
    it("renders all four cardinal letters (N, E, S, W) in dark #111111 neutral color", () => {
      const html = renderToString(<CesiumCompass viewer={null} />);
      expect(html).toContain('data-testid="cardinal-N"');
      expect(html).toContain('data-testid="cardinal-E"');
      expect(html).toContain('data-testid="cardinal-S"');
      expect(html).toContain('data-testid="cardinal-W"');

      // Cardinal text color must be #111111
      expect(html).toContain('fill="#111111"');
      // Must not use old colored text for cardinal letters
      const count111 = (html.match(/fill="#111111"/g) || []).length;
      expect(count111).toBe(4); // All 4 cardinal markers: N, E, S, W
    });

    it("preserves X, Y, Z coordinate axis color designations", () => {
      const html = renderToString(<CesiumCompass viewer={null} />);
      // +X Axis (East / Red)
      expect(html).toContain('data-testid="axis-X"');
      expect(html).toContain(">X<");
      expect(html).toContain('fill="#ef4444"');

      // +Y Axis (North / Emerald Green)
      expect(html).toContain('data-testid="axis-Y"');
      expect(html).toContain(">Y<");
      expect(html).toContain('fill="#10b981"');

      // +Z Axis (Elevation / Cyan)
      expect(html).toContain('data-testid="axis-Z"');
      expect(html).toContain(">Z<");
      expect(html).toContain('fill="#06b6d4"');
    });

    it("maintains transparent background, 110px size, and bottom-right viewport positioning", () => {
      const html = renderToString(<CesiumCompass viewer={null} />);
      expect(html).toContain("position:absolute");
      expect(html).toContain("bottom:22px");
      expect(html).toContain("right:22px");
      expect(html).toContain("width:110px");
      expect(html).toContain("height:110px");
      expect(html).toContain("border-radius:50%");
      expect(html).toContain("background-color:transparent");
    });
  });

  describe("Geographic Cardinal Heading Orientation Tests", () => {
    const N_BASE = 0;
    const E_BASE = 90;
    const S_BASE = 180;
    const W_BASE = 270;

    it("CASE A: Camera heading = 0° (North-facing) -> N: top, E: right, S: bottom, W: left", () => {
      const heading = 0;
      const nPos = computeCardinalScreenPosition(N_BASE, heading);
      const ePos = computeCardinalScreenPosition(E_BASE, heading);
      const sPos = computeCardinalScreenPosition(S_BASE, heading);
      const wPos = computeCardinalScreenPosition(W_BASE, heading);

      expect(nPos.screenDirection).toBe("top");
      expect(ePos.screenDirection).toBe("right");
      expect(sPos.screenDirection).toBe("bottom");
      expect(wPos.screenDirection).toBe("left");

      // Verify coordinate positions relative to center (55, 55)
      expect(nPos.y).toBeLessThan(55); // Top
      expect(nPos.x).toBe(55);
      expect(ePos.x).toBeGreaterThan(55); // Right
      expect(ePos.y).toBe(55);
      expect(sPos.y).toBeGreaterThan(55); // Bottom
      expect(sPos.x).toBe(55);
      expect(wPos.x).toBeLessThan(55); // Left
      expect(wPos.y).toBe(55);
    });

    it("CASE B: Camera heading = 90° (East-facing) -> E: top, S: right, W: bottom, N: left", () => {
      const heading = 90;
      const ePos = computeCardinalScreenPosition(E_BASE, heading);
      const sPos = computeCardinalScreenPosition(S_BASE, heading);
      const wPos = computeCardinalScreenPosition(W_BASE, heading);
      const nPos = computeCardinalScreenPosition(N_BASE, heading);

      expect(ePos.screenDirection).toBe("top");
      expect(sPos.screenDirection).toBe("right");
      expect(wPos.screenDirection).toBe("bottom");
      expect(nPos.screenDirection).toBe("left");

      expect(ePos.y).toBeLessThan(55); // Top
      expect(sPos.x).toBeGreaterThan(55); // Right
      expect(wPos.y).toBeGreaterThan(55); // Bottom
      expect(nPos.x).toBeLessThan(55); // Left
    });

    it("CASE C: Camera heading = 180° (South-facing) -> S: top, W: right, N: bottom, E: left", () => {
      const heading = 180;
      const sPos = computeCardinalScreenPosition(S_BASE, heading);
      const wPos = computeCardinalScreenPosition(W_BASE, heading);
      const nPos = computeCardinalScreenPosition(N_BASE, heading);
      const ePos = computeCardinalScreenPosition(E_BASE, heading);

      expect(sPos.screenDirection).toBe("top");
      expect(wPos.screenDirection).toBe("right");
      expect(nPos.screenDirection).toBe("bottom");
      expect(ePos.screenDirection).toBe("left");

      expect(sPos.y).toBeLessThan(55); // Top
      expect(wPos.x).toBeGreaterThan(55); // Right
      expect(nPos.y).toBeGreaterThan(55); // Bottom
      expect(ePos.x).toBeLessThan(55); // Left
    });

    it("CASE D: Camera heading = 270° (West-facing) -> W: top, N: right, E: bottom, S: left", () => {
      const heading = 270;
      const wPos = computeCardinalScreenPosition(W_BASE, heading);
      const nPos = computeCardinalScreenPosition(N_BASE, heading);
      const ePos = computeCardinalScreenPosition(E_BASE, heading);
      const sPos = computeCardinalScreenPosition(S_BASE, heading);

      expect(wPos.screenDirection).toBe("top");
      expect(nPos.screenDirection).toBe("right");
      expect(ePos.screenDirection).toBe("bottom");
      expect(sPos.screenDirection).toBe("left");

      expect(wPos.y).toBeLessThan(55); // Top
      expect(nPos.x).toBeGreaterThan(55); // Right
      expect(ePos.y).toBeGreaterThan(55); // Bottom
      expect(sPos.x).toBeLessThan(55); // Left
    });

    it("Intermediate headings (45°, 135°, 225°, 315°) maintain mathematical continuity", () => {
      // 45°: Camera looks North-East -> N is top-left, E is top-right, S is bottom-right, W is bottom-left
      expect(computeCardinalScreenPosition(N_BASE, 45).screenDirection).toBe("top-left");
      expect(computeCardinalScreenPosition(E_BASE, 45).screenDirection).toBe("top-right");
      expect(computeCardinalScreenPosition(S_BASE, 45).screenDirection).toBe("bottom-right");
      expect(computeCardinalScreenPosition(W_BASE, 45).screenDirection).toBe("bottom-left");

      // 135°: Camera looks South-East -> S is top-right, E is top-left, W is bottom-right, N is bottom-left
      expect(computeCardinalScreenPosition(S_BASE, 135).screenDirection).toBe("top-right");
      expect(computeCardinalScreenPosition(E_BASE, 135).screenDirection).toBe("top-left");
      expect(computeCardinalScreenPosition(W_BASE, 135).screenDirection).toBe("bottom-right");
      expect(computeCardinalScreenPosition(N_BASE, 135).screenDirection).toBe("bottom-left");

      // 225°: Camera looks South-West -> S is top-left, W is top-right, N is bottom-right, E is bottom-left
      expect(computeCardinalScreenPosition(S_BASE, 225).screenDirection).toBe("top-left");
      expect(computeCardinalScreenPosition(W_BASE, 225).screenDirection).toBe("top-right");
      expect(computeCardinalScreenPosition(N_BASE, 225).screenDirection).toBe("bottom-right");
      expect(computeCardinalScreenPosition(E_BASE, 225).screenDirection).toBe("bottom-left");

      // 315°: Camera looks North-West -> N is top-right, W is top-left, E is bottom-right, S is bottom-left
      expect(computeCardinalScreenPosition(N_BASE, 315).screenDirection).toBe("top-right");
      expect(computeCardinalScreenPosition(W_BASE, 315).screenDirection).toBe("top-left");
      expect(computeCardinalScreenPosition(E_BASE, 315).screenDirection).toBe("bottom-right");
      expect(computeCardinalScreenPosition(S_BASE, 315).screenDirection).toBe("bottom-left");
    });
  });

  describe("3D Coordinate Gizmo Consistency (+X = East, +Y = North, +Z = Up)", () => {
    it("verifies +X = East, +Y = North, +Z = Up at heading = 0° and oblique pitch = -30°", () => {
      const heading = 0;
      const pitch = -30;

      const axisX = project3DAxisVector(1, 0, 0, heading, pitch); // East
      const axisY = project3DAxisVector(0, 1, 0, heading, pitch); // North
      const axisZ = project3DAxisVector(0, 0, 1, heading, pitch); // Up

      // +X (East) points to screen right
      expect(axisX.x).toBeGreaterThan(55);
      expect(axisX.y).toBe(55);

      // +Y (North) points to screen top
      expect(axisY.x).toBe(55);
      expect(axisY.y).toBeLessThan(55);

      // +Z (Up) points upwards on screen
      expect(axisZ.x).toBe(55);
      expect(axisZ.y).toBeLessThan(55);
    });

    it("verifies gizmo and compass agreement at heading = 90° (East-facing) and pitch = -45°", () => {
      const heading = 90;
      const pitch = -45;

      const axisX = project3DAxisVector(1, 0, 0, heading, pitch); // East
      const axisY = project3DAxisVector(0, 1, 0, heading, pitch); // North

      // In East-facing view, East (+X) points TOP towards horizon
      expect(axisX.y).toBeLessThan(55);
      expect(axisX.x).toBe(55);

      // In East-facing view, North (+Y) points LEFT
      expect(axisY.x).toBeLessThan(55);
      expect(axisY.y).toBe(55);

      // Matches compass: E is at top, N is at left
      const ePos = computeCardinalScreenPosition(90, heading);
      const nPos = computeCardinalScreenPosition(0, heading);
      expect(ePos.screenDirection).toBe("top");
      expect(nPos.screenDirection).toBe("left");
    });

    it("verifies gizmo and compass agreement at heading = 180° (South-facing) and pitch = -45°", () => {
      const heading = 180;
      const pitch = -45;

      const axisX = project3DAxisVector(1, 0, 0, heading, pitch); // East
      const axisY = project3DAxisVector(0, 1, 0, heading, pitch); // North

      // Facing South, East (+X) is to the LEFT
      expect(axisX.x).toBeLessThan(55);
      expect(axisX.y).toBe(55);

      // Facing South, North (+Y) is behind / DOWN
      expect(axisY.y).toBeGreaterThan(55);
      expect(axisY.x).toBe(55);
    });

    it("verifies gizmo and compass agreement at heading = 270° (West-facing) and pitch = -45°", () => {
      const heading = 270;
      const pitch = -45;

      const axisX = project3DAxisVector(1, 0, 0, heading, pitch); // East
      const axisY = project3DAxisVector(0, 1, 0, heading, pitch); // North

      // Facing West, East (+X) is behind / DOWN
      expect(axisX.y).toBeGreaterThan(55);
      expect(axisX.x).toBe(55);

      // Facing West, North (+Y) is to the RIGHT
      expect(axisY.x).toBeGreaterThan(55);
      expect(axisY.y).toBe(55);
    });
  });

  describe("Cesium Camera Integration", () => {
    it("renders with viewer instance in initial state without crashing", () => {
      const addChangedListener = vi.fn();
      const removeChangedListener = vi.fn();
      const addPostRenderListener = vi.fn();
      const removePostRenderListener = vi.fn();

      const mockViewer = {
        isDestroyed: () => false,
        camera: {
          heading: 0,
          pitch: -0.45,
          percentageChanged: 0.5,
          changed: {
            addEventListener: addChangedListener,
            removeEventListener: removeChangedListener,
          },
        },
        scene: {
          postRender: {
            addEventListener: addPostRenderListener,
            removeEventListener: removePostRenderListener,
          },
        },
      } as any;

      const html = renderToString(<CesiumCompass viewer={mockViewer} />);
      expect(html).toContain("cesium-navigation-widget");
    });
  });
});
