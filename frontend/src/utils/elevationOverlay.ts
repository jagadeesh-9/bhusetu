/**
 * Phase 3.7R: Architectural Vertical Elevation Level Overlay Utilities.
 * Computes architectural horizontal guide lines, benchmark ticks, and elevation labels
 * relative to the canonical visual ground reference (Z = 0.00 m).
 */
import * as Cesium from "cesium";
import type { VerticalUnit, Building } from "../types/cadastre";
import {
  CANONICAL_VISUAL_GROUND_Z,
  transform32644ToWGS84,
} from "./coordinateTransform";

export interface ElevationLevel {
  id: string;
  floorCode: string;
  unitLabel: string;
  prototypeZ: number;
  renderZ: number;
  displayElevation: string;
  isBasement: boolean;
  isGround: boolean;
  isRooftop: boolean;
  unit?: VerticalUnit;
}

export interface ElevationOverlayEntity {
  name: string;
  position?: any;
  polyline?: any;
  point?: any;
  label?: any;
  levelData?: ElevationLevel;
}

// Canonical OSM Way 356027047 geometry in EPSG:32644
const CANONICAL_OSM_COORDS: number[][] = [
  [219986.82, 1933088.62],
  [219985.71, 1933104.81],
  [220009.01, 1933106.37],
  [220010.12, 1933090.19],
  [219986.82, 1933088.62],
];

/**
 * Derives structured elevation levels from active vertical units or canonical vertical strata.
 */
export function deriveElevationLevels(
  units: VerticalUnit[] = [],
  groundElevation: number = CANONICAL_VISUAL_GROUND_Z
): ElevationLevel[] {
  const levels: ElevationLevel[] = [];

  if (units && units.length > 0) {
    // Only derive elevation markers for storey-level vertical units
    const storeyUnits = units.filter((u) => !u.parent_unit_id && (u.unit_level === "STOREY" || !u.unit_level));
    // Sort units ascending by vertical position (basement to rooftop)
    const sortedUnits = [...storeyUnits].sort((a, b) => a.z_min - b.z_min);

    // Determine the ground reference Z (F00 / GF / P00 datum or configured ground elevation)
    const groundUnit = sortedUnits.find(
      (u) => u.floor_code === "F00" || u.floor_code === "P00" || u.floor_code === "GF"
    );
    const effectiveGroundZ = groundUnit ? groundUnit.z_min : groundElevation;

    // 1. Add Basement Levels (if basement exists)
    const basementUnits = sortedUnits.filter(
      (u) => u.tier_code === "SB" || u.floor_code === "B01" || u.floor_code.startsWith("B") || u.tier_code === "UT"
    );
    basementUnits.forEach((u) => {
      const renderZ = Number((u.z_min - effectiveGroundZ).toFixed(2));
      levels.push({
        id: `level-bottom-${u.id}`,
        floorCode: u.floor_code,
        unitLabel: u.unit_label || "Basement Parking Level",
        prototypeZ: u.z_min,
        renderZ,
        displayElevation: `${renderZ < 0 ? "" : "+"}${renderZ.toFixed(2)} m`,
        isBasement: true,
        isGround: false,
        isRooftop: false,
        unit: u,
      });
    });

    // 2. Add Ground Reference Level (F00 Datum Z = 0.00m)
    if (groundUnit) {
      const renderZ = Number((groundUnit.z_min - effectiveGroundZ).toFixed(2));
      levels.push({
        id: `level-ground-${groundUnit.id}`,
        floorCode: groundUnit.floor_code,
        unitLabel: groundUnit.unit_label || "Ground Floor Reference",
        prototypeZ: groundUnit.z_min,
        renderZ,
        displayElevation: "±0.00 m",
        isBasement: false,
        isGround: true,
        isRooftop: false,
        unit: groundUnit,
      });
    }

    // 3. Add Upper Floors Reference Levels (F01, F02, ...) using actual floor slab level (z_min)
    const upperUnits = sortedUnits.filter(
      (u) =>
        u.id !== groundUnit?.id &&
        !basementUnits.some((b) => b.id === u.id) &&
        u.tier_code !== "AR" &&
        u.tier_code !== "AE" &&
        u.floor_code !== "RF01" &&
        !u.floor_code.startsWith("RF")
    );
    upperUnits.forEach((u) => {
      const renderZ = Number((u.z_min - effectiveGroundZ).toFixed(2));
      levels.push({
        id: `level-floor-${u.id}`,
        floorCode: u.floor_code,
        unitLabel: u.unit_label || `Floor ${u.floor_code}`,
        prototypeZ: u.z_min,
        renderZ,
        displayElevation: `+${renderZ.toFixed(2)} m`,
        isBasement: false,
        isGround: false,
        isRooftop: false,
        unit: u,
      });
    });

    // 4. Add Rooftop Terrace Level (RF01) using rooftop floor level (z_min)
    const rooftopUnits = sortedUnits.filter(
      (u) => u.tier_code === "AR" || u.tier_code === "AE" || u.floor_code === "RF01" || u.floor_code.startsWith("RF")
    );
    rooftopUnits.forEach((u) => {
      const renderZ = Number((u.z_min - effectiveGroundZ).toFixed(2));
      levels.push({
        id: `level-floor-${u.id}`,
        floorCode: u.floor_code,
        unitLabel: u.unit_label || "Rooftop Common Terrace",
        prototypeZ: u.z_min,
        renderZ,
        displayElevation: `+${renderZ.toFixed(2)} m`,
        isBasement: false,
        isGround: false,
        isRooftop: true,
        unit: u,
      });
    });
  } else {
    // Canonical Fallback Defaults based on actual prototype geometry (Z_ground = 540.00m)
    const canonicalLevels: Array<[string, number, number, boolean, boolean, boolean]> = [
      ["B01", 536.50, -3.50, true, false, false],
      ["F00", 540.00, 0.00, false, true, false],
      ["F01", 543.50, 3.50, false, false, false],
      ["F02", 546.50, 6.50, false, false, false],
      ["F03", 549.50, 9.50, false, false, false],
      ["F04", 552.50, 12.50, false, false, false],
      ["F05", 555.50, 15.50, false, false, false],
      ["RF01", 558.50, 18.50, false, false, true],
    ];

    canonicalLevels.forEach(([floorCode, protoZ, rendZ, isBase, isGrd, isRoof]) => {
      levels.push({
        id: `level-canon-${floorCode}`,
        floorCode,
        unitLabel: `Level ${floorCode}`,
        prototypeZ: protoZ,
        renderZ: rendZ,
        displayElevation: rendZ === 0 ? "±0.00 m" : `${rendZ < 0 ? "" : "+"}${rendZ.toFixed(2)} m`,
        isBasement: isBase,
        isGround: isGrd,
        isRooftop: isRoof,
      });
    });
  }

  return levels;
}

/**
 * Computes the anchor line vertices on the East architectural facade in EPSG:32644 coordinates.
 */
export function calculateElevationOverlayAnchors(
  building: Building | null
): { startX: number; startY: number; endX: number; endY: number } {
  let coords: number[][] = CANONICAL_OSM_COORDS;
  if (building?.footprint_2d?.geojson?.coordinates) {
    let current: any = building.footprint_2d.geojson.coordinates;
    while (Array.isArray(current) && current.length > 0 && Array.isArray(current[0]) && Array.isArray(current[0][0])) {
      current = current[0];
    }
    if (Array.isArray(current) && current.length >= 3 && Array.isArray(current[0]) && typeof current[0][0] === "number") {
      coords = current.map((p: any) => [Number(p[0]), Number(p[1])]);
    }
  }

  // Find East-most vertices
  let maxX = -Infinity;
  let sumY = 0;
  let countMax = 0;

  for (const pt of coords) {
    if (pt[0] > maxX) {
      maxX = pt[0];
    }
  }

  // Find average Y on the East edge
  for (const pt of coords) {
    if (Math.abs(pt[0] - maxX) < 3.0) {
      sumY += pt[1];
      countMax++;
    }
  }

  const startX = maxX;
  const startY = countMax > 0 ? sumY / countMax : (coords[0]?.[1] || 1933098.28);
  const extensionLength = 6.0; // 6 meters outward extension
  const endX = startX + extensionLength;
  const endY = startY;

  return { startX, startY, endX, endY };
}

/**
 * Generates Cesium visualization entity definitions for architectural vertical elevation levels.
 */
export function generateElevationOverlayEntities(
  units: VerticalUnit[],
  selectedUnit: VerticalUnit | null,
  building: Building | null,
  groundElevation: number = CANONICAL_VISUAL_GROUND_Z
): ElevationOverlayEntity[] {
  const entities: ElevationOverlayEntity[] = [];
  const levels = deriveElevationLevels(units, groundElevation);
  const { startX, startY, endX, endY } = calculateElevationOverlayAnchors(building);

  // Transform 2D horizontal start and end anchors to WGS84 [Lon, Lat]
  const [startLon, startLat] = transform32644ToWGS84(startX, startY);
  const [endLon, endLat] = transform32644ToWGS84(endX, endY);

  levels.forEach((level) => {
    const isSelected =
      selectedUnit?.floor_code === level.floorCode ||
      selectedUnit?.id === level.unit?.id ||
      (selectedUnit?.parent_unit_id && selectedUnit.parent_unit_id === level.unit?.id);
    const hasSelection = selectedUnit !== null;

    // Architectural color grading
    let lineColor: Cesium.Color;
    let labelColor: Cesium.Color;
    let lineWidth: number;

    if (isSelected) {
      // Golden Amber Emphasis for Selected Level
      lineColor = Cesium.Color.fromCssColorString("#fbbf24");
      labelColor = Cesium.Color.fromCssColorString("#fbbf24");
      lineWidth = 3.5;
    } else if (hasSelection) {
      // Subdued for non-selected levels when a floor is active
      lineColor = Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.4);
      labelColor = Cesium.Color.fromCssColorString("#cbd5e1").withAlpha(0.85);
      lineWidth = 1.8;
    } else {
      // Clean Architectural Lines in Building Overview
      if (level.isGround) {
        lineColor = Cesium.Color.fromCssColorString("#34d399").withAlpha(0.95);
        labelColor = Cesium.Color.fromCssColorString("#34d399");
      } else if (level.isBasement) {
        lineColor = Cesium.Color.fromCssColorString("#818cf8").withAlpha(0.9);
        labelColor = Cesium.Color.fromCssColorString("#a5b4fc");
      } else {
        lineColor = Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.85);
        labelColor = Cesium.Color.fromCssColorString("#f8fafc");
      }
      lineWidth = 2.5;
    }

    const posStart = Cesium.Cartesian3.fromDegrees(startLon, startLat, level.renderZ);
    const posEnd = Cesium.Cartesian3.fromDegrees(endLon, endLat, level.renderZ);

    // 1. Horizontal Architectural Guide Line
    entities.push({
      name: `Elevation Guide Line: ${level.floorCode} (${level.displayElevation})`,
      polyline: {
        positions: [posStart, posEnd],
        width: lineWidth,
        material: new Cesium.PolylineDashMaterialProperty({
          color: lineColor,
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: isSelected ? 16.0 : 12.0,
        }),
      },
      levelData: level,
    });

    // 2. Start Benchmark Point Tick touching floor slab
    entities.push({
      name: `Elevation Tick: ${level.floorCode}`,
      position: posStart,
      point: {
        pixelSize: isSelected ? 8 : 6,
        color: lineColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2.0,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      levelData: level,
    });

    // 3. End Benchmark Level Head & Elevation Text Label
    const labelText = `${level.floorCode.padEnd(4)}  ${level.displayElevation}`;

    entities.push({
      name: `Elevation Level Label: ${level.floorCode}`,
      position: posEnd,
      label: {
        text: labelText,
        font: isSelected
          ? "bold 14px Consolas, 'Segoe UI Mono', 'Courier New', monospace"
          : "bold 13px Consolas, 'Segoe UI Mono', 'Courier New', monospace",
        fillColor: labelColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2.0,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: isSelected
          ? Cesium.Color.fromCssColorString("rgba(15, 23, 42, 0.94)")
          : hasSelection
          ? Cesium.Color.fromCssColorString("rgba(15, 23, 42, 0.82)")
          : Cesium.Color.fromCssColorString("rgba(15, 23, 42, 0.88)"),
        backgroundPadding: new Cesium.Cartesian2(8, 4),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(12, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      levelData: level,
    });
  });

  return entities;
}
