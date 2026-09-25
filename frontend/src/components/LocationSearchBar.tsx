import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, MapPin, Building2, AlertTriangle, FileText, Box } from "lucide-react";
import type { LocationSearchResult, Parcel } from "../types/cadastre";
import { defaultLocationSearchProvider, CANONICAL_DEMO_PRESETS } from "../services/locationSearchProvider";
import { fetchParcelByUlpin } from "../api/cadastreApi";

export type SearchMode = "ALL" | "ULPIN" | "SURVEY_NO" | "PROPERTY_ID" | "ADDRESS" | "LOCATION";

export const CANONICAL_ULPIN_PRESETS = [
  { ulpin: "36A1B2C3D4E5F9", name: "Surya Heights (Canonical OSM Anchor)", desc: "Kondapur · G+5 + Basement" },
  { ulpin: "36116079893D2B", name: "Nexiilabs Commercial Building", desc: "HITEC City · Real Reference" },
  { ulpin: "3689918045B388", name: "Deloitte Commercial Tower", desc: "HITECH City, Madhapur · Real Reference" },
  { ulpin: "36A1B2C3D4E5F8", name: "Surya Heights (Synthetic Prototype)", desc: "Kondapur · G+5" },
];

export interface UnifiedSearchResult {
  id: string;
  type: "ULPIN" | "SURVEY_NO" | "PROPERTY_ID" | "ADDRESS" | "LOCATION";
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: string;
  parcel?: Parcel;
  locationResult?: LocationSearchResult;
  ulpin?: string;
}

export interface LocationSearchBarProps {
  onSelectLocation: (result: LocationSearchResult, options?: { autoSelectBestBuilding?: boolean }) => void;
  onClearLocation?: () => void;
  activeLocation?: LocationSearchResult | null;
  onSearchUlpin?: (ulpin: string) => Promise<void>;
  onSelectParcel?: (parcel: Parcel) => void;
  parcels?: Parcel[];
  selectedParcel?: Parcel | null;
  initialMode?: SearchMode;
  onOpenPropertyRegistry?: () => void;
}

export const LocationSearchBar: React.FC<LocationSearchBarProps> = ({
  onSelectLocation,
  onClearLocation,
  activeLocation,
  onSearchUlpin,
  onSelectParcel,
  parcels = [],
  selectedParcel,
  initialMode = "ALL",
  onOpenPropertyRegistry,
}) => {
  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Sync query when activeLocation changes from outside
  useEffect(() => {
    if (activeLocation && (searchMode === "LOCATION" || searchMode === "ADDRESS")) {
      setQuery(activeLocation.displayName.split(",")[0]);
    }
  }, [activeLocation, searchMode]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mode-specific search execution
  const executeSearch = async (searchTerm: string, mode: SearchMode = searchMode) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setError(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedIndex(-1);

    const cleanUpper = trimmed.toUpperCase();
    const cleanLower = trimmed.toLowerCase();

    try {
      let matchedItems: UnifiedSearchResult[] = [];

      // 1. Mode: ULPIN
      if (mode === "ULPIN") {
        matchedItems = await searchUlpinDirect(cleanUpper, trimmed);
      }
      // 2. Mode: Survey Number
      else if (mode === "SURVEY_NO") {
        matchedItems = searchSurveyNumber(cleanLower);
      }
      // 3. Mode: Property / Building ID
      else if (mode === "PROPERTY_ID") {
        matchedItems = searchPropertyId(cleanLower);
      }
      // 4. Mode: Address
      else if (mode === "ADDRESS") {
        matchedItems = await searchGeocoding(trimmed, "ADDRESS");
      }
      // 5. Mode: Location
      else if (mode === "LOCATION") {
        matchedItems = await searchGeocoding(trimmed, "LOCATION");
      }
      // 6. Mode: Search All
      else {
        const [ulpins, surveys, properties] = await Promise.all([
          searchUlpinDirect(cleanUpper, trimmed),
          Promise.resolve(searchSurveyNumber(cleanLower)),
          Promise.resolve(searchPropertyId(cleanLower)),
        ]);

        let geocoded: UnifiedSearchResult[] = [];
        // Only trigger external geocoder if not an exact 14-char ULPIN match
        if (!(cleanUpper.length === 14 && /^[A-Z0-9]{14}$/.test(cleanUpper))) {
          try {
            geocoded = await searchGeocoding(trimmed, "LOCATION");
          } catch {
            // Geocoding non-fatal if internal records matched
          }
        }

        // Deduplicate
        const seenKeys = new Set<string>();
        const combined = [...ulpins, ...surveys, ...properties, ...geocoded];
        for (const item of combined) {
          const key = `${item.title.toLowerCase()}::${item.ulpin || item.locationResult?.osmId || item.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            matchedItems.push(item);
          }
        }
      }

      setResults(matchedItems);
      setIsOpen(true);
    } catch (err: any) {
      console.warn("Search execution error:", err);
      setError(err?.message || "Search failed. Please try again.");
      setResults([]);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUlpinDirect = async (cleanUpper: string, rawTerm: string): Promise<UnifiedSearchResult[]> => {
    const list: UnifiedSearchResult[] = [];
    const seenUlpins = new Set<string>();

    // Check loaded parcels
    for (const p of parcels) {
      if (p.ulpin_2d && p.ulpin_2d.toUpperCase().includes(cleanUpper)) {
        seenUlpins.add(p.ulpin_2d.toUpperCase());
        list.push({
          id: `parcel-ulpin-${p.id}`,
          type: "ULPIN",
          title: p.ulpin_2d,
          subtitle: `${p.survey_number ? `Survey: ${p.survey_number} · ` : ""}${p.district || "Hyderabad"}, ${p.state || "Telangana"}`,
          badge: "ULPIN",
          badgeColor: "#FFA62B",
          parcel: p,
          ulpin: p.ulpin_2d,
        });
      }
    }

    // Check canonical presets
    for (const cp of CANONICAL_ULPIN_PRESETS) {
      if (
        !seenUlpins.has(cp.ulpin.toUpperCase()) &&
        (cp.ulpin.toUpperCase().includes(cleanUpper) || cp.name.toLowerCase().includes(rawTerm.toLowerCase()))
      ) {
        seenUlpins.add(cp.ulpin.toUpperCase());
        list.push({
          id: `preset-ulpin-${cp.ulpin}`,
          type: "ULPIN",
          title: cp.ulpin,
          subtitle: `${cp.name} · ${cp.desc}`,
          badge: "ULPIN",
          badgeColor: "#FFA62B",
          ulpin: cp.ulpin,
        });
      }
    }

    // Direct exact lookup if valid 14-character syntax and not yet seen
    if (cleanUpper.length === 14 && /^[A-Z0-9]{14}$/.test(cleanUpper) && !seenUlpins.has(cleanUpper)) {
      try {
        const fetched = await fetchParcelByUlpin(cleanUpper);
        if (fetched && !seenUlpins.has(fetched.ulpin_2d.toUpperCase())) {
          list.unshift({
            id: `fetched-ulpin-${fetched.id}`,
            type: "ULPIN",
            title: fetched.ulpin_2d,
            subtitle: `${fetched.survey_number ? `Survey: ${fetched.survey_number} · ` : ""}${fetched.district || "Hyderabad"}, ${fetched.state || "Telangana"}`,
            badge: "ULPIN",
            badgeColor: "#FFA62B",
            parcel: fetched,
            ulpin: fetched.ulpin_2d,
          });
        }
      } catch {
        // Handled gracefully; if list is empty, caller shows "not found"
      }
    }

    return list;
  };

  const searchSurveyNumber = (cleanLower: string): UnifiedSearchResult[] => {
    const list: UnifiedSearchResult[] = [];
    const seen = new Set<string>();

    for (const p of parcels) {
      if (p.survey_number && p.survey_number.toLowerCase().includes(cleanLower)) {
        seen.add(p.id);
        list.push({
          id: `survey-${p.id}`,
          type: "SURVEY_NO",
          title: `Survey No: ${p.survey_number}`,
          subtitle: `ULPIN: ${p.ulpin_2d} · ${p.district || "Hyderabad"}, ${p.state || "Telangana"}`,
          badge: "Survey No",
          badgeColor: "#82C0CC",
          parcel: p,
          ulpin: p.ulpin_2d,
        });
      }
    }

    // Check presets if matching reference survey numbers (e.g. SY-OSM-116079893)
    for (const cp of CANONICAL_ULPIN_PRESETS) {
      if (cp.desc.toLowerCase().includes(cleanLower) && !seen.has(cp.ulpin)) {
        list.push({
          id: `preset-survey-${cp.ulpin}`,
          type: "SURVEY_NO",
          title: `Survey Ref (${cp.name})`,
          subtitle: `ULPIN: ${cp.ulpin} · ${cp.desc}`,
          badge: "Survey No",
          badgeColor: "#82C0CC",
          ulpin: cp.ulpin,
        });
      }
    }

    return list;
  };

  const searchPropertyId = (cleanLower: string): UnifiedSearchResult[] => {
    const list: UnifiedSearchResult[] = [];
    const seen = new Set<string>();

    // 1. Parcels by ID or ULPIN
    for (const p of parcels) {
      if (
        p.id.toLowerCase().includes(cleanLower) ||
        p.ulpin_2d.toLowerCase().includes(cleanLower)
      ) {
        seen.add(p.id);
        list.push({
          id: `property-parcel-${p.id}`,
          type: "PROPERTY_ID",
          title: `Parcel ${p.ulpin_2d}`,
          subtitle: `ID: ${p.id.slice(0, 8)}… · ${p.district || "Hyderabad"}`,
          badge: "Property ID",
          badgeColor: "#489FB5",
          parcel: p,
          ulpin: p.ulpin_2d,
        });
      }
    }

    // 2. Canonical ULPIN presets (Surya Heights, Nexiilabs, Deloitte)
    for (const cp of CANONICAL_ULPIN_PRESETS) {
      if (
        cp.name.toLowerCase().includes(cleanLower) ||
        cp.ulpin.toLowerCase().includes(cleanLower) ||
        cp.desc.toLowerCase().includes(cleanLower)
      ) {
        if (!seen.has(cp.ulpin)) {
          seen.add(cp.ulpin);
          list.push({
            id: `property-preset-${cp.ulpin}`,
            type: "PROPERTY_ID",
            title: cp.name,
            subtitle: `ULPIN: ${cp.ulpin} · ${cp.desc}`,
            badge: "Property ID",
            badgeColor: "#489FB5",
            ulpin: cp.ulpin,
          });
        }
      }
    }

    // 3. Demo presets
    for (const dp of CANONICAL_DEMO_PRESETS) {
      if (
        (dp.buildingCode && dp.buildingCode.toLowerCase().includes(cleanLower)) ||
        (dp.osmId && dp.osmId.toLowerCase().includes(cleanLower)) ||
        dp.displayName.toLowerCase().includes(cleanLower) ||
        dp.id.toLowerCase().includes(cleanLower)
      ) {
        if (!seen.has(dp.id)) {
          seen.add(dp.id);
          list.push({
            id: `property-demo-${dp.id}`,
            type: "PROPERTY_ID",
            title: dp.displayName.split(",")[0],
            subtitle: `${dp.buildingCode ? `Code: ${dp.buildingCode} · ` : ""}${dp.osmId ? `OSM: ${dp.osmId}` : dp.shortAddress || ""}`,
            badge: "Property ID",
            badgeColor: "#489FB5",
            locationResult: dp,
            ulpin: dp.parcelId,
          });
        }
      }
    }

    return list;
  };

  const searchGeocoding = async (term: string, mode: "ADDRESS" | "LOCATION"): Promise<UnifiedSearchResult[]> => {
    const geoResults = await defaultLocationSearchProvider.search(term);
    return geoResults.map((item) => ({
      id: `geo-${item.id}`,
      type: mode,
      title: item.displayName.split(",")[0],
      subtitle: item.shortAddress || item.displayName,
      badge: item.modelAvailable ? "3D Available" : mode === "ADDRESS" ? "Address" : "Location",
      badgeColor: item.modelAvailable ? "#34d399" : mode === "ADDRESS" ? "#38bdf8" : "#82C0CC",
      locationResult: item,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.trim().length >= 2) {
      setIsLoading(true);
      setIsOpen(true);
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(value, searchMode);
      }, 350);
    } else {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleSelectResult = async (item: UnifiedSearchResult) => {
    setIsOpen(false);
    setQuery(item.title);

    // If item has a direct parcel reference
    if (item.parcel) {
      if (onSelectParcel) {
        onSelectParcel(item.parcel);
      }
      if (onSearchUlpin && item.parcel.ulpin_2d) {
        try {
          await onSearchUlpin(item.parcel.ulpin_2d);
        } catch (err) {
          console.warn("ULPIN search resolution:", err);
        }
      }
    } else if (item.ulpin) {
      // Look up in loaded parcels first
      const localParcel = parcels.find((p) => p.ulpin_2d.toUpperCase() === item.ulpin!.toUpperCase());
      if (localParcel && onSelectParcel) {
        onSelectParcel(localParcel);
      }
      if (onSearchUlpin) {
        try {
          await onSearchUlpin(item.ulpin);
        } catch (err: any) {
          setError(err?.message || "ULPIN not found in the project reference registry.");
          setIsOpen(true);
        }
      }
    } else if (item.locationResult) {
      onSelectLocation(item.locationResult, { autoSelectBestBuilding: true });
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isSubmittingRef.current) return;

      if (selectedIndex >= 0 && selectedIndex < results.length) {
        await handleSelectResult(results[selectedIndex]);
      } else if (query.trim().length >= 2) {
        isSubmittingRef.current = true;
        try {
          // If ULPIN mode and 14 chars, execute directly
          const clean = query.trim().toUpperCase();
          if (searchMode === "ULPIN") {
            if (clean.length === 14 && /^[A-Z0-9]{14}$/.test(clean)) {
              if (onSearchUlpin) {
                setIsLoading(true);
                setError(null);
                try {
                  await onSearchUlpin(clean);
                  setIsOpen(false);
                } catch (err: any) {
                  setError(err?.message || "ULPIN not found in the project reference registry.");
                  setIsOpen(true);
                } finally {
                  setIsLoading(false);
                }
              }
            } else {
              setError("ULPIN must be exactly 14 alphanumeric characters (e.g. 36A1B2C3D4E5F9).");
              setIsOpen(true);
            }
          } else {
            await executeSearch(query, searchMode);
            // If top result exists after search, can auto-select on enter
            if (results.length > 0) {
              await handleSelectResult(results[0]);
            }
          }
        } finally {
          isSubmittingRef.current = false;
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsOpen(false);
    setHasSearched(false);
    if (onClearLocation) {
      onClearLocation();
    }
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="global-property-search-container"
      data-testid="global-search-container"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "480px",
        minWidth: "220px",
        zIndex: 100,
      }}
    >
      {/* Search Input Box */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#FFFFFF",
          border: error
            ? "1px solid #C0392B"
            : "1px solid #D9DDE5",
          borderRadius: "4px",
          padding: "2px 8px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          height: "34px",
          transition: "border-color 0.15s, box-shadow 0.15s",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Compact Search Mode Selector */}
        <select
          data-testid="search-mode-select"
          aria-label="Search Mode"
          value={searchMode}
          onChange={(e) => {
            const nextMode = e.target.value as SearchMode;
            setSearchMode(nextMode);
            setError(null);
            setResults([]);
            setHasSearched(false);
            setIsOpen(false);
            if (query.trim().length >= 2) {
              executeSearch(query, nextMode);
            }
            inputRef.current?.focus();
          }}
          style={{
            background: "#EBEAEA",
            border: "1px solid #D9DDE5",
            borderRadius: "3px",
            color: "#162F6A",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "2px 5px",
            marginRight: "6px",
            cursor: "pointer",
            outline: "none",
            flexShrink: 0,
            letterSpacing: "0.02em",
            maxWidth: "95px",
          }}
          title="Search Mode Selector: All, ULPIN, Survey Number, Property ID, Address, Location"
        >
          <option value="ALL" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>Search All</option>
          <option value="ULPIN" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>ULPIN</option>
          <option value="SURVEY_NO" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>Survey Number</option>
          <option value="PROPERTY_ID" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>Property / Building ID</option>
          <option value="ADDRESS" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>Address</option>
          <option value="LOCATION" style={{ background: "#FFFFFF", color: "#2C2C2C" }}>Location</option>
        </select>

        <Search style={{ width: "15px", height: "15px", color: "#162F6A", marginRight: "6px", flexShrink: 0 }} />

        <input
          ref={inputRef}
          type="text"
          data-testid="global-property-search"
          aria-label="Search ULPIN, survey number, property or address..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || error) {
              setIsOpen(true);
            }
          }}
          placeholder="Search ULPIN, survey number, property or address..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#2C2C2C",
            fontSize: "11px",
            fontWeight: 500,
            minWidth: 0,
            textOverflow: "ellipsis",
            fontFamily: searchMode === "ULPIN" ? "var(--font-mono)" : "inherit",
          }}
        />

        {isLoading ? (
          <Loader2
            style={{
              width: "13px",
              height: "13px",
              color: "var(--signal-cyan)",
              animation: "spin 1s linear infinite",
              flexShrink: 0,
            }}
          />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
            title="Clear search"
          >
            <X style={{ width: "13px", height: "13px" }} />
          </button>
        ) : null}
      </div>

      {/* Results Dropdown: Appears ONLY when actively searched */}
      {isOpen && (isLoading || error || results.length > 0 || (hasSearched && query.trim().length >= 2)) && (
        <div
          data-testid="search-results-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            width: "100%",
            background: "#FFFFFF",
            border: "1px solid #D9DDE5",
            borderRadius: "4px",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          {/* Loading state */}
          {isLoading && results.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Loader2 style={{ width: "13px", height: "13px", color: "#FFA62B", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "0.72rem", color: "#82C0CC" }}>Searching cadastral registry & locations...</span>
            </div>
          ) : error ? (
            /* Error state */
            <div style={{ padding: "12px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "#f87171", fontSize: "0.74rem", fontWeight: 600 }}>
                <AlertTriangle style={{ width: "13px", height: "13px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            </div>
          ) : results.length > 0 ? (
            /* Results list */
            <div style={{ padding: "2px 0" }}>
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: "0.62rem",
                  color: "#555555",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid #D9DDE5", backgroundColor: "#EBEAEA",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Matching Results ({results.length})</span>
                <span style={{ color: "#FFA62B", fontWeight: 600 }}>{searchMode}</span>
              </div>

              {results.map((result, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={result.id || idx}
                    data-testid={`search-result-item-${idx}`}
                    onClick={() => handleSelectResult(result)}
                    style={{
                      padding: "6px 8px",
                      cursor: "pointer",
                      background: isSelected ? "#D2DFFF" : "#FFFFFF",
                      borderBottom: "1px solid #EBEAEA",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {result.type === "ULPIN" ? (
                      <Box style={{ width: "14px", height: "14px", color: "#FFA62B", flexShrink: 0 }} />
                    ) : result.type === "SURVEY_NO" ? (
                      <FileText style={{ width: "14px", height: "14px", color: "#555555", flexShrink: 0 }} />
                    ) : result.type === "PROPERTY_ID" ? (
                      <Building2 style={{ width: "14px", height: "14px", color: "#489FB5", flexShrink: 0 }} />
                    ) : (
                      <MapPin style={{ width: "14px", height: "14px", color: "#555555", flexShrink: 0 }} />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          color: isSelected ? "#162F6A" : "#2C2C2C",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {result.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.66rem",
                          color: "#555555",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: "1px",
                        }}
                      >
                        {result.subtitle}
                        {selectedParcel && (result.parcel?.id === selectedParcel.id || (result.ulpin && result.ulpin === selectedParcel.ulpin_2d)) ? (
                          <span style={{ color: "#FFA62B", marginLeft: "6px", fontWeight: 700 }}>· Active</span>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                      {onOpenPropertyRegistry && (result.type === "ULPIN" || result.type === "PROPERTY_ID" || result.type === "SURVEY_NO") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (result.parcel && onSelectParcel) {
                              onSelectParcel(result.parcel);
                            }
                            setIsOpen(false);
                            onOpenPropertyRegistry();
                          }}
                          style={{
                            background: "rgba(255, 166, 43, 0.15)",
                            border: "1px solid rgba(255, 166, 43, 0.4)",
                            color: "#FFA62B",
                            borderRadius: "3px",
                            padding: "1px 5px",
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          title="Inspect in 3D Property Registry"
                          data-testid={`search-result-registry-btn-${idx}`}
                        >
                          Registry
                        </button>
                      )}
                      <span
                        style={{
                          background: "rgba(10, 42, 50, 0.6)",
                          color: result.badgeColor || "#82C0CC",
                          border: `1px solid ${result.badgeColor ? `${result.badgeColor}40` : "rgba(130, 192, 204, 0.3)"}`,
                          borderRadius: "3px",
                          padding: "1px 5px",
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* No results state */
            <div style={{ padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.74rem", color: "#FFA62B", fontWeight: 600, marginBottom: "2px" }}>
                No matching results found
              </div>
              <div style={{ fontSize: "0.66rem", color: "#82C0CC" }}>
                Check spelling or try switching mode (e.g. Search All, ULPIN, Address)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
