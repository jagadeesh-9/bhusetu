/**
 * Phase 3.6A: Interactive 3D Sectional Cutaway & Orthogonal Clipping Utilities.
 * Pure computational and state management functions for spatial sectioning.
 */
import type { VerticalUnit, CutawayState } from "../types/cadastre";

export const DEFAULT_CUTAWAY_STATE: CutawayState = {
  enabled: false,
  xPlaneEnabled: false,
  xPosition: 0, // meters offset from center along East-West axis
  yPlaneEnabled: false,
  yPosition: 0, // meters offset from center along North-South axis
  zPlaneEnabled: false,
  zPosition: 12, // meters elevation cut
};

/**
 * Calculates the horizontal 2D centroid (EPSG:32644) of a vertical unit from its 3D geometry facets.
 */
export function calculateUnitCentroid(unit: VerticalUnit): { x: number; y: number } {
  const geomCoordinates = unit.geom_3d?.geojson?.coordinates;
  if (geomCoordinates && Array.isArray(geomCoordinates) && geomCoordinates.length > 0) {
    try {
      const firstFacet = geomCoordinates[0];
      const ring = Array.isArray(firstFacet) && Array.isArray(firstFacet[0]) ? firstFacet[0] : firstFacet;
      if (Array.isArray(ring) && ring.length >= 3) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (const pt of ring) {
          if (Array.isArray(pt) && pt.length >= 2) {
            sumX += Number(pt[0]);
            sumY += Number(pt[1]);
            count++;
          }
        }
        if (count > 0) {
          return { x: sumX / count, y: sumY / count };
        }
      }
    } catch (e) {
      // fallback
    }
  }
  // Default TOWER-A center in EPSG:32644 (X: 219415.0, Y: 1932510.0)
  return { x: 219415.0, y: 1932510.0 };
}

/**
 * Determines whether a vertical unit solid is clipped by the active orthogonal cutaway planes.
 * 
 * @param unit The vertical unit candidate
 * @param cutaway The active cutaway configuration
 * @param centerAnchor Reference anchor point in EPSG:32644 (defaults to building center)
 * @returns true if the unit lies on the clipped side of an active plane and should be cut from view.
 */
export function isUnitClippedByCutaway(
  unit: VerticalUnit,
  cutaway: CutawayState,
  centerAnchor: { x: number; y: number } = { x: 219415.0, y: 1932510.0 }
): boolean {
  if (!cutaway.enabled) {
    return false;
  }

  // 1. Z-Plane (Elevation / Floor Stratification Cut)
  // When active, clips units strictly above the cut elevation
  if (cutaway.zPlaneEnabled) {
    if (unit.z_min >= cutaway.zPosition) {
      return true;
    }
  }

  // 2. X-Plane (East-West Sectional Cut)
  // When active, clips units located east of the cut plane (x > centerAnchor.x + xPosition)
  if (cutaway.xPlaneEnabled) {
    const centroid = calculateUnitCentroid(unit);
    const cutBoundaryX = centerAnchor.x + cutaway.xPosition;
    if (centroid.x > cutBoundaryX) {
      return true;
    }
  }

  // 3. Y-Plane (North-South Sectional Cut)
  // When active, clips units located north of the cut plane (y > centerAnchor.y + yPosition)
  if (cutaway.yPlaneEnabled) {
    const centroid = calculateUnitCentroid(unit);
    const cutBoundaryY = centerAnchor.y + cutaway.yPosition;
    if (centroid.y > cutBoundaryY) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a reset cutaway state.
 */
export function resetCutawayState(): CutawayState {
  return { ...DEFAULT_CUTAWAY_STATE };
}

/**
 * Toggles an individual orthogonal clipping plane.
 */
export function toggleCutawayPlane(
  current: CutawayState,
  plane: "x" | "y" | "z"
): CutawayState {
  if (plane === "x") {
    return { ...current, xPlaneEnabled: !current.xPlaneEnabled };
  }
  if (plane === "y") {
    return { ...current, yPlaneEnabled: !current.yPlaneEnabled };
  }
  if (plane === "z") {
    return { ...current, zPlaneEnabled: !current.zPlaneEnabled };
  }
  return current;
}

/**
 * Updates the cut position for an individual orthogonal clipping plane.
 */
export function updateCutawayPosition(
  current: CutawayState,
  plane: "x" | "y" | "z",
  value: number
): CutawayState {
  if (plane === "x") {
    return { ...current, xPosition: value };
  }
  if (plane === "y") {
    return { ...current, yPosition: value };
  }
  if (plane === "z") {
    return { ...current, zPosition: value };
  }
  return current;
}
