import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { CesiumViewer } from "./components/CesiumViewer";
import { VerticalExplorer } from "./components/VerticalExplorer";
import { PropertyInspector } from "./components/PropertyInspector";
import { ReviewWorkspace } from "./components/ReviewWorkspace";
import { ParcelOverviewModal } from "./components/ParcelOverviewModal";
import { IngestionWorkspaceModal } from "./components/IngestionWorkspaceModal";
import { GisAnalysisWorkspace } from "./components/GisAnalysisWorkspace";
import { AIBuildingReconstructionWorkspace } from "./components/AIBuildingReconstructionWorkspace";
import { DroneSurveyWorkspace } from "./components/DroneSurveyWorkspace";
import { PropertyRegistryModal } from "./components/PropertyRegistryModal";
import { LocationContextCard } from "./components/LocationContextCard";
import { LocationSearchBar } from "./components/LocationSearchBar";
import type { Parcel, Building, VerticalUnit, LayerVisibility, LocationSearchResult, BuildingCandidate, BuildingImageViewItem } from "./types/cadastre";
import { fetchParcels, fetchBuildings, fetchAllBuildings, fetchVerticalUnits, fetchUnitSubUnits, generateBuilding3DPrototype, fetchParcelByUlpin } from "./api/cadastreApi";
import { defaultBuildingDiscoveryProvider } from "./services/buildingDiscoveryProvider";
import { DEFAULT_CUTAWAY_STATE } from "./utils/cutawayUtils";
import {
  DEFAULT_MEASUREMENT_STATE,
  DEFAULT_COORD_HUD_STATE,
  addMeasurementPoint,
} from "./utils/measurementUtils";
import { transform2DCoordinates } from "./utils/coordinateTransform";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { LandingShell, type UserRole } from "./components/LandingShell";
import "./App.css";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<"landing" | "dashboard">("landing");
  const [activeRole, setActiveRole] = useState<UserRole>("ADMIN");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [verticalUnits, setVerticalUnits] = useState<VerticalUnit[]>([]);
  const [subUnitsMap, setSubUnitsMap] = useState<Record<string, VerticalUnit[]>>({});
  const [expandedFloorIds, setExpandedFloorIds] = useState<Set<string>>(new Set());
  const [selectedUnit, setSelectedUnit] = useState<VerticalUnit | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);
  const [showLocationCard, setShowLocationCard] = useState<boolean>(true);
  const [buildingCandidates, setBuildingCandidates] = useState<BuildingCandidate[]>([]);
  const [selectedBuildingCandidate, setSelectedBuildingCandidate] = useState<BuildingCandidate | null>(null);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(false);
  const [isGeneratingPrototype, setIsGeneratingPrototype] = useState<boolean>(false);
  const [reviewUnitId, setReviewUnitId] = useState<string | null>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState<boolean>(false);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState<boolean>(false);
  const [isGisAnalysisOpen, setIsGisAnalysisOpen] = useState<boolean>(false);
  const [gisInitialTab, setGisInitialTab] = useState<"summary" | "layers" | "nearby" | "validation">("summary");
  const [gisOpenCount, setGisOpenCount] = useState<number>(0);
  const [isPropertyRegistryOpen, setIsPropertyRegistryOpen] = useState<boolean>(false);
  const [allRegisteredBuildings, setAllRegisteredBuildings] = useState<Building[]>([]);
  const [isAiReconstructionOpen, setIsAiReconstructionOpen] = useState<boolean>(false);
  const [isDroneSurveyOpen, setIsDroneSurveyOpen] = useState<boolean>(false);
  const [surveyHandoffImages, setSurveyHandoffImages] = useState<BuildingImageViewItem[] | null>(null);
  const [surveyHandoffId, setSurveyHandoffId] = useState<string | null>(null);
  const [surveyHandoffGroundZ, setSurveyHandoffGroundZ] = useState<number | null>(null);
  const [isolatedUnitId, setIsolatedUnitId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraTrigger, setCameraTrigger] = useState<number>(0);
  const [is2DView, setIs2DView] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Discover nearby reference building footprints when searched location changes
  useEffect(() => {
    if (!searchedLocation) {
      setBuildingCandidates([]);
      setSelectedBuildingCandidate(null);
      setIsLoadingBuildings(false);
      setDiscoveryError(null);
      return;
    }

    setIsLoadingBuildings(true);
    setSelectedBuildingCandidate(null);
    setDiscoveryError(null);

    defaultBuildingDiscoveryProvider
      .discoverBuildings(searchedLocation.latitude, searchedLocation.longitude, searchedLocation)
      .then((candidates) => {
        setBuildingCandidates(candidates);
        setDiscoveryError(null);
        // Direct Navigation: Auto-select top-ranked candidate (modelAvailable, direct match, or closest)
        if (candidates.length > 0) {
          const best = candidates.find((c) => c.modelAvailable) || candidates.find((c) => c.isDirectMatch) || candidates[0];
          setSelectedBuildingCandidate(best);
          if (best.modelAvailable) {
            const matchingParcel = parcels.find(
              (p) =>
                (best.parcelId && (p.id === best.parcelId || p.ulpin_2d === best.parcelId)) ||
                (best.osmId === "356027047" && p.ulpin_2d === "36A1B2C3D4E5F9")
            );
            if (matchingParcel && matchingParcel.id !== selectedParcel?.id) {
              setSelectedParcel(matchingParcel);
            }
          } else {
            // No 3D model for this candidate — clear stale parcel/units so Surya Heights
            // data does not bleed through into the left explorer and right inspector.
            setSelectedParcel(null);
            setBuildings([]);
            setVerticalUnits([]);
          }
          setCameraTrigger((prev) => prev + 1);
        }
      })
      .catch((err) => {
        console.warn("Building discovery error:", err);
        setBuildingCandidates([]);
        setDiscoveryError(err?.message || "OpenStreetMap service temporarily unreachable");
      })
      .finally(() => {
        setIsLoadingBuildings(false);
      });
  }, [searchedLocation]);

  const handleSelectBuildingCandidate = useCallback((candidate: BuildingCandidate) => {
    setSelectedBuildingCandidate(candidate);
    setShowLocationCard(true);

    if (candidate.modelAvailable) {
      const matchingParcel = parcels.find(
        (p) =>
          (candidate.parcelId && p.id === candidate.parcelId) ||
          (candidate.parcelId && p.ulpin_2d === candidate.parcelId) ||
          (candidate.osmId === "356027047" && p.ulpin_2d === "36A1B2C3D4E5F9")
      );
      if (matchingParcel && matchingParcel.id !== selectedParcel?.id) {
        setSelectedParcel(matchingParcel);
      }
      setCameraTrigger((prev) => prev + 1);
    } else {
      // Candidate has no 3D model yet — clear stale parcel/units so the
      // PropertyInspector does not show a different building's vertical strata.
      setSelectedParcel(null);
      setBuildings([]);
      setVerticalUnits([]);
    }
  }, [parcels, selectedParcel?.id]);

  const handleAddMeasurementPoint = useCallback((point: any) => {
    setLayers((prev) => ({
      ...prev,
      measurement: addMeasurementPoint(prev.measurement, point),
    }));
  }, []);

  const handleGenerate3DPrototype = async (
    candidate: BuildingCandidate,
    options?: {
      floorsAbove: number;
      floorHeight: number;
      includeBasement: boolean;
      includeRooftop: boolean;
      subdivideFlats: boolean;
    }
  ) => {
    try {
      setIsGeneratingPrototype(true);
      const res = await generateBuilding3DPrototype({
        candidate_osm_id: candidate.osmId,
        footprint_wgs84: candidate.footprintCoordinates,
        building_name: candidate.name || `Building OSM-${candidate.osmId}`,
        total_floors_above: options?.floorsAbove !== undefined ? options.floorsAbove : (candidate.levels && candidate.levels > 0 ? candidate.levels : (candidate.floorCount || 3)),
        total_floors_below: options?.includeBasement === false ? 0 : 1,
        include_rooftop: options?.includeRooftop !== false,
        subdivide_residential_floors: options?.subdivideFlats !== false,
        floor_height_m: options?.floorHeight || 3.0,
        ground_elevation_m: candidate.groundElevationM !== undefined ? candidate.groundElevationM : 575.0,
        is_synthetic_prototype: true,
      });

      // Update candidate in state so UI immediately marks 3D model as available
      const updatedCandidate: BuildingCandidate = {
        ...candidate,
        modelAvailable: true,
        buildingCode: res.building_code,
        parcelId: res.parcel_id,
      };
      setSelectedBuildingCandidate(updatedCandidate);
      setBuildingCandidates((prev) =>
        prev.map((c) => (c.osmId === candidate.osmId ? updatedCandidate : c))
      );
      setSearchedLocation((prev) =>
        prev ? { ...prev, modelAvailable: true, parcelId: res.parcel_id } : null
      );

      // Refresh parcels list and select the newly created / updated parcel
      const updatedParcels = await fetchParcels();
      setParcels(updatedParcels);
      const targetParcel = updatedParcels.find((p) => p.id === res.parcel_id);
      if (targetParcel) {
        setSelectedParcel(targetParcel);
      }
      setCameraTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error("Failed to generate 3D prototype:", err);
      alert(`3D Cadastral Prototype generation failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsGeneratingPrototype(false);
    }
  };

  const handleSelectUnit = useCallback((unit: VerticalUnit | null) => {
    if (!unit) {
      setSelectedUnit(null);
      return;
    }
    setSelectedUnit((prev) => (prev?.id === unit.id ? null : unit));
  }, []);

  const handleToggleIsolate = (unitId: string) => {
    setIsolatedUnitId((prev) => (prev === unitId ? null : unitId));
  };

  const handleSelectLocation = (result: LocationSearchResult) => {
    setSearchedLocation(result);
    setShowLocationCard(true);

    if (result.modelAvailable) {
      // If it points to an existing parcel (e.g. Surya Heights), switch to it
      const matchingParcel = parcels.find(
        (p) =>
          (result.parcelId && p.id === result.parcelId) ||
          (result.parcelId && p.ulpin_2d === result.parcelId) ||
          p.ulpin_2d === "36A1B2C3D4E5F9"
      );
      if (matchingParcel && matchingParcel.id !== selectedParcel?.id) {
        setSelectedParcel(matchingParcel);
      }
      // Re-trigger building framing
      setCameraTrigger((prev) => prev + 1);
    }
  };

  const handleClearLocation = () => {
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);
    // Restore Surya Heights default demo
    const osmParcel = parcels.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
    if (osmParcel && selectedParcel?.id !== osmParcel.id) {
      setSelectedParcel(osmParcel);
    }
    setCameraTrigger((prev) => prev + 1);
  };

  const handleResetCamera = () => {
    setSelectedUnit(null);
    setIsolatedUnitId(null);
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);
    setCameraTrigger((prev) => prev + 1);
  };

  const handleSearchUlpin = async (ulpin: string) => {
    const clean = ulpin.trim().toUpperCase();
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);
    setSelectedUnit(null);
    setIsolatedUnitId(null);
    setShowLocationCard(false);

    const parcel = await fetchParcelByUlpin(clean);
    setParcels((prev) => (prev.some((p) => p.id === parcel.id) ? prev : [...prev, parcel]));
    setSelectedParcel(parcel);

    const bldgs = await fetchBuildings(parcel.id);
    setBuildings(bldgs);

    const units = await fetchVerticalUnits(parcel.id);
    setVerticalUnits(units);

    // If this is Surya Heights (either canonical OSM or synthetic), leave selectedBuildingCandidate null
    if (parcel.ulpin_2d === "36A1B2C3D4E5F9" || parcel.ulpin_2d === "36A1B2C3D4E5F8") {
      setSelectedBuildingCandidate(null);
    } else if (bldgs.length > 0 && bldgs[0].building_code.startsWith("BLDG-OSM-")) {
      const osmId = bldgs[0].building_code.replace("BLDG-OSM-", "");
      let centroidLat = 17.448;
      let centroidLon = 78.376;
      let footprintCoords: [number, number][] = [];
      if (parcel.geom_2d?.geojson && parcel.geom_2d.geojson.type === "Polygon") {
        // Parcel geom_2d is stored in EPSG:32644 (UTM meters). Transform to WGS84 before
        // computing centroid so Cesium camera flies to the correct geographic position.
        const utmCoords: [number, number][] = ((parcel.geom_2d.geojson as any).coordinates[0] || []);
        if (utmCoords.length > 0) {
          footprintCoords = transform2DCoordinates(utmCoords);
          centroidLon = footprintCoords.reduce((sum, c) => sum + c[0], 0) / footprintCoords.length;
          centroidLat = footprintCoords.reduce((sum, c) => sum + c[1], 0) / footprintCoords.length;
        }
      }
      setSelectedBuildingCandidate({
        id: `osm-way-${osmId}`,
        osmId,
        osmType: "way",
        source: "REAL_REFERENCE",
        isReferenceBuilding: true,
        name: bldgs[0].building_name,
        buildingType: "commercial",
        centroid: { latitude: centroidLat, longitude: centroidLon },
        footprintCoordinates: footprintCoords,
        approxAreaSqm: parcel.area_sqm || 1000,
        distanceMeters: 0,
        modelAvailable: true,
        levels: bldgs[0].total_floors_above || 3,
        floorCount: bldgs[0].total_floors_above || 3,
        buildingCode: bldgs[0].building_code,
        parcelId: parcel.id,
        attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
      });
    } else {
      setSelectedBuildingCandidate(null);
    }

    setCameraTrigger((prev) => prev + 1);
  };

  const [layers, setLayers] = useState<LayerVisibility>({
    parcel: true,
    building: true,
    groundFloors: true,
    upperFloors: true,
    basements: true,
    utilities: true,
    rooftopElevated: true,
    commonCirculation: true,
    undergroundMode: false,
    wireframeMode: false,
    elevationLevels: false,
    showVerified: true,
    showProposed: true,
    showUnderReview: true,
    showRejected: true,
    showConflictsOnly: false,
    sliceMode: false,
    sliceMinZ: -10,
    sliceMaxZ: 30,
    cutaway: DEFAULT_CUTAWAY_STATE,
    measurement: DEFAULT_MEASUREMENT_STATE,
    coordHUD: DEFAULT_COORD_HUD_STATE,
  });

  // 1. Initial Data Fetching: Load parcels on mount (prioritize canonical APARTMENT-SURYA-OSM anchor parcel)
  const loadParcels = useCallback(() => {
    fetchParcels()
      .then((data) => {
        setParcels(data);
        setIsConnected(true);
        setErrorMessage(null);
        if (data.length > 0) {
          const osmParcel = data.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
          const suryaParcel = data.find((p) => p.ulpin_2d === "36A1B2C3D4E5F8");
          setSelectedParcel(osmParcel || suryaParcel || data[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to connect to backend:", err);
        setIsConnected(false);
        setErrorMessage(
          "Unable to connect to FastAPI backend at http://127.0.0.1:8000. Ensure the backend uvicorn server is running."
        );
      });

    fetchAllBuildings()
      .then((bldgs) => setAllRegisteredBuildings(bldgs))
      .catch((err) => console.warn("All buildings fetch error:", err));
  }, []);

  useEffect(() => {
    loadParcels();
  }, [loadParcels]);

  // Refresh all registered buildings whenever Property Registry is opened
  useEffect(() => {
    if (isPropertyRegistryOpen) {
      fetchAllBuildings()
        .then((bldgs) => setAllRegisteredBuildings(bldgs))
        .catch((err) => console.warn("Registry buildings refresh error:", err));
    }
  }, [isPropertyRegistryOpen]);

  // 2. When parcel changes, fetch its buildings and vertical units
  useEffect(() => {
    if (!selectedParcel) return;

    fetchBuildings(selectedParcel.id)
      .then((bldgs) => setBuildings(bldgs))
      .catch((err) => console.warn("Buildings fetch error:", err));

    fetchVerticalUnits(selectedParcel.id)
      .then(async (units) => {
        setVerticalUnits(units);
        setSelectedUnit(null); // Default to building overview mode

        // Automatically prefetch sub-units for all residential upper storeys
        const residentialFloors = units.filter(
          (u) => u.tier_code === "F" && u.floor_code !== "F00" && u.floor_code !== "GF"
        );
        for (const floor of residentialFloors) {
          try {
            const subs = await fetchUnitSubUnits(floor.id);
            if (subs && subs.length > 0) {
              setSubUnitsMap((prev) => ({ ...prev, [floor.id]: subs }));
            }
          } catch (err) {
            console.warn("Sub-units prefetch error for floor:", floor.floor_code, err);
          }
        }
      })
      .catch((err) => console.warn("Vertical units fetch error:", err));
  }, [selectedParcel?.id]);

  const handleToggleExpandFloor = async (floorUnitId: string) => {
    setExpandedFloorIds((prev) => {
      const next = new Set(prev);
      if (next.has(floorUnitId)) {
        next.delete(floorUnitId);
      } else {
        next.add(floorUnitId);
      }
      return next;
    });

    if (!subUnitsMap[floorUnitId]) {
      try {
        const subUnits = await fetchUnitSubUnits(floorUnitId);
        if (subUnits && subUnits.length > 0) {
          setSubUnitsMap((prev) => ({
            ...prev,
            [floorUnitId]: subUnits,
          }));
        }
      } catch (err) {
        console.warn("Failed to fetch sub-units for unit:", floorUnitId, err);
      }
    }
  };

  const activeBuilding = (selectedBuildingId ? buildings.find((b) => b.id === selectedBuildingId) : null) || (buildings.length > 0 ? buildings[0] : null);

  const handleToggleView = useCallback((targetView: "landing" | "dashboard") => {
    if (targetView === "landing") {
      setIsGisAnalysisOpen(false);
      setIsOverviewModalOpen(false);
      setIsIngestionModalOpen(false);
      setCurrentView("landing");
    } else {
      setCurrentView("dashboard");
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
    }
  }, []);

  const handleToggleNavMenu = useCallback(() => {
    setIsNavMenuOpen((prev) => !prev);
  }, []);

  const handleLaunch3D = useCallback(() => {
    handleToggleView("dashboard");
  }, [handleToggleView]);

  const handleOpenGisFromLanding = useCallback((initialTab: "summary" | "layers" | "nearby" | "validation" = "summary") => {
    console.log("[App] handleOpenGisFromLanding received initialTab:", initialTab);
    setGisInitialTab(initialTab);
    setGisOpenCount((prev) => prev + 1);
    setCurrentView("dashboard");
    setIsGisAnalysisOpen(true);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }, []);

  const handleOpenVerticalStrata = useCallback(() => {
    setCurrentView("dashboard");
    setLayers((prev) => ({
      ...prev,
      building: true,
      groundFloors: true,
      upperFloors: true,
      basements: true,
      rooftopElevated: true,
    }));
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }, []);

  const handleOpenAiReconstruction = useCallback(() => {
    setIsAiReconstructionOpen(true);
  }, []);

  const handleOpenDroneSurvey = useCallback(() => {
    setIsDroneSurveyOpen(true);
  }, []);

  const handleOpenPropertyRegistry = useCallback(() => {
    setIsPropertyRegistryOpen(true);
  }, []);

  const handleViewIn3DFromRegistry = useCallback((parcel: Parcel, buildingId?: string) => {
    setSelectedParcel(parcel);
    if (buildingId) {
      setSelectedBuildingId(buildingId);
    }
    fetchBuildings(parcel.id).then((bldgs) => {
      setBuildings(bldgs);
      if (buildingId) setSelectedBuildingId(buildingId);
    });
    fetchVerticalUnits(parcel.id).then((units) => {
      if (buildingId) {
        const bldgUnits = units.filter((u) => u.building_id === buildingId);
        setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
      } else {
        setVerticalUnits(units);
      }
    });
    setCurrentView("dashboard");
    setIsPropertyRegistryOpen(false);
    setSelectedBuildingCandidate(null);
    setCameraTrigger((prev) => prev + 1);
  }, []);

  const handleViewStrataFromRegistry = useCallback((parcel: Parcel, buildingId?: string) => {
    setSelectedParcel(parcel);
    if (buildingId) {
      setSelectedBuildingId(buildingId);
    }
    fetchBuildings(parcel.id).then((bldgs) => {
      setBuildings(bldgs);
      if (buildingId) setSelectedBuildingId(buildingId);
    });
    fetchVerticalUnits(parcel.id).then((units) => {
      if (buildingId) {
        const bldgUnits = units.filter((u) => u.building_id === buildingId);
        setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
      } else {
        setVerticalUnits(units);
      }
    });
    setIsPropertyRegistryOpen(false);
    handleOpenVerticalStrata();
  }, [handleOpenVerticalStrata]);

  const handleViewGisFromRegistry = useCallback((parcel: Parcel, buildingId?: string, initialTab: "summary" | "layers" | "nearby" | "validation" = "summary") => {
    setSelectedParcel(parcel);
    if (buildingId) {
      setSelectedBuildingId(buildingId);
    }
    fetchBuildings(parcel.id).then((bldgs) => {
      setBuildings(bldgs);
      if (buildingId) setSelectedBuildingId(buildingId);
    });
    fetchVerticalUnits(parcel.id).then((units) => {
      if (buildingId) {
        const bldgUnits = units.filter((u) => u.building_id === buildingId);
        setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
      } else {
        setVerticalUnits(units);
      }
    });
    setIsPropertyRegistryOpen(false);
    handleOpenGisFromLanding(initialTab);
  }, [handleOpenGisFromLanding]);

  return (
    <div className="cadastre-app-root" style={{ width: "100%", height: "100%", position: "relative" }}>
      {currentView === "landing" && (
        <LandingShell
          currentView={currentView}
          onToggleView={handleToggleView}
          onLaunch3D={handleLaunch3D}
          onOpenGisAnalysis={handleOpenGisFromLanding}
          onOpenVerticalStrata={handleOpenVerticalStrata}
          parcel={selectedParcel}
          building={activeBuilding}
          verticalUnits={verticalUnits}
          buildingCandidate={selectedBuildingCandidate}
          activeRole={activeRole}
          onChangeRole={setActiveRole}
          onOpenAiReconstruction={handleOpenAiReconstruction}
          onOpenDroneSurvey={handleOpenDroneSurvey}
          onOpenPropertyRegistry={handleOpenPropertyRegistry}
        />
      )}

      <div
        className="cadastre-app"
        style={{
          display: currentView === "dashboard" ? "flex" : "none",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Top Command Navbar (54px) */}
        <Header
          currentView={currentView}
          onToggleView={handleToggleView}
          isConnected={isConnected}
          parcels={parcels}
          selectedParcel={selectedParcel}
          onSelectParcel={setSelectedParcel}
          buildingCandidate={selectedBuildingCandidate}
          onOpenGisAnalysis={(tab = "summary") => {
            setGisInitialTab(tab);
            setGisOpenCount((prev) => prev + 1);
            setIsGisAnalysisOpen(true);
          }}
          onOpenVerticalStrata={handleOpenVerticalStrata}
          onReturnToLanding={() => handleToggleView("landing")}
          activeRole={activeRole}
          onChangeRole={setActiveRole}
          onOpenAiReconstruction={handleOpenAiReconstruction}
          onOpenDroneSurvey={handleOpenDroneSurvey}
          onOpenPropertyRegistry={handleOpenPropertyRegistry}
          onOpenReviewWorkspace={() => {
            const targetUnit = selectedUnit || verticalUnits[0];
            if (targetUnit) setReviewUnitId(targetUnit.id);
          }}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Application Area (3-Zone Spatial Command Center) */}
        <div
          className="main-app-area"
          style={{
            display: "flex",
            flexDirection: "row",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Error Alert if backend unreachable */}
          {errorMessage && (
            <div className="error-banner">
              <AlertTriangle className="error-icon" />
              <span>{errorMessage}</span>
              <button
                className="btn-retry"
                onClick={() => {
                  setErrorMessage(null);
                  loadParcels();
                }}
              >
                <RefreshCw className="icon-sm" /> Retry
              </button>
            </div>
          )}

          {/* Left Side Panel: Primary Spatial Command Navigation */}
          <VerticalExplorer
            units={verticalUnits}
            subUnitsMap={subUnitsMap}
            expandedFloorIds={expandedFloorIds}
            onToggleExpandFloor={handleToggleExpandFloor}
            selectedUnit={selectedUnit}
            onSelectUnit={handleSelectUnit}
            isolatedUnitId={isolatedUnitId}
            onToggleIsolate={handleToggleIsolate}
            onOpenParcelOverview={() => setIsOverviewModalOpen(true)}
            layers={layers}
            onChangeLayers={setLayers}
            onResetCamera={handleResetCamera}
            is2DView={is2DView}
            onToggle2DView={() => setIs2DView(!is2DView)}
            onOpenAiReconstruction={handleOpenAiReconstruction}
            onOpenDroneSurvey={handleOpenDroneSurvey}
            onOpenGisAnalysis={(tab = "summary") => {
              setGisInitialTab(tab);
              setGisOpenCount((prev) => prev + 1);
              setIsGisAnalysisOpen(true);
            }}
            onOpenPropertyRegistry={handleOpenPropertyRegistry}
            onOpenReviewWorkspace={() => {
              const targetUnit = selectedUnit || verticalUnits[0];
              if (targetUnit) setReviewUnitId(targetUnit.id);
            }}
          />

        {/* Center: Cesium 3D Viewport */}
        <section className="viewport-center cesium-map-container">
          {/* ☰ Menu button — anchored to top-left of map viewport */}
          {!isNavMenuOpen && (
            <button
              type="button"
              className="nav-menu-btn"
              onClick={handleToggleNavMenu}
              data-testid="nav-menu-open-btn"
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Menu
            </button>
          )}
          <CesiumViewer
            parcel={selectedParcel}
            building={activeBuilding}
            units={verticalUnits}
            subUnitsMap={subUnitsMap}
            expandedFloorIds={expandedFloorIds}
            selectedUnit={selectedUnit}
            onSelectUnit={handleSelectUnit}
            layers={layers}
            isolatedUnitId={isolatedUnitId}
            is2DView={is2DView}
            cameraTrigger={cameraTrigger}
            searchedLocation={searchedLocation}
            buildingCandidates={buildingCandidates}
            selectedBuildingCandidate={selectedBuildingCandidate}
            onSelectBuildingCandidate={handleSelectBuildingCandidate}
            onAddMeasurementPoint={handleAddMeasurementPoint}
          />

          {/* Floating Global Property Search at TOP of Map Viewport */}
          <div className="map-search-overlay" data-testid="map-search-overlay">
            <LocationSearchBar
              onSelectLocation={handleSelectLocation}
              onClearLocation={handleClearLocation}
              activeLocation={searchedLocation}
              onSearchUlpin={handleSearchUlpin}
              onSelectParcel={setSelectedParcel}
              parcels={parcels}
              selectedParcel={selectedParcel}
              initialMode="ALL"
              onOpenPropertyRegistry={handleOpenPropertyRegistry}
            />
          </div>

          {/* Searched Location & Building Discovery Context Card (Phase 3.11B / 3.12A) */}
          {searchedLocation && showLocationCard && (
            <LocationContextCard
              location={searchedLocation}
              buildingCandidates={buildingCandidates}
              selectedBuildingCandidate={selectedBuildingCandidate}
              onSelectBuildingCandidate={handleSelectBuildingCandidate}
              onDeselectBuildingCandidate={() => setSelectedBuildingCandidate(null)}
              onGenerate3DPrototype={handleGenerate3DPrototype}
              isGeneratingPrototype={isGeneratingPrototype}
              onInspect3DStrata={() => {
                const osmParcel = parcels.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
                if (osmParcel) setSelectedParcel(osmParcel);
                setCameraTrigger((prev) => prev + 1);
              }}
              onReturnToDemo={handleClearLocation}
              onClose={() => setShowLocationCard(false)}
              isLoadingBuildings={isLoadingBuildings}
              discoveryError={discoveryError}
            />
          )}

          {/* Restore Location Context Card button if dismissed */}
          {searchedLocation && !showLocationCard && (
            <button
              type="button"
              className="chip"
              onClick={() => setShowLocationCard(true)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 35,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Reopen Searched Location Context"
            >
              <span>📍 Show Location Context ({searchedLocation.displayName.split(",")[0]})</span>
            </button>
          )}



          {/* Research Prototype Disclaimer & OSM Attribution Footer Banner */}
          <div
            data-testid="spatial-status-hud"
            style={{
              position: "absolute",
              bottom: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#162F6A",
              border: "1px solid #D9DEE5",
              borderRadius: "3px",
              padding: "3px 12px",
              fontSize: "10px",
              color: "#CBD5E1",
              pointerEvents: "none",
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#E0A93C", fontWeight: 700, letterSpacing: "0.04em" }}>SPATIAL STATUS</span>
            <span style={{ color: "#46516B" }}>|</span>
            <span>EPSG:32644 (UTM 44N) · Geographic Footprint Ground Reference</span>
            <span style={{ color: "#46516B" }}>|</span>
            <span style={{ color: "#94A3B8" }}>© OpenStreetMap contributors</span>
          </div>
        </section>

        {/* Right Side Panel: Cadastral Inspector */}
        <aside className="sidebar-right">
          <PropertyInspector
            unit={selectedUnit}
            building={activeBuilding}
            parcel={selectedParcel}
            candidate={selectedBuildingCandidate}
            verticalUnits={verticalUnits}
            locationContext={searchedLocation}
            onClose={() => setSelectedUnit(null)}
            onOpenReview={(id) => setReviewUnitId(id)}
            onGenerateFromAI={handleGenerate3DPrototype}
          />
        </aside>
      </div>

      {/* Phase 3.1 Human Review & Decision Workspace Modal */}
      {reviewUnitId && (
        <ReviewWorkspace
          unitId={reviewUnitId}
          onClose={() => setReviewUnitId(null)}
          onStatusChanged={(updatedUnit) => {
            if (selectedParcel) {
              fetchVerticalUnits(selectedParcel.id).then((units) => {
                setVerticalUnits(units);
                const match = units.find((u) => u.id === updatedUnit.id);
                if (match) setSelectedUnit(match);
              });
            }
          }}
        />
      )}

      {/* Phase 3.2 Parcel 3D Dataset Overview & Scorecard Modal */}
      {isOverviewModalOpen && selectedParcel && (
        <ParcelOverviewModal
          parcelId={selectedParcel.id}
          onClose={() => setIsOverviewModalOpen(false)}
        />
      )}

      {/* Phase 3.3 Real-World Ingestion & Source Standardization Modal */}
      {isIngestionModalOpen && (
        <IngestionWorkspaceModal
          isOpen={isIngestionModalOpen}
          onClose={() => setIsIngestionModalOpen(false)}
          onOpenReviewWorkspace={(unitId) => {
            setReviewUnitId(unitId || verticalUnits[0]?.id || null);
          }}
        />
      )}

      {/* Feature Expansion Phase 1: GIS Analysis Workspace */}
      {isGisAnalysisOpen && (
        <GisAnalysisWorkspace
          key={`gis-workspace-${gisInitialTab}-${gisOpenCount}`}
          isOpen={isGisAnalysisOpen}
          initialTab={gisInitialTab}
          onClose={() => {
            console.log("[App] Closing GIS Analysis Workspace, returning to 3D Dashboard");
            setIsGisAnalysisOpen(false);
          }}
          parcel={selectedParcel}
          building={activeBuilding}
          verticalUnits={verticalUnits}
          buildingCandidates={buildingCandidates}
          selectedCandidate={selectedBuildingCandidate}
          layers={layers}
          onChangeLayers={setLayers}
          onInspect3DView={() => {
            setIsGisAnalysisOpen(false);
            setCameraTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* AI-Assisted Building Image -> 3D Reconstruction Modal */}
      {isAiReconstructionOpen && (
        <AIBuildingReconstructionWorkspace
          isOpen={isAiReconstructionOpen}
          onClose={() => setIsAiReconstructionOpen(false)}
          parcel={selectedParcel}
          building={activeBuilding}
          initialSurveyImages={surveyHandoffImages}
          initialSurveyId={surveyHandoffId}
          initialGroundZ={surveyHandoffGroundZ}
          onBuildingGenerated={(res) => {
            setSelectedBuildingId(res.building_id);
            fetchAllBuildings().then((b) => setAllRegisteredBuildings(b));
            fetchParcels().then((updatedParcels) => {
              setParcels(updatedParcels);
              const targetParcel = updatedParcels.find((p) => p.id === res.parcel_id);
              if (targetParcel) {
                setSelectedParcel(targetParcel);
                fetchBuildings(targetParcel.id).then((bldgs) => {
                  setBuildings(bldgs);
                  setSelectedBuildingId(res.building_id);
                });
                fetchVerticalUnits(targetParcel.id).then((units) => {
                  const bldgUnits = units.filter((u) => u.building_id === res.building_id);
                  setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
                });
              } else if (selectedParcel) {
                fetchBuildings(selectedParcel.id).then((bldgs) => {
                  setBuildings(bldgs);
                  setSelectedBuildingId(res.building_id);
                });
                fetchVerticalUnits(selectedParcel.id).then((units) => {
                  const bldgUnits = units.filter((u) => u.building_id === res.building_id);
                  setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
                });
              }
            });
          }}
          onViewIn3D={(res) => {
            setIsAiReconstructionOpen(false);
            setSelectedBuildingId(res.building_id);
            fetchAllBuildings().then((b) => setAllRegisteredBuildings(b));
            fetchParcels().then((updatedParcels) => {
              setParcels(updatedParcels);
              const targetParcel = updatedParcels.find((p) => p.id === res.parcel_id);
              if (targetParcel) {
                setSelectedParcel(targetParcel);
                fetchBuildings(targetParcel.id).then((bldgs) => {
                  setBuildings(bldgs);
                  setSelectedBuildingId(res.building_id);
                });
                fetchVerticalUnits(targetParcel.id).then((units) => {
                  const bldgUnits = units.filter((u) => u.building_id === res.building_id);
                  setVerticalUnits(bldgUnits.length > 0 ? bldgUnits : units);
                });
              }
              setCameraTrigger((prev) => prev + 1);
            });
          }}
          onOpenVerticalStrata={() => {
            setIsAiReconstructionOpen(false);
            handleOpenVerticalStrata();
          }}
          onOpenValidation={() => {
            setIsAiReconstructionOpen(false);
            setGisInitialTab("validation");
            setGisOpenCount((prev) => prev + 1);
            setIsGisAnalysisOpen(true);
          }}
          onOpenReview={(unitId) => {
            setIsAiReconstructionOpen(false);
            setReviewUnitId(unitId);
          }}
        />
      )}

      {/* Drone Survey / Survey Data Input Workspace Modal */}
      {isDroneSurveyOpen && (
        <DroneSurveyWorkspace
          isOpen={isDroneSurveyOpen}
          onClose={() => setIsDroneSurveyOpen(false)}
          parcel={selectedParcel}
          building={activeBuilding}
          onSendToAiReconstruction={(handoffImages, surveyId, groundZ) => {
            setIsDroneSurveyOpen(false);
            setSurveyHandoffImages(handoffImages);
            setSurveyHandoffId(surveyId);
            setSurveyHandoffGroundZ(groundZ ?? null);
            setIsAiReconstructionOpen(true);
          }}
        />
      )}

      {/* Phase 2: 3D Property Registry Modal */}
      {isPropertyRegistryOpen && (
        <PropertyRegistryModal
          isOpen={isPropertyRegistryOpen}
          onClose={() => setIsPropertyRegistryOpen(false)}
          parcels={parcels}
          selectedParcel={selectedParcel}
          onSelectParcel={setSelectedParcel}
          buildings={buildings}
          allRegisteredBuildings={allRegisteredBuildings}
          activeBuilding={activeBuilding}
          onSelectBuilding={(bId) => setSelectedBuildingId(bId)}
          onViewIn3D={handleViewIn3DFromRegistry}
          onOpenVerticalStrata={handleViewStrataFromRegistry}
          onOpenGisAnalysis={handleViewGisFromRegistry}
        />
      )}
      </div>
    </div>
  );
};

export default App;

