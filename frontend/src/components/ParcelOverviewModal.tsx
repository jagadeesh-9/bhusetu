import React, { useEffect, useState } from "react";
import type { Parcel3DOverviewResponse } from "../types/cadastre";
import { fetchParcel3DOverview } from "../api/cadastreApi";

interface ParcelOverviewModalProps {
  parcelId: string;
  onClose: () => void;
}

export const ParcelOverviewModal: React.FC<ParcelOverviewModalProps> = ({ parcelId, onClose }) => {
  const [data, setData] = useState<Parcel3DOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "scorecard" | "consistency" | "buildings">("summary");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchParcel3DOverview(parcelId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load parcel 3D overview");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [parcelId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose} style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(10, 15, 29, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "rgba(17, 24, 39, 0.95)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: "12px",
          padding: "32px 40px",
          textAlign: "center",
          color: "#e2e8f0",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
          position: "relative",
          minWidth: "320px"
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px"
            }}
            title="Close"
          >
            ✕
          </button>
          <div className="spinner" style={{
            width: "36px",
            height: "36px",
            border: "3px solid rgba(59, 130, 246, 0.2)",
            borderTop: "3px solid #3b82f6",
            borderRadius: "50%",
            margin: "0 auto 16px auto",
            animation: "spin 1s linear infinite"
          }} />
          <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem" }}>Loading 3D Dataset Overview...</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>Auditing spatial hierarchy & 12-point consistency checks</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-overlay" style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(10, 15, 29, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}>
        <div style={{
          background: "rgba(17, 24, 39, 0.95)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "480px",
          color: "#e2e8f0"
        }}>
          <h3 style={{ color: "#ef4444", margin: "0 0 12px 0" }}>Error Loading Dataset Overview</h3>
          <p style={{ fontSize: "0.9rem", color: "#cbd5e1", marginBottom: "16px" }}>{error || "Unknown error occurred"}</p>
          <button
            onClick={onClose}
            style={{
              background: "#334155",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { statistics: stats, quality_scorecard: scorecard, consistency_findings: findings } = data;

  const getScorecardColor = (status: string) => {
    switch (status) {
      case "OPTIMAL": return "#10b981";
      case "ATTENTION": return "#f59e0b";
      case "CRITICAL": return "#ef4444";
      default: return "#64748b";
    }
  };

  const getFindingBadge = (status: string, severity: string) => {
    if (status === "PASSED") {
      return <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>PASSED</span>;
    }
    if (severity === "ERROR" || status === "FAILED") {
      return <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>FAILED</span>;
    }
    return <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>WARNING</span>;
  };

  return (
    <div className="modal-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(10, 15, 29, 0.85)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        background: "linear-gradient(180deg, rgba(23, 37, 84, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "14px",
        width: "100%",
        maxWidth: "960px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        color: "#f8fafc",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "rgba(30, 58, 138, 0.3)"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "0.5px" }}>
                Parcel 3D Dataset Overview
              </span>
              <span style={{
                background: "rgba(59, 130, 246, 0.2)",
                color: "#60a5fa",
                border: "1px solid rgba(96, 165, 250, 0.4)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 600
              }}>
                {data.crs}
              </span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              2D ULPIN: <strong style={{ color: "#e2e8f0" }}>{data.parcel_ulpin_2d}</strong> | Survey: {data.survey_number} | {data.district}, {data.state} | Area: {data.area_sqm.toFixed(1)} m²
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#cbd5e1",
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              fontSize: "1.2rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          gap: "8px",
          padding: "10px 24px 0 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(15, 23, 42, 0.5)"
        }}>
          <button
            onClick={() => setActiveTab("summary")}
            style={{
              background: activeTab === "summary" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: activeTab === "summary" ? "#60a5fa" : "#94a3b8",
              border: "none",
              borderBottom: activeTab === "summary" ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            📊 Statistics ({stats.total_units} Units)
          </button>
          <button
            onClick={() => setActiveTab("scorecard")}
            style={{
              background: activeTab === "scorecard" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: activeTab === "scorecard" ? "#60a5fa" : "#94a3b8",
              border: "none",
              borderBottom: activeTab === "scorecard" ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🎯 Quality Scorecard ({scorecard.overall_status})
          </button>
          <button
            onClick={() => setActiveTab("consistency")}
            style={{
              background: activeTab === "consistency" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: activeTab === "consistency" ? "#60a5fa" : "#94a3b8",
              border: "none",
              borderBottom: activeTab === "consistency" ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🔍 12-Point Consistency Audit
          </button>
          <button
            onClick={() => setActiveTab("buildings")}
            style={{
              background: activeTab === "buildings" ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: activeTab === "buildings" ? "#60a5fa" : "#94a3b8",
              border: "none",
              borderBottom: activeTab === "buildings" ? "2px solid #3b82f6" : "2px solid transparent",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🏢 Buildings ({data.buildings.length})
          </button>
        </div>

        {/* Tab Content Container */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Top Stats Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Total 3D Units</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#60a5fa", marginTop: "4px" }}>{stats.total_units}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>Across {stats.total_buildings} building(s)</div>
                </div>
                <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Modeled 3D Volume</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>{stats.total_modeled_volume_cbm.toLocaleString(undefined, { maximumFractionDigits: 1 })} m³</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>Sum of individual modeled solid volumes</div>
                </div>
                <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Vertical Span</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fbbf24", marginTop: "4px" }}>{stats.elevation_extent.total_height_m.toFixed(1)} m</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>{stats.elevation_extent.z_min.toFixed(1)}m to {stats.elevation_extent.z_max.toFixed(1)}m Z</div>
                </div>
                <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Domain Distribution</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#e2e8f0", marginTop: "4px" }}>
                    {stats.underground_units_count} Sub / {stats.above_ground_units_count} Above
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>Synthetic ground datum reference (+540.0m Z)</div>
                </div>
              </div>

              {/* Status & Taxonomy Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Lifecycle Statuses */}
                <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "16px" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#93c5fd" }}>Lifecycle Status Breakdown</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Object.entries(stats.status_counts).map(([st, count]) => {
                      const colorMap: Record<string, string> = {
                        VERIFIED: "#10b981",
                        UNDER_REVIEW: "#3b82f6",
                        PROPOSED: "#f59e0b",
                        REJECTED: "#ef4444"
                      };
                      const color = colorMap[st] || "#94a3b8";
                      const pct = Math.round((count / stats.total_units) * 100);
                      return (
                        <div key={st}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{st}</span>
                            <span style={{ color: "#94a3b8" }}>{count} units ({pct}%)</span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Taxonomy Distribution */}
                <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "8px", padding: "16px" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#93c5fd" }}>Vertical Taxonomy Distribution</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Object.entries(stats.taxonomy_counts).map(([tax, count]) => {
                      const pct = Math.round((count / stats.total_units) * 100);
                      return (
                        <div key={tax}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{tax}</span>
                            <span style={{ color: "#94a3b8" }}>{count} units ({pct}%)</span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", borderRadius: "3px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Research Disclaimer */}
              <div style={{ background: "rgba(30, 58, 138, 0.2)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.8rem", color: "#94a3b8" }}>
                ℹ️ <strong>System Note:</strong> {data.disclaimer}
              </div>
            </div>
          )}

          {/* TAB 2: SCORECARD */}
          {activeTab === "scorecard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(30, 41, 59, 0.7)",
                border: `1px solid ${getScorecardColor(scorecard.overall_status)}40`,
                borderRadius: "8px",
                padding: "16px"
              }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>Dataset Spatial Quality Health</h3>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    Evaluated across {scorecard.geometry_total} vertical unit geometries (Prototype UI classification thresholds)
                  </div>
                </div>
                <div style={{
                  background: `${getScorecardColor(scorecard.overall_status)}20`,
                  color: getScorecardColor(scorecard.overall_status),
                  border: `1px solid ${getScorecardColor(scorecard.overall_status)}60`,
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  letterSpacing: "0.5px"
                }}>
                  {scorecard.overall_status}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {scorecard.scorecard_items.map((item) => (
                  <div key={item.metric_key} style={{
                    background: "rgba(30, 41, 59, 0.5)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    padding: "14px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#e2e8f0" }}>{item.metric_name}</span>
                      <span style={{
                        color: getScorecardColor(item.status),
                        fontWeight: 700,
                        fontSize: "0.85rem"
                      }}>
                        {item.pass_rate_percent}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                      <div style={{
                        width: `${item.pass_rate_percent}%`,
                        height: "100%",
                        background: getScorecardColor(item.status),
                        borderRadius: "3px"
                      }} />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {item.details} ({item.passed_count}/{item.total_count})
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "rgba(30, 58, 138, 0.2)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "8px", padding: "10px 14px", fontSize: "0.75rem", color: "#94a3b8" }}>
                ℹ️ <strong>Scorecard Note:</strong> Status thresholds (OPTIMAL ≥95%, ATTENTION 80-94%, CRITICAL &lt;80%) are prototype UI classification thresholds for analytical visualization. They do not constitute statutory or legal certification standards.
              </div>
            </div>
          )}

          {/* TAB 3: 12-POINT CONSISTENCY AUDIT */}
          {activeTab === "consistency" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "4px" }}>
                Automated 12-point integrity matrix checking SRID conformance, vertical continuity, metadata boundaries, orphan units, and spatial duplicate identities.
              </div>
              <div style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(15, 23, 42, 0.8)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>Check ID & Rule</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, width: "100px" }}>Status</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, width: "100px" }}>Affected</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>Findings & Diagnostics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f, idx) => (
                      <tr key={f.check_id} style={{
                        borderBottom: idx === findings.length - 1 ? "none" : "1px solid rgba(255, 255, 255, 0.05)",
                        background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.02)"
                      }}>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{f.title}</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>{f.check_id}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {getFindingBadge(f.status, f.severity)}
                        </td>
                        <td style={{ padding: "10px 14px", color: f.affected_count > 0 ? "#f59e0b" : "#94a3b8", fontWeight: f.affected_count > 0 ? 600 : 400 }}>
                          {f.affected_count} unit(s)
                        </td>
                        <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                          {f.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BUILDINGS */}
          {activeTab === "buildings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.buildings.map((b) => (
                <div key={b.id} style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0" }}>{b.building_name}</span>
                      <span style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {b.building_code}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "4px" }}>
                      Floors: {b.total_floors_above} above ground | {b.total_floors_below} basement/subterranean
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#34d399" }}>{b.unit_count}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>3D Units Attached</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Audited at: {new Date(data.audited_at).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
