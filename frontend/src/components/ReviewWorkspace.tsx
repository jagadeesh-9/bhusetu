import React, { useState, useEffect } from "react";
import type {
  UnitReviewCaseResponse,
  VerticalUnitTransitionRequest,
  VerticalUnit
} from "../types/cadastre";
import { fetchUnitReviewCase, transitionUnitStatus } from "../api/cadastreApi";

interface ReviewWorkspaceProps {
  unitId: string;
  onClose: () => void;
  onStatusChanged?: (updatedUnit: VerticalUnit) => void;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({
  unitId,
  onClose,
  onStatusChanged
}) => {
  const [reviewCase, setReviewCase] = useState<UnitReviewCaseResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"readiness" | "topology" | "evidence" | "audit">("readiness");

  // Decision Form State
  const [actorRole, setActorRole] = useState<"HUMAN_REVIEWER" | "LICENSED_SURVEYOR" | "REVENUE_OFFICIAL">("LICENSED_SURVEYOR");
  const [reviewerName, setReviewerName] = useState<string>("Authorized Cadastral Officer");
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [rejectionCode, setRejectionCode] = useState<"GEOMETRY_INVALID" | "SPATIAL_CONFLICT" | "INSUFFICIENT_EVIDENCE" | "INCORRECT_VERTICAL_BOUNDARY" | "INCORRECT_UNIT_TYPE" | "OTHER">("SPATIAL_CONFLICT");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadCase = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUnitReviewCase(unitId);
      setReviewCase(data);
    } catch (err: any) {
      setError(err.message || "Failed to load 3D review case dossier.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [unitId]);

  const handleTransition = async (targetStatus: string) => {
    if (!reviewCase) return;
    setSubmitting(true);
    setActionSuccessMessage(null);
    setError(null);

    const req: VerticalUnitTransitionRequest = {
      new_status: targetStatus,
      actor_role: actorRole,
      reviewer_name: reviewerName.trim() || undefined,
      review_notes: reviewNotes.trim() || undefined,
      rejection_reason_code: targetStatus === "REJECTED" ? rejectionCode : undefined
    };

    try {
      const updated = await transitionUnitStatus(unitId, req);
      setActionSuccessMessage(`Successfully transitioned status to ${targetStatus}.`);
      setReviewNotes("");
      if (onStatusChanged) {
        onStatusChanged(updated);
      }
      // Reload updated dossier
      await loadCase();
    } catch (err: any) {
      setError(err.message || `Failed to transition unit status.`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
      case "UNDER_REVIEW":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
      case "REJECTED":
        return "bg-rose-500/20 text-rose-400 border border-rose-500/40";
      case "PROPOSED":
      default:
        return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
    }
  };

  const getReadinessBanner = (readiness: string) => {
    switch (readiness) {
      case "READY_FOR_HUMAN_REVIEW":
        return {
          bg: "bg-emerald-950/40 border-emerald-500/50 text-emerald-300",
          title: "Computational Checks Passed",
          desc: "All PostGIS/SFCGAL solid geometry, positive volume, parcel containment, and peer topology checks are clear."
        };
      case "REVIEW_REQUIRES_ATTENTION":
        return {
          bg: "bg-amber-950/40 border-amber-500/50 text-amber-300",
          title: "Attention Required During Review",
          desc: "Spatial collisions, parcel boundary overhang, or missing multi-source evidence detected. Reviewer must inspect findings."
        };
      case "BLOCKED_INVALID_GEOMETRY":
      default:
        return {
          bg: "bg-rose-950/40 border-rose-500/50 text-rose-300",
          title: "Blocked: Invalid Solid Geometry",
          desc: "SFCGAL solid watertightness failure or zero/inverted volume. Candidate cannot be verified in present geometry."
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop-command">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col modal-dialog-command overflow-hidden"
        style={{
          background: "var(--deep-panel)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div
          className="modal-header-command"
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(22, 37, 92, 0.6)",
                border: "1px solid var(--color-border-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-accent)",
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">3D Property Review & Decision Workspace</h2>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(22, 37, 92, 0.8)",
                    color: "var(--color-accent)",
                    border: "1px solid rgba(224, 169, 60, 0.3)",
                  }}
                >
                  Phase 3.1
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Authoritative human decision gate & spatial quality dossier for 3D cadastral units
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {reviewCase && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "4px",
                  letterSpacing: "0.05em",
                }}
                className={getStatusBadgeClass(reviewCase.status)}
              >
                {reviewCase.status}
              </span>
            )}
            <button
              onClick={onClose}
              className="btn-technical secondary"
              style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Close Workspace"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--signal-cyan)] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Aggregating 3D solid geometry, topology QC, evidence & audit dossier...</p>
          </div>
        )}

        {error && !loading && (
          <div className="m-6 p-4 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-300 text-sm">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Error
            </div>
            {error}
          </div>
        )}

        {actionSuccessMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-sm flex items-center justify-between">
            <span>{actionSuccessMessage}</span>
            <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Content */}
        {!loading && reviewCase && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Dossier Meta Summary Banner */}
            <div
              style={{
                backgroundColor: "var(--deep-background)",
                borderBottom: "1px solid var(--border-color)",
                padding: "10px 20px",
              }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
            >
              <div>
                <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Prototype 3D ULPIN</span>
                <span className="font-mono font-bold text-[var(--color-accent)]">{reviewCase.prototype_ulpin_3d}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Parent Parcel / Building</span>
                <span className="font-mono text-[var(--text-primary)]">{reviewCase.parcel_ulpin_2d} / {reviewCase.building_name || "TOWER-A"}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Floor / Tier / Classification</span>
                <span className="font-semibold text-[var(--text-primary)]">{reviewCase.floor_code} ({reviewCase.tier_code}) • {reviewCase.unit_type}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">Elevation & SFCGAL Volume</span>
                <span className="font-mono text-[var(--state-verified)]">Z: {reviewCase.z_min.toFixed(2)} - {reviewCase.z_max.toFixed(2)}m ({reviewCase.volume_cbm.toFixed(1)} m³)</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                backgroundColor: "var(--deep-panel)",
                borderBottom: "1px solid var(--border-color)",
                padding: "0 20px",
              }}
              className="flex gap-2"
            >
              <button
                onClick={() => setActiveTab("readiness")}
                style={{
                  borderBottom: activeTab === "readiness" ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: activeTab === "readiness" ? "var(--color-accent)" : "var(--text-muted)",
                  padding: "10px 4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Readiness Checklist ({reviewCase.readiness.passed_count}/{reviewCase.readiness.items.length})
              </button>
              <button
                onClick={() => setActiveTab("topology")}
                style={{
                  borderBottom: activeTab === "topology" ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: activeTab === "topology" ? "var(--color-accent)" : "var(--text-muted)",
                  padding: "10px 4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                3D Topology & Conflicts ({reviewCase.topology.conflict_count})
              </button>
              <button
                onClick={() => setActiveTab("evidence")}
                style={{
                  borderBottom: activeTab === "evidence" ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: activeTab === "evidence" ? "var(--color-accent)" : "var(--text-muted)",
                  padding: "10px 4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Evidence & AI Intelligence ({reviewCase.evidence.evidence_count})
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                style={{
                  borderBottom: activeTab === "audit" ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: activeTab === "audit" ? "var(--color-accent)" : "var(--text-muted)",
                  padding: "10px 4px",
                  fontSize: "12px",
                  fontWeight: 700,
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Audit Trail ({reviewCase.audit_history.length})
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: READINESS CHECKLIST */}
              {activeTab === "readiness" && (
                <div className="space-y-4">
                  {/* Banner */}
                  {(() => {
                    const banner = getReadinessBanner(reviewCase.readiness.overall_readiness);
                    return (
                      <div className={`p-4 rounded-xl border ${banner.bg}`}>
                        <div className="font-bold text-sm mb-1">{banner.title}</div>
                        <p className="text-xs opacity-90">{banner.desc}</p>
                      </div>
                    );
                  })()}

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Computational Review Readiness Checklist
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {reviewCase.readiness.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-3 ${
                            item.passed
                              ? "bg-slate-800/40 border-emerald-500/30"
                              : item.severity === "ERROR"
                              ? "bg-rose-950/20 border-rose-500/40"
                              : "bg-amber-950/20 border-amber-500/40"
                          }`}
                        >
                          <div className={`mt-0.5 rounded-full p-1 text-xs font-bold ${
                            item.passed ? "bg-emerald-500/20 text-emerald-400" : item.severity === "ERROR" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                          }`}>
                            {item.passed ? "✓" : "!"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-200">{item.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{item.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TOPOLOGY & CONFLICTS */}
              {activeTab === "topology" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Solid B-Rep Geometry */}
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                        PostGIS / SFCGAL Solid B-Rep Geometry
                      </h4>
                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Watertight (Closed 2-Manifold):</span>
                          <span className="font-mono text-emerald-400">{reviewCase.topology.solid_validation.is_closed ? "YES" : "NO"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Valid SFCGAL Solid:</span>
                          <span className="font-mono text-emerald-400">{reviewCase.topology.solid_validation.is_solid ? "VALID_SOLID" : "INVALID"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Computed Interior Volume:</span>
                          <span className="font-mono text-indigo-300 font-bold">{reviewCase.topology.solid_validation.volume_cbm.toFixed(2)} m³</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Parcel 2D Containment:</span>
                          <span className={`font-mono ${reviewCase.topology.containment.is_within_parcel ? "text-emerald-400" : "text-rose-400"}`}>
                            {reviewCase.topology.containment.is_within_parcel ? "FULLY CONTAINED" : "OUTSIDE BOUNDARY"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vertical Continuity */}
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                        Vertical Continuity & Slab Interfaces
                      </h4>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Interface Relationship:</span>
                          <span className="font-mono text-emerald-400">{reviewCase.topology.vertical_continuity.relation_to_lower_unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Vertical Offset / Gap:</span>
                          <span className="font-mono text-slate-200">{reviewCase.topology.vertical_continuity.gap_or_overlap_m.toFixed(3)} m</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">{reviewCase.topology.vertical_continuity.details}</p>
                      </div>
                    </div>
                  </div>

                  {/* Peer Pairwise Relationships */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pairwise 3D Spatial Relationships with Peer Units
                    </h4>
                    {reviewCase.topology.peer_relationships.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No adjoining peer units detected.</p>
                    ) : (
                      <div className="space-y-2">
                        {reviewCase.topology.peer_relationships.map((rel, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                              rel.relationship_code === "POSITIVE_VOLUME_OVERLAP"
                                ? "bg-rose-950/30 border-rose-500/50 text-rose-200"
                                : rel.relationship_code === "BOUNDARY_CONTACT"
                                ? "bg-slate-800/40 border-slate-700/50 text-slate-300"
                                : "bg-slate-800/20 border-slate-700/30 text-slate-400"
                            }`}
                          >
                            <div>
                              <span className="font-mono font-bold text-indigo-300">{rel.unit_b_ulpin}</span>
                              <span className="mx-2">•</span>
                              <span className="font-semibold">{rel.relationship_code}</span>
                              <p className="text-slate-400 mt-1">{rel.description}</p>
                            </div>
                            {rel.overlap_volume_cbm > 0 && (
                              <div className="text-right">
                                <span className="font-mono font-bold text-rose-400">{rel.overlap_volume_cbm.toFixed(2)} m³ overlap</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: EVIDENCE & AI INTELLIGENCE */}
              {activeTab === "evidence" && (
                <div className="space-y-4">
                  {/* Source Evidence */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Multi-Source Supporting Evidence Records
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {reviewCase.evidence.evidence_records.map((ev, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs space-y-1">
                          <div className="flex justify-between font-semibold text-slate-200">
                            <span>{ev.source_type}</span>
                            <span className="font-mono text-indigo-400">±{ev.accuracy_horizontal_m?.toFixed(2) || "0.05"}m H / ±{ev.accuracy_vertical_m?.toFixed(2) || "0.05"}m V</span>
                          </div>
                          <div className="text-slate-400 font-mono text-[11px] truncate">{ev.file_uri}</div>
                          <p className="text-slate-400">{ev.dataset_name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Candidate Intelligence */}
                  {reviewCase.ai_analysis && (
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-indigo-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          Explainable AI Candidate Proposal Features
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 font-mono">
                          Confidence: {reviewCase.ai_analysis.confidence} ({reviewCase.ai_analysis.confidence_score.toFixed(2)})
                        </span>
                      </div>

                      {/* Explicit Non-Authoritative AI Advisory Banner */}
                      <div className="p-2.5 bg-indigo-950/70 border border-indigo-500/40 rounded-lg text-xs text-indigo-200 flex items-center gap-2">
                        <span className="font-semibold text-indigo-300">Advisory Context:</span>
                        <span>AI proposal is non-authoritative advisory context. Human reviewer must verify independently.</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Density</span>
                          <span className="text-slate-200">{reviewCase.ai_analysis.features.point_density_pts_m3.toFixed(1)} pts/m³</span>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Footprint Area</span>
                          <span className="text-slate-200">{reviewCase.ai_analysis.features.footprint_area_sqm.toFixed(1)} m²</span>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Compactness</span>
                          <span className="text-slate-200">{reviewCase.ai_analysis.features.footprint_compactness.toFixed(2)}</span>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Peak Prominence</span>
                          <span className="text-slate-200">{reviewCase.ai_analysis.features.peak_prominence_ratio.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-slate-300">
                        {reviewCase.ai_analysis.explanation.map((exp, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-400">•</span>
                            <span>{exp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIT TRAIL */}
              {activeTab === "audit" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Verification Audit History
                  </h4>
                  <div className="space-y-2">
                    {reviewCase.audit_history.map((ev, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{ev.action}</span>
                            <span className="text-slate-500">→</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${getStatusBadgeClass(ev.new_status)}`}>
                              {ev.new_status}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-1">{ev.review_notes || "No notes provided."}</p>
                          <div className="text-[11px] text-slate-500 mt-1">
                            By {ev.reviewer_name || "Unknown"} ({ev.actor_role})
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-mono text-slate-500 text-[10px]">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                          {ev.integrity_hash && (
                            <span className="font-mono text-[10px] text-indigo-400 mt-1">
                              SHA256: {ev.integrity_hash.slice(0, 16)}...
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* AUTHORIZED HUMAN DECISION GATE FOOTER */}
            <div
              style={{
                backgroundColor: "var(--void-black)",
                borderTop: "1px solid var(--border-color)",
                padding: "20px 24px",
              }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span>Authorized Human Decision Gate</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "rgba(53, 208, 127, 0.12)",
                        color: "var(--state-verified)",
                        border: "1px solid var(--state-verified)",
                      }}
                    >
                      Single Verification Authority
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Automated tools and AI are candidate proposers only. Verification requires an explicit authorized human official.
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[var(--text-muted)] font-bold text-[10px] uppercase mb-1">Human Official Role</label>
                  <select
                    value={actorRole}
                    onChange={(e: any) => setActorRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--deep-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--signal-cyan)] text-xs"
                  >
                    <option value="LICENSED_SURVEYOR">LICENSED_SURVEYOR (Licensed Cadastral Surveyor)</option>
                    <option value="REVENUE_OFFICIAL">REVENUE_OFFICIAL (Revenue Department Officer)</option>
                    <option value="HUMAN_REVIEWER">HUMAN_REVIEWER (Human Verification Reviewer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] font-bold text-[10px] uppercase mb-1">Reviewer Name</label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Official Name..."
                    className="w-full px-3 py-2 bg-[var(--deep-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--signal-cyan)] font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] font-bold text-[10px] uppercase mb-1">Rejection Reason Code (If Rejecting)</label>
                  <select
                    value={rejectionCode}
                    onChange={(e: any) => setRejectionCode(e.target.value)}
                    disabled={reviewCase.status !== "UNDER_REVIEW"}
                    className="w-full px-3 py-2 bg-[var(--deep-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--signal-cyan)] text-xs disabled:opacity-50"
                  >
                    <option value="SPATIAL_CONFLICT">SPATIAL_CONFLICT (3D Overlap / Volumetric Clash)</option>
                    <option value="GEOMETRY_INVALID">GEOMETRY_INVALID (Non-Solid / Non-Watertight)</option>
                    <option value="INSUFFICIENT_EVIDENCE">INSUFFICIENT_EVIDENCE (Missing Source Proof)</option>
                    <option value="INCORRECT_VERTICAL_BOUNDARY">INCORRECT_VERTICAL_BOUNDARY (Elevation Error)</option>
                    <option value="INCORRECT_UNIT_TYPE">INCORRECT_UNIT_TYPE (Classification Mismatch)</option>
                    <option value="OTHER">OTHER (Administrative Objection)</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Review Notes / Technical Justification (mandatory for rejection)..."
                  className="w-full px-3 py-2 bg-[var(--deep-background)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--signal-cyan)] text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-[var(--text-muted)] italic font-mono">
                  * All review transitions append prototype SHA256 hashed audit records.
                </div>

                <div className="flex items-center gap-3">
                  {reviewCase.status === "PROPOSED" && (
                    <button
                      onClick={() => handleTransition("UNDER_REVIEW")}
                      disabled={submitting}
                      className="btn-technical secondary"
                      style={{ height: "36px", padding: "0 16px", fontSize: "12px" }}
                    >
                      {submitting ? "Processing..." : "Begin Technical Review"}
                    </button>
                  )}

                  {reviewCase.status === "UNDER_REVIEW" && (
                    <>
                      <button
                        onClick={() => handleTransition("REJECTED")}
                        disabled={submitting}
                        className="btn-technical danger"
                        style={{ height: "36px", padding: "0 16px", fontSize: "12px" }}
                      >
                        {submitting ? "Processing..." : "Reject Candidate"}
                      </button>

                      <button
                        onClick={() => handleTransition("VERIFIED")}
                        disabled={submitting || reviewCase.readiness.overall_readiness === "BLOCKED_INVALID_GEOMETRY"}
                        className="btn-technical primary"
                        style={{ height: "36px", padding: "0 18px", fontSize: "12px" }}
                      >
                        {submitting ? "Processing..." : "Grant Human Verification"}
                      </button>
                    </>
                  )}

                  {(reviewCase.status === "VERIFIED" || reviewCase.status === "REJECTED") && (
                    <span className="text-xs text-[var(--text-muted)] font-mono italic">
                      Unit is in terminal state ({reviewCase.status}). Resubmission creates a new candidate without overwriting history.
                    </span>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
