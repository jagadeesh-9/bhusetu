import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Parcel, Building, VerticalUnit, LayerVisibility, MeasuredPoint, LocationSearchResult, BuildingCandidate } from "../types/cadastre";
import {
  transform2DCoordinates,
  transformWGS84To32644,
  CANONICAL_VISUAL_GROUND_Z,
  prototypeZToViewerHeight,
  viewerHeightToPrototypeZ,
  resolveBuildingGroundZ,
} from "../utils/coordinateTransform";
import { isUnitClippedByCutaway } from "../utils/cutawayUtils";
import {
  generateArchitecturalDetails,
  getUnitArchitecturalColor,
  extractRingCoords,
} from "../utils/architecturalDetails";
import { generateElevationOverlayEntities } from "../utils/elevationOverlay";
import { CesiumCompass } from "./CesiumCompass";
import {
  computeCameraSpatialContext,
  shouldUpdateCameraSpatialHUD,
  type CameraSpatialContext,
} from "../utils/measurementUtils";

interface CesiumViewerProps {
  parcel: Parcel | null;
  building: Building | null;
  units: VerticalUnit[];
  subUnitsMap?: Record<string, VerticalUnit[]>;
  expandedFloorIds?: Set<string>;
  selectedUnit: VerticalUnit | null;
  onSelectUnit: (unit: VerticalUnit) => void;
  layers: LayerVisibility;
  isolatedUnitId: string | null;
  is2DView: boolean;
  cameraTrigger: number;
  onAddMeasurementPoint?: (point: MeasuredPoint) => void;
  searchedLocation?: LocationSearchResult | null;
  buildingCandidates?: BuildingCandidate[];
  selectedBuildingCandidate?: BuildingCandidate | null;
  onSelectBuildingCandidate?: (candidate: BuildingCandidate) => void;
}

// Canonical OSM Way 356027047 geometry in EPSG:32644
const CANONICAL_OSM_COORDS: number[][] = [
  [219986.82, 1933088.62],
  [219985.71, 1933104.81],
  [220009.01, 1933106.37],
  [220010.12, 1933090.19],
  [219986.82, 1933088.62],
];

const CANONICAL_BUILDING_CENTER_EPSG32644 = {
  easting: 219997.91,
  northing: 1933097.50,
};

export const CesiumViewer: React.FC<CesiumViewerProps> = ({
  parcel,
  building,
  units,
  subUnitsMap,
  expandedFloorIds,
  selectedUnit,
  onSelectUnit,
  layers,
  isolatedUnitId,
  is2DView,
  cameraTrigger,
  onAddMeasurementPoint,
  searchedLocation,
  buildingCandidates = [],
  selectedBuildingCandidate,
  onSelectBuildingCandidate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesRef = useRef<{ [key: string]: Cesium.Entity }>({});
  const unitEntitiesRef = useRef<Cesium.Entity[]>([]);
  const measurementEntitiesRef = useRef<Cesium.Entity[]>([]);
  const locationMarkerEntityRef = useRef<Cesium.Entity | null>(null);
  const candidateEntitiesRef = useRef<Cesium.Entity[]>([]);
  const [viewCoords, setViewCoords] = useState<MeasuredPoint | null>(null);
  const lastCameraContextRef = useRef<CameraSpatialContext | null>(null);
  const [viewerInstance, setViewerInstance] = useState<Cesium.Viewer | null>(null);
  const lastFlyLocationRef = useRef<string | null>(null);
  const layersRef = useRef<LayerVisibility>(layers);
  layersRef.current = layers;

  const onSelectUnitRef = useRef(onSelectUnit);
  onSelectUnitRef.current = onSelectUnit;
  const onAddMeasurementPointRef = useRef(onAddMeasurementPoint);
  onAddMeasurementPointRef.current = onAddMeasurementPoint;
  const onSelectBuildingCandidateRef = useRef(onSelectBuildingCandidate);
  onSelectBuildingCandidateRef.current = onSelectBuildingCandidate;

  // Active authoritative ground datum reference for mouse hover tracking
  const currentGroundElevationRef = useRef<number>(CANONICAL_VISUAL_GROUND_Z);

  // Helper to compute exact 3D building centroid in WGS84 Cartesian coordinates
  const getBuildingCenterCartesian = useCallback(
    (heightOffset: number = 10.75): Cesium.Cartesian3 => {
      if (selectedBuildingCandidate?.centroid) {
        return Cesium.Cartesian3.fromDegrees(
          selectedBuildingCandidate.centroid.longitude,
          selectedBuildingCandidate.centroid.latitude,
          heightOffset
        );
      }
      if (
        selectedBuildingCandidate?.footprintCoordinates &&
        selectedBuildingCandidate.footprintCoordinates.length >= 3
      ) {
        const lons = selectedBuildingCandidate.footprintCoordinates.map((c) => c[0]);
        const lats = selectedBuildingCandidate.footprintCoordinates.map((c) => c[1]);
        const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        return Cesium.Cartesian3.fromDegrees(centerLon, centerLat, heightOffset);
      }
      const footprint =
        building?.footprint_2d?.geojson?.coordinates?.[0] ||
        CANONICAL_OSM_COORDS;
      const wgs84Coords = transform2DCoordinates(footprint);
      const lons = wgs84Coords.map((c) => c[0]);
      const lats = wgs84Coords.map((c) => c[1]);
      const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      return Cesium.Cartesian3.fromDegrees(centerLon, centerLat, heightOffset);
    },
    [building, selectedBuildingCandidate]
  );

  // 1. Initialize Cesium Viewer once with Native 360° Orbit Controller
  useEffect(() => {
    if (!containerRef.current) return;

    // Build standalone Cesium Viewer without Ion access token requirements
    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayer: (() => {
        const lyr = new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maximumLevel: 19,
          })
        );
        lyr.brightness = 0.82;
        lyr.contrast = 1.08;
        lyr.saturation = 0.50;
        return lyr;
      })(),
    });

    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = true;

    // Configure ScreenSpaceCameraController for Stable 360° Orbit
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = true;
    controller.enableTranslate = false; // Prevents camera from translating away from the building
    controller.enableZoom = true;
    controller.enableTilt = true;
    controller.enableLook = false;
    controller.minimumZoomDistance = 8.0; // Prevent camera from zooming through the building core
    controller.maximumZoomDistance = 250.0; // Keep in neighborhood context
    controller.inertiaSpin = 0.08;
    controller.inertiaZoom = 0.08;

    // Initial 360° Orbit Anchor on canonical Hyderabad building centroid (78.363627°E, 17.466502°N)
    const initialTarget = Cesium.Cartesian3.fromDegrees(78.3636273, 17.4665019, 10.75);
    viewer.camera.lookAt(
      initialTarget,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(0), // Front south elevation
        Cesium.Math.toRadians(-26), // Clean architectural oblique angle
        38.0 // Optimal range: building prominently frames ~65% of viewport
      )
    );

    viewerRef.current = viewer;
    setViewerInstance(viewer);

    // Interaction handler for picking and mouse tracking
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Left click: 3D point measurement or unit selection
    handler.setInputAction((movement: any) => {
      const currentLayers = layersRef.current;
      if (currentLayers?.measurement && currentLayers.measurement.mode !== "OFF") {
        // Measurement Point Picking
        let cartesian: Cesium.Cartesian3 | undefined = viewer.scene.pickPosition(movement.position);
        if (!Cesium.defined(cartesian) || isNaN(cartesian!.x)) {
          cartesian = viewer.camera.pickEllipsoid(
            movement.position,
            viewer.scene.globe.ellipsoid
          ) || undefined;
        }
        if (Cesium.defined(cartesian) && cartesian && !isNaN(cartesian.x)) {
          try {
            const carto = Cesium.Cartographic.fromCartesian(cartesian);
            if (carto) {
              const lon = Cesium.Math.toDegrees(carto.longitude);
              const lat = Cesium.Math.toDegrees(carto.latitude);
              const rawViewerHeight = carto.height;
              const prototypeElevation = viewerHeightToPrototypeZ(rawViewerHeight, currentGroundElevationRef.current);
              const [easting, northing] = transformWGS84To32644(lon, lat, prototypeElevation);
              const point: MeasuredPoint = {
                easting: Number(easting.toFixed(2)),
                northing: Number(northing.toFixed(2)),
                elevation: Number(prototypeElevation.toFixed(2)),
                longitude: Number(lon.toFixed(6)),
                latitude: Number(lat.toFixed(6)),
              };
              if (onAddMeasurementPointRef.current) {
                onAddMeasurementPointRef.current(point);
              }
            }
          } catch {
            // position resolution fallback
          }
        }
      } else {
        // Standard Unit Selection or Building Candidate Selection
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          if (pickedObject.id.buildingCandidate && onSelectBuildingCandidateRef.current) {
            onSelectBuildingCandidateRef.current(pickedObject.id.buildingCandidate);
          } else if (pickedObject.id.unitData && onSelectUnitRef.current) {
            onSelectUnitRef.current(pickedObject.id.unitData);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Camera view coordinate tracking for Spatial Interrogation HUD (Phase 3.6B)
    const updateCameraViewCoords = () => {
      try {
        if (!viewer || viewer.isDestroyed() || !viewer.camera) return;
        const newContext = computeCameraSpatialContext(viewer.camera, currentGroundElevationRef.current);
        if (!newContext) return;

        if (shouldUpdateCameraSpatialHUD(lastCameraContextRef.current, newContext)) {
          lastCameraContextRef.current = newContext;
          setViewCoords({
            easting: newContext.easting,
            northing: newContext.northing,
            elevation: newContext.elevation,
            longitude: newContext.longitude,
            latitude: newContext.latitude,
          });
        }
      } catch {
        // Safeguard during teardown
      }
    };

    if (viewer.camera) {
      viewer.camera.percentageChanged = 0.001;
      viewer.camera.changed.addEventListener(updateCameraViewCoords);
    }
    if (viewer.scene?.postRender) {
      viewer.scene.postRender.addEventListener(updateCameraViewCoords);
    }

    // Initial camera coordinates read
    updateCameraViewCoords();

    return () => {
      try {
        if (!viewer.isDestroyed()) {
          if (viewer.camera) {
            viewer.camera.changed.removeEventListener(updateCameraViewCoords);
          }
          if (viewer.scene?.postRender) {
            viewer.scene.postRender.removeEventListener(updateCameraViewCoords);
          }
        }
      } catch {
        // Safeguard during teardown
      }
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      setViewerInstance(null);
    };
  }, []);

  // 2. Handle 2D vs 3D Perspective Toggle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (is2DView) {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.scene.screenSpaceCameraController.enableTranslate = true;
      viewer.scene.morphTo2D(1.0);
    } else {
      viewer.scene.morphTo3D(1.0);
      viewer.scene.screenSpaceCameraController.enableTranslate = false;
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      const target = getBuildingCenterCartesian(10.75);
      viewer.camera.lookAt(
        target,
        new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-26), 38.0)
      );
    }
  }, [is2DView, getBuildingCenterCartesian]);

  // 3. Handle Underground Translucency Mode (automatically activated when inspecting basement)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const isSubterraneanSelected = selectedUnit?.tier_code === "SB" || selectedUnit?.floor_code === "B01" || selectedUnit?.tier_code === "UT";

    if (layers.undergroundMode || isSubterraneanSelected) {
      viewer.scene.globe.translucency.enabled = true;
      viewer.scene.globe.translucency.frontFaceAlpha = 0.35;
      viewer.scene.globe.translucency.backFaceAlpha = 0.35;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
    } else {
      viewer.scene.globe.translucency.enabled = false;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    }
  }, [layers.undergroundMode, selectedUnit?.id, selectedUnit?.tier_code, selectedUnit?.floor_code]);

  // 4. Render Layers and 3D Units with Local Ground Reference (Z=0 at Ground)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !parcel) return;

    // Clear only previously rendered unit and layer entities (never clear search pins or candidate footprints)
    unitEntitiesRef.current.forEach((ent) => {
      viewer.entities.remove(ent);
    });
    unitEntitiesRef.current = [];
    entitiesRef.current = {};

    const groundElevation = resolveBuildingGroundZ(units, selectedBuildingCandidate);
    currentGroundElevationRef.current = groundElevation;

    // --- Layer A: Parent Parcel (2D Cadastral Boundary aligned on Ground Plane) ---
    if (layers.parcel && parcel.geom_2d?.geojson?.coordinates) {
      const rawCoords = parcel.geom_2d.geojson.coordinates[0];
      const wgs84Coords = transform2DCoordinates(rawCoords);
      const hierarchy = Cesium.Cartesian3.fromDegreesArray(
        wgs84Coords.flat()
      );

      const parcelEnt = viewer.entities.add({
        name: `Cadastral Parcel: ${parcel.ulpin_2d}`,
        description: `2D Cadastral Property Boundary for Survey Number ${parcel.survey_number}`,
        polygon: {
          hierarchy,
          material: Cesium.Color.fromCssColorString("#7FA9A5").withAlpha(0.12),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#7FA9A5"),
          outlineWidth: 2.5,
          height: 0.0, // Ground reference elevation plane
        },
      });
      unitEntitiesRef.current.push(parcelEnt);
    }

    // --- Layer B: OSM Reference Building Footprint (Exact OpenStreetMap Polygon underneath building) ---
    const footprintCoords = building?.footprint_2d?.geojson?.coordinates?.[0] || CANONICAL_OSM_COORDS;
    const wgs84Footprint = transform2DCoordinates(footprintCoords);
    const osmHierarchy = Cesium.Cartesian3.fromDegreesArray(wgs84Footprint.flat());

    const osmEnt = viewer.entities.add({
      name: "OSM Reference Building Footprint",
      description: "OpenStreetMap Way 356027047 geographic reference footprint. (Not a legal/cadastral ownership boundary).",
      polygon: {
        hierarchy: osmHierarchy,
        material: Cesium.Color.fromCssColorString("#123F46").withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#6EA5A8").withAlpha(0.85),
        outlineWidth: 1.5,
        height: 0.04, // Sits directly on ground plane under 3D building
      },
    });
    unitEntitiesRef.current.push(osmEnt);

    // --- Layer C: Building Envelope / Footprint Subordinate Analysis Geometry (independent toggle) ---
    if (layers.building && building && building.footprint_2d?.geojson?.coordinates) {
      const bldgCoords = building.footprint_2d.geojson.coordinates[0];
      const wgs84Bldg = transform2DCoordinates(bldgCoords);
      const hierarchy = Cesium.Cartesian3.fromDegreesArray(wgs84Bldg.flat());
      const envelopeMinZ = units.length > 0 ? Math.min(...units.map((u) => u.z_min)) : groundElevation;
      const envelopeMaxZ = units.length > 0 ? Math.max(...units.map((u) => u.z_max)) : groundElevation + (building.building_code?.startsWith("APARTMENT-SURYA") ? 21.5 : 9.5);
      const envelopeRenderMin = prototypeZToViewerHeight(envelopeMinZ, groundElevation);
      const envelopeRenderMax = prototypeZToViewerHeight(envelopeMaxZ, groundElevation);

      const bldgEnt = viewer.entities.add({
        name: `Building Envelope: ${building.building_code}`,
        description: "Subordinate volumetric envelope bounding volume for spatial analysis.",
        polygon: {
          hierarchy,
          material: Cesium.Color.fromCssColorString("#1B5961").withAlpha(0.12),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#6EA5A8").withAlpha(0.7),
          outlineWidth: 1.5,
          height: envelopeRenderMin,
          extrudedHeight: envelopeRenderMax,
        },
      });
      unitEntitiesRef.current.push(bldgEnt);
    }

    // --- Layer D: 3D Vertical Units (PolyhedralSurface Solids) ---
    const renderUnitSolid = (u: VerticalUnit, parentStorey?: VerticalUnit) => {
      // Visibility Filtering
      if (isolatedUnitId && u.id !== isolatedUnitId && parentStorey?.id !== isolatedUnitId) return;

      // Lifecycle status filtering
      if (u.status === "VERIFIED" && !layers.showVerified) return;
      if (u.status === "UNDER_REVIEW" && !layers.showUnderReview) return;
      if (u.status === "PROPOSED" && !layers.showProposed) return;
      if (u.status === "REJECTED" && !layers.showRejected) return;

      // Vertical Slice Filtering (Phase 3.2)
      if (layers.sliceMode) {
        if (u.z_max <= layers.sliceMinZ || u.z_min >= layers.sliceMaxZ) {
          return;
        }
      }

      // Phase 3.6A: Interactive Sectional Cutaway / Orthogonal Clipping
      if (layers.cutaway?.enabled && isUnitClippedByCutaway(u, layers.cutaway, { x: CANONICAL_BUILDING_CENTER_EPSG32644.easting, y: CANONICAL_BUILDING_CENTER_EPSG32644.northing })) {
        return;
      }

      const isGround = u.floor_code === "F00" || u.floor_code === "P00" || u.floor_code === "GF" || (u.tier_code === "F" && u.unit_type === "PARKING");
      const isUpper = u.tier_code === "F" && !isGround;
      const isRooftopElevated = u.tier_code === "AR" || u.tier_code === "AE";
      const isCommon = u.tier_code === "CM" || u.unit_level === "COMMON_CIRCULATION";

      if (u.tier_code === "UT" && !layers.utilities) return;
      if (u.tier_code === "SB" && !layers.basements) return;
      if (isGround && !layers.groundFloors) return;
      if (isUpper && !layers.upperFloors) return;
      if (isRooftopElevated && !layers.rooftopElevated) return;
      if (isCommon && !layers.commonCirculation) return;

      const isSelected = selectedUnit?.id === u.id;
      const hasSelection = selectedUnit !== null;
      const materialColor = getUnitArchitecturalColor(u, selectedUnit);

      // Extract footprint polygon coordinates from unit's 3D geometry facets, or building footprint
      let unitPolygonCoords = extractRingCoords(u.geom_3d?.geojson?.coordinates);
      if (unitPolygonCoords.length < 3) {
        if (building?.footprint_2d?.geojson?.coordinates) {
          unitPolygonCoords = building.footprint_2d.geojson.coordinates[0];
        } else {
          unitPolygonCoords = CANONICAL_OSM_COORDS;
        }
      }

      const wgs84Floor = transform2DCoordinates(unitPolygonCoords);
      if (!wgs84Floor || wgs84Floor.length < 3) {
        return;
      }
      const flatDegrees = wgs84Floor.flat();
      if (flatDegrees.length < 6 || flatDegrees.some((v) => typeof v !== "number" || isNaN(v))) {
        return;
      }

      try {
        const hierarchy = Cesium.Cartesian3.fromDegreesArray(flatDegrees);

        // Transform stored prototype Z values into grounded rendering relative heights
        const rawRenderZMin = prototypeZToViewerHeight(u.z_min, groundElevation);
        const isFlat = u.unit_level === "FLAT" || !!u.flat_number;
        // Elevate flat volumes above inter-floor structural slab (0.18m) to eliminate Z-fighting
        const renderZMin = isFlat ? rawRenderZMin + 0.18 : rawRenderZMin;
        const renderZMax = prototypeZToViewerHeight(u.z_max, groundElevation);

        const bldgCode = building?.building_code || "BLDG";
        const unitEntityId = u.id
          ? `unit:${u.id}`
          : u.flat_number
          ? `building:${bldgCode}:floor:${u.floor_code}:flat:${u.flat_number}`
          : `building:${bldgCode}:floor:${u.floor_code}`;

        // Solid unit volume with deterministic Cesium ID (safely replace if already exists)
        if (viewer.entities.getById(unitEntityId)) {
          viewer.entities.removeById(unitEntityId);
        }
        const entity = viewer.entities.add({
          id: unitEntityId,
          name: `Unit ${u.flat_number ? `Flat ${u.flat_number}` : u.floor_code} (${u.prototype_ulpin_3d})`,
          polygon: {
            hierarchy,
            height: renderZMin,
            extrudedHeight: renderZMax,
            material: materialColor,
            outline: true,
            outlineColor: isSelected
              ? Cesium.Color.fromCssColorString("#E0A93C")
              : Cesium.Color.fromCssColorString("#64748B").withAlpha(hasSelection ? 0.35 : 0.65),
            outlineWidth: isSelected ? 3 : 1.5,
          },
        });
        unitEntitiesRef.current.push(entity);

        // Non-destructive Wireframe Overlay: Add crisp wireframe edge cages alongside solid volume
        if (layers.wireframeMode) {
          const closedWgs84Floor = [...wgs84Floor, wgs84Floor[0]];
          const floorPositionsBottom = Cesium.Cartesian3.fromDegreesArrayHeights(
            closedWgs84Floor.flatMap(pt => [pt[0], pt[1], renderZMin])
          );
          const floorPositionsTop = Cesium.Cartesian3.fromDegreesArrayHeights(
            closedWgs84Floor.flatMap(pt => [pt[0], pt[1], renderZMax])
          );

          const wfBottomId = `${unitEntityId}:wf:bottom`;
          if (viewer.entities.getById(wfBottomId)) {
            viewer.entities.removeById(wfBottomId);
          }
          const wfBottom = viewer.entities.add({
            id: wfBottomId,
            name: `Wireframe Bottom: ${u.flat_number || u.floor_code}`,
            polyline: {
              positions: floorPositionsBottom,
              width: 1.5,
              material: isSelected ? Cesium.Color.fromCssColorString("#E0A93C").withAlpha(0.85) : Cesium.Color.fromCssColorString("#7A8B9E").withAlpha(0.60),
              clampToGround: false,
            },
          });
          unitEntitiesRef.current.push(wfBottom);

          const wfTopId = `${unitEntityId}:wf:top`;
          if (viewer.entities.getById(wfTopId)) {
            viewer.entities.removeById(wfTopId);
          }
          const wfTop = viewer.entities.add({
            id: wfTopId,
            name: `Wireframe Top: ${u.flat_number || u.floor_code}`,
            polyline: {
              positions: floorPositionsTop,
              width: 1.5,
              material: isSelected ? Cesium.Color.fromCssColorString("#E0A93C").withAlpha(0.85) : Cesium.Color.fromCssColorString("#7A8B9E").withAlpha(0.60),
              clampToGround: false,
            },
          });
          unitEntitiesRef.current.push(wfTop);
        }

        // Attach custom unit data for picking
        (entity as any).unitData = u;
        entitiesRef.current[u.id] = entity;
      } catch (renderErr) {
        console.warn("Failed to render solid unit entity:", u.id, renderErr);
      }
    };

    units.forEach((unit) => {
      const subUnits = subUnitsMap?.[unit.id] || unit.sub_units || [];
      const hasSubUnits = subUnits.length > 0;

      if (hasSubUnits) {
        // Render individual flat sub-units (Flats 101-104 + Common Core) for this residential storey
        subUnits.forEach((sub) => renderUnitSolid(sub, unit));
      } else {
        // Render monolithic storey unit (e.g. B01 Basement, F00 Stilt, RF01 Rooftop)
        renderUnitSolid(unit);
      }
    });

    // --- Layer E: Parametric Architectural Details (Walls, Partitions, Corridors, Core, Slabs, Stilt, Rooftop) ---
    try {
      const archDetails = generateArchitecturalDetails(building, units, selectedUnit, groundElevation, subUnitsMap);
      archDetails.forEach((arch) => {
        try {
          if (arch.polygon) {
            const archEntity = viewer.entities.add({
              id: arch.id,
              name: arch.name,
              polygon: arch.polygon,
            });
            if (arch.unitData) {
              (archEntity as any).unitData = arch.unitData;
            }
            unitEntitiesRef.current.push(archEntity);
          } else if (arch.polyline) {
            const archEntity = viewer.entities.add({
              id: arch.id,
              name: arch.name,
              polyline: arch.polyline,
            });
            if (arch.unitData) {
              (archEntity as any).unitData = arch.unitData;
            }
            unitEntitiesRef.current.push(archEntity);
          }
        } catch {
          // Skip invalid individual architectural entity
        }
      });
    } catch (archErr) {
      console.warn("Failed to generate architectural details:", archErr);
    }

    // --- Layer F: Phase 3.7R Architectural Vertical Elevation Level Overlay ---
    if (layers.elevationLevels) {
      const elevationEntities = generateElevationOverlayEntities(
        units,
        selectedUnit,
        building,
        groundElevation
      );
      elevationEntities.forEach((ent) => {
        if (ent.polyline) {
          const elevEnt = viewer.entities.add({
            name: ent.name,
            polyline: ent.polyline,
          });
          unitEntitiesRef.current.push(elevEnt);
        } else if (ent.point && ent.position) {
          const elevEnt = viewer.entities.add({
            name: ent.name,
            position: ent.position,
            point: ent.point,
          });
          unitEntitiesRef.current.push(elevEnt);
        } else if (ent.label && ent.position) {
          const elevEnt = viewer.entities.add({
            name: ent.name,
            position: ent.position,
            label: ent.label,
          });
          unitEntitiesRef.current.push(elevEnt);
        }
      });
    }
  }, [
    parcel,
    building,
    units,
    subUnitsMap,
    expandedFloorIds,
    selectedUnit,
    layers,
    isolatedUnitId,
  ]);

  // 5. One-Time Camera Orbit Framing on initial load / floor selection / Frame Building trigger
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || (!parcel && !selectedBuildingCandidate)) return;

    const groundElevation = resolveBuildingGroundZ(units, selectedBuildingCandidate);

    // Critical: Always unlock/reset camera transform matrix to world frame before applying lookAt
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    if (selectedUnit) {
      const isBasement = selectedUnit.tier_code === "SB" || selectedUnit.floor_code === "B01";
      const unitMidZ = (selectedUnit.z_min + selectedUnit.z_max) / 2;
      const unitRenderHeight = prototypeZToViewerHeight(unitMidZ, groundElevation);

      // Preserve current user orbit heading so camera does NOT snap back unexpectedly
      const currentHeading = viewer.camera.heading || 0;

      if (isBasement) {
        const target = getBuildingCenterCartesian(unitRenderHeight);
        viewer.camera.lookAt(
          target,
          new Cesium.HeadingPitchRange(
            currentHeading,
            Cesium.Math.toRadians(-20),
            32.0
          )
        );
      } else {
        const target = getBuildingCenterCartesian(unitRenderHeight);
        viewer.camera.lookAt(
          target,
          new Cesium.HeadingPitchRange(
            currentHeading,
            Cesium.Math.toRadians(-24),
            32.0
          )
        );
      }
    } else {
      // Default Building Overview framing (re-centers building with 0° front heading on reset/trigger)
      const buildingHalfHeight = units.length > 0
        ? (Math.max(...units.map((u) => u.z_max)) - groundElevation) / 2
        : 10.75;
      const target = getBuildingCenterCartesian(buildingHalfHeight > 0 ? buildingHalfHeight : 10.75);
      viewer.camera.lookAt(
        target,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-26),
          38.0
        )
      );
    }
  }, [parcel?.id, building?.id, selectedBuildingCandidate?.id, selectedUnit?.id, cameraTrigger, getBuildingCenterCartesian]);

  // 5B. Handle Searched Location Navigation & Pin Marker (Phase 3.11)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear previous search pin entity
    if (locationMarkerEntityRef.current) {
      viewer.entities.remove(locationMarkerEntityRef.current);
      locationMarkerEntityRef.current = null;
    }

    if (!searchedLocation) return;

    // Check if 3D model is active or available for this location/building
    const has3DModel = !!(
      building !== null ||
      units.length > 0 ||
      selectedBuildingCandidate?.modelAvailable ||
      searchedLocation.modelAvailable
    );

    const position = Cesium.Cartesian3.fromDegrees(
      searchedLocation.longitude,
      searchedLocation.latitude,
      0.5
    );

    const marker = viewer.entities.add({
      id: "searched_location_pin",
      name: `Searched Location: ${searchedLocation.displayName}`,
      position,
      point: {
        pixelSize: 12,
        color: has3DModel
          ? Cesium.Color.fromCssColorString("#34d399")
          : Cesium.Color.fromCssColorString("#38bdf8"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: has3DModel
          ? `📍 ${searchedLocation.displayName.split(",")[0]}\n[3D Prototype Available]\n(Synthetic Research Model)`
          : `📍 ${searchedLocation.displayName.split(",")[0]}\n[3D Model Not Available]`,
        font: "11px Inter, sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: has3DModel
          ? Cesium.Color.fromCssColorString("#34d399")
          : Cesium.Color.fromCssColorString("#38bdf8"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        backgroundColor: Cesium.Color.fromCssColorString("#0f172a").withAlpha(0.85),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(6, 4),
      },
    });

    locationMarkerEntityRef.current = marker;

    // Unlock camera matrix and fly smoothly to the searched location only once per location search
    if (lastFlyLocationRef.current !== searchedLocation.id) {
      lastFlyLocationRef.current = searchedLocation.id;
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          searchedLocation.longitude,
          searchedLocation.latitude - 0.0006,
          85.0
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0,
        },
        duration: 1.8,
      });
    }
  }, [searchedLocation, building?.id, units.length, selectedBuildingCandidate?.modelAvailable]);

  // 5C. Handle Discovered Building Candidate Overlays (Phase 3.11B)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear previous candidate footprint entities
    candidateEntitiesRef.current.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    candidateEntitiesRef.current = [];

    if (!buildingCandidates || buildingCandidates.length === 0) return;

    buildingCandidates.forEach((candidate) => {
      if (!candidate.footprintCoordinates || candidate.footprintCoordinates.length < 3) return;

      const isSelected = selectedBuildingCandidate?.id === candidate.id;
      const hierarchy = Cesium.Cartesian3.fromDegreesArray(
        candidate.footprintCoordinates.flat()
      );

      const entity = viewer.entities.add({
        name: `OSM Reference Building: ${candidate.name || candidate.osmId}`,
        description: `OpenStreetMap building footprint candidate (Area: ~${candidate.approxAreaSqm} m², Distance: ${candidate.distanceMeters}m). Not a legal cadastral boundary.`,
        polygon: {
          hierarchy,
          material: isSelected
            ? Cesium.Color.fromCssColorString("#E0A93C").withAlpha(0.40)
            : Cesium.Color.fromCssColorString("#8B5CF6").withAlpha(0.20),
          outline: true,
          outlineColor: isSelected
            ? Cesium.Color.fromCssColorString("#E0A93C")
            : Cesium.Color.fromCssColorString("#8B5CF6").withAlpha(0.85),
          outlineWidth: isSelected ? 2.5 : 1.5,
          height: 0.08, // Slightly above ground plane for crisp rendering
        },
      });

      (entity as any).buildingCandidate = candidate;
      candidateEntitiesRef.current.push(entity);
    });
  }, [buildingCandidates, selectedBuildingCandidate]);

  // 6. Handle Temporary 3D Measurement Graphics (Phase 3.6B)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear previous temporary measurement entities
    measurementEntitiesRef.current.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    measurementEntitiesRef.current = [];

    const measurement = layers.measurement;
    if (!measurement || measurement.mode === "OFF") {
      return;
    }

    const { pointA, pointB, result, mode } = measurement;
    const groundElevation = resolveBuildingGroundZ(units, selectedBuildingCandidate);

    // Render Point A marker
    let posA: Cesium.Cartesian3 | null = null;
    if (pointA) {
      const renderHeightA = prototypeZToViewerHeight(pointA.elevation, groundElevation);
      posA = Cesium.Cartesian3.fromDegrees(
        pointA.longitude,
        pointA.latitude,
        renderHeightA
      );

      const entA = viewer.entities.add({
        name: "Measurement Point A",
        position: posA,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#f59e0b"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `Point A (Z: ${pointA.elevation.toFixed(1)}m)`,
          font: "11px monospace",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      measurementEntitiesRef.current.push(entA);
    }

    // Render Point B marker
    let posB: Cesium.Cartesian3 | null = null;
    if (pointB) {
      const renderHeightB = prototypeZToViewerHeight(pointB.elevation, groundElevation);
      posB = Cesium.Cartesian3.fromDegrees(
        pointB.longitude,
        pointB.latitude,
        renderHeightB
      );

      const entB = viewer.entities.add({
        name: "Measurement Point B",
        position: posB,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#06b6d4"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `Point B (Z: ${pointB.elevation.toFixed(1)}m)`,
          font: "11px monospace",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      measurementEntitiesRef.current.push(entB);
    }

    // Render Measurement Vector Line and Midpoint Label
    if (posA && posB && result) {
      const midpoint = Cesium.Cartesian3.midpoint(
        posA,
        posB,
        new Cesium.Cartesian3()
      );

      let labelText = `3D: ${result.distance3D} m`;
      if (mode === "DISTANCE_HORIZONTAL") {
        labelText = `Horiz: ${result.horizontalDistance} m`;
      } else if (mode === "DELTA_Z") {
        labelText = `ΔZ: ${result.deltaZ} m`;
      }

      const lineEnt = viewer.entities.add({
        name: "Measurement Vector",
        polyline: {
          positions: [posA, posB],
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString("#fbbf24"),
            gapColor: Cesium.Color.TRANSPARENT,
            dashLength: 12.0,
          }),
        },
      });
      measurementEntitiesRef.current.push(lineEnt);

      const labelEnt = viewer.entities.add({
        name: "Measurement Label",
        position: midpoint,
        label: {
          text: labelText,
          font: "12px monospace",
          fillColor: Cesium.Color.fromCssColorString("#fbbf24"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      measurementEntitiesRef.current.push(labelEnt);
    }
  }, [layers.measurement]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} className="cesium-viewport-container" style={{ width: "100%", height: "100%" }} />

      {/* Floating Coordinate HUD (Phase 3.6B) - Styled in Midnight Navy */}
      {viewCoords && (layers.coordHUD?.enabled ?? true) && (
        <div
          data-testid="spatial-interrogation-hud"
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            background: "#162F6A", // Dominant Midnight Navy
            border: "1px solid rgba(220, 227, 242, 0.2)",
            borderRadius: "4px",
            padding: "8px 12px",
            color: "#FFFFFF",
            fontSize: "10.5px",
            fontFamily: "var(--font-mono, monospace)",
            zIndex: 10,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ color: "#E0A93C", fontWeight: 700, letterSpacing: "0.06em", display: "flex", justifyContent: "space-between", gap: "16px", textTransform: "uppercase", fontSize: "10px" }}>
            <span>SPATIAL INTERROGATION HUD</span>
            <span style={{ color: "#94A3B8", fontWeight: 500 }}>CRS: EPSG:32644</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <span style={{ color: "#94A3B8" }}>EASTING: </span>
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{viewCoords.easting.toFixed(2)} m</span>
            </div>
            <div>
              <span style={{ color: "#94A3B8" }}>NORTHING: </span>
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{viewCoords.northing.toFixed(2)} m</span>
            </div>
            <div>
              <span style={{ color: "#94A3B8" }}>ELEVATION: </span>
              <span style={{ color: "#2E9E52", fontWeight: 700 }}>{viewCoords.elevation.toFixed(2)} m</span>
            </div>
          </div>
          <div style={{ color: "#94A3B8", fontSize: "9.5px", display: "flex", gap: "10px" }}>
            <span>LON: {viewCoords.longitude.toFixed(6)}°</span>
            <span>LAT: {viewCoords.latitude.toFixed(6)}°</span>
          </div>
        </div>
      )}

      {/* Active Measurement Banner (Phase 3.6B) */}
      {layers.measurement && layers.measurement.mode !== "OFF" && (
        <div
          style={{
            position: "absolute",
            top: "58px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#162F6A",
            backdropFilter: "blur(8px)",
            border: "1px solid #f59e0b",
            borderRadius: "20px",
            padding: "4px 16px",
            color: "#fbbf24",
            fontSize: "0.75rem",
            fontWeight: 600,
            zIndex: 10,
            boxShadow: "0 4px 16px rgba(245, 158, 11, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
          <span>3D Measurement: {layers.measurement.mode.replace("_", " ")}</span>
          <span style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 400 }}>
            ({layers.measurement.statusMessage || "Click scene to pick points"})
          </span>
        </div>
      )}

      {/* Professional GIS/CAD Navigation Compass (North Indicator) */}
      <CesiumCompass viewer={viewerInstance} />
    </div>
  );
};
