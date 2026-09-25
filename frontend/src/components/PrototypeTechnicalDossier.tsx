import React from "react";
import type { PrototypeTechnicalReviewDossier } from "../types/cadastre";

interface PrototypeTechnicalDossierProps {
  dossier: PrototypeTechnicalReviewDossier;
  onClose: () => void;
}

export const PrototypeTechnicalDossier: React.FC<PrototypeTechnicalDossierProps> = ({
  dossier,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "badge-verified";
      case "UNDER_REVIEW":
        return "badge-review";
      case "REJECTED":
        return "badge-rejected";
      default:
        return "badge-proposed";
    }
  };

  const getConfidenceBadgeClass = (level: string) => {
    switch (level) {
      case "HIGH":
        return "badge-high";
      case "MEDIUM":
        return "badge-medium";
      case "LOW":
        return "badge-low";
      default:
        return "badge-unknown";
    }
  };

  return (
    <div className="dossier-modal-overlay">
      <div className="dossier-container">
        {/* ACTION BAR (Hidden in print) */}
        <div className="dossier-actions no-print">
          <div className="dossier-actions-title">
            <span className="prototype-tag">SIH26011 RESEARCH PROTOTYPE</span>
            <strong>Technical Review Dossier Viewer</strong>
          </div>
          <div className="dossier-actions-buttons">
            <button
              type="button"
              className="dossier-btn-print"
              onClick={handlePrint}
              title="Print or Save as PDF"
            >
              🖨️ Print / Save as PDF
            </button>
            <button
              type="button"
              className="dossier-btn-close"
              onClick={onClose}
              title="Close Dossier"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* PRINTABLE DOSSIER CONTENT */}
        <div className="dossier-sheet" id="dossier-printable-area">
          {/* TOP HEADER */}
          <header className="dossier-header">
            <div className="dossier-header-top">
              <div>
                <span className="dossier-org">GOVERNMENT RESEARCH PROTOTYPE — SIH26011</span>
                <h1 className="dossier-main-title">3D Cadastral Technical Review Dossier</h1>
                <span className="dossier-subtitle">
                  Multi-Source Evidence Fusion, 3D Polyhedral Topology QC & Review Provenance
                </span>
              </div>
              <div className="dossier-meta-box">
                <div><strong>Dossier Version:</strong> {dossier.dossier_version}</div>
                <div><strong>Generated:</strong> {new Date(dossier.generated_at).toISOString().replace("T", " ").substring(0, 19)} UTC</div>
                <div><strong>CRS:</strong> {dossier.geometry_summary.crs}</div>
              </div>
            </div>

            {/* PROTOTYPE NOTICE */}
            <div className="dossier-prototype-warning">
              <strong>⚠️ RESEARCH PROTOTYPE NOTICE:</strong> {dossier.prototype_notice}
            </div>
          </header>

          {/* UNIT IDENTITY SUMMARY SCORECARD */}
          <section className="dossier-section scorecard-section">
            <div className="scorecard-grid">
              <div className="scorecard-cell">
                <span className="scorecard-label">Prototype 3D Unit ID</span>
                <span className="scorecard-value strong-id">{dossier.unit_identity.prototype_ulpin_3d}</span>
                <span className="scorecard-sub">{dossier.unit_identity.unit_label}</span>
              </div>
              <div className="scorecard-cell">
                <span className="scorecard-label">Lifecycle Status</span>
                <span className={`dossier-badge ${getStatusBadgeClass(dossier.unit_identity.status)}`}>
                  {dossier.unit_identity.status}
                </span>
                <span className="scorecard-sub">{dossier.lifecycle.overall_readiness}</span>
              </div>
              <div className="scorecard-cell">
                <span className="scorecard-label">Evidence Fusion Confidence</span>
                <span className={`dossier-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.overall_confidence)}`}>
                  {dossier.evidence_fusion.overall_confidence}
                </span>
                <span className="scorecard-sub">{dossier.evidence_fusion.overall_confidence_label}</span>
              </div>
              <div className="scorecard-cell">
                <span className="scorecard-label">3D Topology Status</span>
                <span className="dossier-badge badge-valid">
                  {dossier.topology.overall_quality_status}
                </span>
                <span className="scorecard-sub">
                  {dossier.topology.solid_validation.is_solid ? "2-Manifold Solid Valid" : "Solid Attention"}
                </span>
              </div>
            </div>
            <div className="identity-disclaimer">
              ℹ️ {dossier.unit_identity.identifier_notice}
            </div>
          </section>

          {/* SECTION 1: PARCEL & BUILDING CONTEXT */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">1. Cadastral Land Parcel & Building Context</h2>
            <div className="two-col-grid">
              <div className="dossier-card">
                <h3>Parent Land Parcel</h3>
                <table className="dossier-table compact">
                  <tbody>
                    <tr>
                      <th>2D Parcel ULPIN:</th>
                      <td><code>{dossier.parcel.ulpin_2d}</code></td>
                    </tr>
                    <tr>
                      <th>Survey Number:</th>
                      <td>{dossier.parcel.survey_number}</td>
                    </tr>
                    <tr>
                      <th>District / State:</th>
                      <td>{dossier.parcel.district}, {dossier.parcel.state}</td>
                    </tr>
                    <tr>
                      <th>Village Code:</th>
                      <td>{dossier.parcel.village_code || "N/A"}</td>
                    </tr>
                    <tr>
                      <th>Parcel Area:</th>
                      <td>{dossier.parcel.area_sqm.toLocaleString()} m²</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="dossier-card">
                <h3>Associated Building Envelope</h3>
                <table className="dossier-table compact">
                  <tbody>
                    <tr>
                      <th>Building Code:</th>
                      <td>{dossier.building.building_code || "N/A"}</td>
                    </tr>
                    <tr>
                      <th>Building Name:</th>
                      <td>{dossier.building.building_name || "N/A"}</td>
                    </tr>
                    <tr>
                      <th>Floors Above Ground:</th>
                      <td>{dossier.building.total_floors_above ?? "N/A"}</td>
                    </tr>
                    <tr>
                      <th>Floors Below Ground:</th>
                      <td>{dossier.building.total_floors_below ?? "N/A"}</td>
                    </tr>
                    <tr>
                      <th>Associated Structure ID:</th>
                      <td><code>{dossier.building.id || "Direct Parcel Attachment"}</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* SECTION 2: MODELED 3D SOLID GEOMETRY */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">2. Modeled 3D Solid Geometry & Spatial Extent</h2>
            <div className="two-col-grid">
              <div className="dossier-card">
                <h3>Vertical Elevation & Dimensions</h3>
                <table className="dossier-table compact">
                  <tbody>
                    <tr>
                      <th>Z Minimum (Floor Level):</th>
                      <td><strong>{dossier.geometry_summary.z_min.toFixed(2)} m</strong></td>
                    </tr>
                    <tr>
                      <th>Z Maximum (Ceiling Level):</th>
                      <td><strong>{dossier.geometry_summary.z_max.toFixed(2)} m</strong></td>
                    </tr>
                    <tr>
                      <th>Modeled Vertical Height:</th>
                      <td><strong>{dossier.geometry_summary.modeled_vertical_height_m.toFixed(2)} m</strong></td>
                    </tr>
                    <tr>
                      <th>Modeled Solid Volume:</th>
                      <td><strong>{dossier.geometry_summary.volume_cbm.toFixed(2)} m³</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="dossier-card">
                <h3>3D Geometric Quality Checks</h3>
                <table className="dossier-table compact">
                  <tbody>
                    <tr>
                      <th>Geometry Representation:</th>
                      <td>PostGIS PolyhedralSurfaceZ</td>
                    </tr>
                    <tr>
                      <th>Solid Watertight Closure:</th>
                      <td>{dossier.geometry_summary.is_closed ? "✓ CLOSED 2-MANIFOLD" : "✗ OPEN MESH"}</td>
                    </tr>
                    <tr>
                      <th>SFCGAL Solid Validity:</th>
                      <td>{dossier.geometry_summary.is_solid ? "✓ VALID 3D SOLID" : "✗ INVALID SOLID"}</td>
                    </tr>
                    <tr>
                      <th>Parcel Footprint Containment:</th>
                      <td>{dossier.geometry_summary.is_within_parcel ? "✓ CONTAINED" : "✗ OUTSIDE PARCEL"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="dossier-notice-box">
              ℹ️ <strong>Modeled Vertical Height Notice:</strong> {dossier.geometry_summary.z_terminology_note}
            </div>
          </section>

          {/* SECTION 3: CADASTRAL VERTICAL STRATA TAXONOMY */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">3. Cadastral Vertical Strata Taxonomy</h2>
            <div className="dossier-card">
              <table className="dossier-table compact">
                <thead>
                  <tr>
                    <th>Taxonomy Strata Category</th>
                    <th>Unit Classification</th>
                    <th>Tier Code</th>
                    <th>Floor Code</th>
                    <th>Unit Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>{dossier.taxonomy.category}</strong> ({dossier.taxonomy.category_label})</td>
                    <td>{dossier.taxonomy.unit_class_label} (<code>{dossier.taxonomy.unit_class}</code>)</td>
                    <td><code>{dossier.unit_identity.tier_code}</code></td>
                    <td><code>{dossier.unit_identity.floor_code}</code></td>
                    <td>{dossier.unit_identity.unit_type}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 4: LIFECYCLE GOVERNANCE & READINESS */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">4. Lifecycle Governance & Review Readiness</h2>
            <div className="dossier-card">
              <div className="readiness-summary-header">
                <div>
                  <strong>Overall Readiness:</strong>{" "}
                  <span className="readiness-tag">{dossier.lifecycle.overall_readiness}</span>
                </div>
                <div className="readiness-counts">
                  <span className="count-pass">Passed: {dossier.lifecycle.passed_count}</span>
                  <span className="count-warn">Warnings: {dossier.lifecycle.warning_count}</span>
                  <span className="count-err">Errors: {dossier.lifecycle.error_count}</span>
                </div>
              </div>

              <table className="dossier-table compact">
                <thead>
                  <tr>
                    <th>Check Item</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Evaluation Details</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.lifecycle.readiness_items.map((item, idx) => (
                    <tr key={idx}>
                      <td><strong>{item.label}</strong> (<code>{item.code}</code>)</td>
                      <td>{item.passed ? "✓ PASSED" : "⚠ ATTENTION"}</td>
                      <td>
                        <span className={`sev-tag sev-${item.severity.toLowerCase()}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="governance-box">
                🔒 <strong>Human Governance Restriction:</strong> {dossier.lifecycle.governance_notice} Permitted roles:{" "}
                {dossier.lifecycle.permitted_verification_roles.join(", ")}.
              </div>
            </div>
          </section>

          {/* SECTION 5: SUPPORTING SOURCE EVIDENCE & LINEAGE */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">5. Supporting Source Evidence & Lineage</h2>
            <div className="dossier-card">
              <div className="evidence-section-intro">
                <span>Total Linked Evidence Datasets: <strong>{dossier.source_evidence.evidence_count}</strong></span>
              </div>

              <table className="dossier-table compact">
                <thead>
                  <tr>
                    <th>Source Type</th>
                    <th>Dataset Name & Reference</th>
                    <th>Sensor Category</th>
                    <th>Horizontal Acc.</th>
                    <th>Vertical Acc.</th>
                    <th>Geometry State</th>
                    <th>Assessment Level</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.source_evidence.evidence_records.map((ev, idx) => (
                    <tr key={idx}>
                      <td><strong>{ev.source_type}</strong></td>
                      <td>
                        <div><strong>{ev.dataset_name}</strong></div>
                        <div className="meta-sub">URI: {ev.file_uri}</div>
                        {ev.sha256_fingerprint && (
                          <div className="meta-sub">
                            SHA-256: <code>{ev.sha256_fingerprint.substring(0, 16)}...</code> ({ev.fingerprint_notice})
                          </div>
                        )}
                      </td>
                      <td>{ev.sensor_category}</td>
                      <td>{ev.accuracy_horizontal_m ? `±${ev.accuracy_horizontal_m} m` : "N/A"}</td>
                      <td>{ev.accuracy_vertical_m ? `±${ev.accuracy_vertical_m} m` : "N/A"}</td>
                      <td>
                        <span className="badge-geom-unavail">UNAVAILABLE</span>
                        <div className="meta-sub">{ev.geometry_notice}</div>
                        {ev.sensor_capability_notice && (
                          <div className="meta-sub warning-text">{ev.sensor_capability_notice}</div>
                        )}
                      </td>
                      <td>
                        <span className={`dossier-badge ${getConfidenceBadgeClass(ev.assessment_level)}`}>
                          {ev.assessment_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {dossier.source_evidence.provenance_pipeline.length > 0 && (
                <div className="provenance-steps-container">
                  <h4>Technical Ingestion Pipeline Lineage:</h4>
                  <ol className="provenance-list">
                    {dossier.source_evidence.provenance_pipeline.map((step, idx) => (
                      <li key={idx}>
                        <strong>Step {step.step_number} ({step.stage}):</strong> {step.name} — <em>{step.details}</em>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="dossier-notice-box">
                ℹ️ {dossier.source_evidence.disclaimer}
              </div>
            </div>
          </section>

          {/* SECTION 6: MULTI-SOURCE EVIDENCE FUSION & CONFIDENCE */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">6. Multi-Source Evidence Fusion & Confidence Breakdown</h2>
            <div className="dossier-card">
              <div className="fusion-header">
                <div>
                  <strong>Overall Technical Confidence:</strong>{" "}
                  <span className={`dossier-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.overall_confidence)}`}>
                    {dossier.evidence_fusion.overall_confidence}
                  </span>{" "}
                  ({dossier.evidence_fusion.overall_confidence_label})
                </div>
                <div className="fusion-method">Method: {dossier.evidence_fusion.assessment_method}</div>
              </div>

              <h4>Decomposable Evidence Dimensions:</h4>
              <div className="dimensions-grid">
                <div className="dimension-card">
                  <span className="dim-label">Source Presence</span>
                  <span className="dim-badge">{dossier.evidence_fusion.dimensions.source_presence}</span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.source_presence_reason}</p>
                </div>
                <div className="dimension-card">
                  <span className="dim-label">Provenance Quality</span>
                  <span className={`dim-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.dimensions.provenance_quality)}`}>
                    {dossier.evidence_fusion.dimensions.provenance_quality}
                  </span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.provenance_quality_reason}</p>
                </div>
                <div className="dimension-card">
                  <span className="dim-label">Geometry Support</span>
                  <span className={`dim-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.dimensions.geometry_support)}`}>
                    {dossier.evidence_fusion.dimensions.geometry_support}
                  </span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.geometry_support_reason}</p>
                </div>
                <div className="dimension-card">
                  <span className="dim-label">Vertical Support</span>
                  <span className={`dim-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.dimensions.vertical_support)}`}>
                    {dossier.evidence_fusion.dimensions.vertical_support}
                  </span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.vertical_support_reason}</p>
                </div>
                <div className="dimension-card">
                  <span className="dim-label">Source Agreement</span>
                  <span className={`dim-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.dimensions.source_agreement)}`}>
                    {dossier.evidence_fusion.dimensions.source_agreement}
                  </span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.source_agreement_reason}</p>
                </div>
                <div className="dimension-card">
                  <span className="dim-label">Evidence Completeness</span>
                  <span className={`dim-badge ${getConfidenceBadgeClass(dossier.evidence_fusion.dimensions.evidence_completeness)}`}>
                    {dossier.evidence_fusion.dimensions.evidence_completeness}
                  </span>
                  <p className="dim-desc">{dossier.evidence_fusion.dimensions.evidence_completeness_reason}</p>
                </div>
              </div>

              {dossier.evidence_fusion.comparisons.length > 0 && (
                <div className="comparisons-container">
                  <h4>Cross-Source Comparison Metrics:</h4>
                  <table className="dossier-table compact">
                    <thead>
                      <tr>
                        <th>Measurement</th>
                        <th>Source A</th>
                        <th>Source B</th>
                        <th>Difference</th>
                        <th>Tolerance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.evidence_fusion.comparisons.map((cmp, idx) => (
                        <tr key={idx}>
                          <td><strong>{cmp.measurement_name}</strong></td>
                          <td>{cmp.source_a_type} ({cmp.source_a_val})</td>
                          <td>{cmp.source_b_type} ({cmp.source_b_val})</td>
                          <td>{cmp.difference} {cmp.unit_of_measure}</td>
                          <td>±{cmp.tolerance} {cmp.unit_of_measure}</td>
                          <td>
                            <span className={`cmp-tag cmp-${cmp.status.toLowerCase()}`}>
                              {cmp.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 7: DISCREPANCY & CONFLICT INSPECTION */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">7. Discrepancy & Conflict Inspection</h2>
            <div className="dossier-card">
              {dossier.evidence_fusion.conflicts.length === 0 ? (
                <div className="no-conflicts-notice">
                  ✓ No unresolved cross-source discrepancies or geometric conflicts detected for this unit.
                </div>
              ) : (
                <div className="conflicts-list">
                  {dossier.evidence_fusion.conflicts.map((c, idx) => (
                    <div key={idx} className={`conflict-card conflict-${c.severity.toLowerCase()}`}>
                      <div className="conflict-card-header">
                        <strong>⚠️ {c.code}</strong>
                        <span className={`sev-tag sev-${c.severity.toLowerCase()}`}>{c.severity}</span>
                      </div>
                      <div className="conflict-card-body">
                        <div><strong>Affected Attribute:</strong> {c.affected_attribute}</div>
                        <div><strong>Source Comparison:</strong> {c.source_a} vs {c.source_b || "Modeled Baseline"}</div>
                        <div><strong>Recommendation:</strong> {c.recommendation}</div>
                        <div className="spatial-reality-notice">
                          ℹ️ <em>Discrepancy detected; exact spatial location is not available from stored evidence geometry.</em>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 8: 3D TOPOLOGY QUALITY-CONTROL */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">8. 3D Topology & Spatial Quality-Control</h2>
            <div className="dossier-card">
              <table className="dossier-table compact">
                <tbody>
                  <tr>
                    <th>SFCGAL Solid Validation:</th>
                    <td>{dossier.topology.solid_validation.details}</td>
                  </tr>
                  <tr>
                    <th>Vertical Continuity:</th>
                    <td>
                      {dossier.topology.vertical_continuity.details || "Direct boundary interface established with adjacent tier."}
                    </td>
                  </tr>
                  <tr>
                    <th>Parent Parcel Containment:</th>
                    <td>{dossier.topology.containment.message}</td>
                  </tr>
                  <tr>
                    <th>Spatial Peer Relationships:</th>
                    <td>
                      {dossier.topology.peer_relationships.length === 0
                        ? "No peer collision relationships (Disjoint / Boundary Contact only)."
                        : `${dossier.topology.peer_relationships.length} peer spatial relationship(s) evaluated.`}
                    </td>
                  </tr>
                  <tr>
                    <th>Collision Overlap Count:</th>
                    <td>
                      {dossier.topology.conflict_count === 0 ? (
                        <strong>0 Positive-Volume Collisions (Clean)</strong>
                      ) : (
                        <strong className="error-text">{dossier.topology.conflict_count} Spatial Collision(s)</strong>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="dossier-notice-box">
                ℹ️ {dossier.topology.disclaimer}
              </div>
            </div>
          </section>

          {/* SECTION 9: EXPLAINABLE AI CANDIDATE INTELLIGENCE */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">9. Explainable AI Candidate Intelligence (Advisory Context)</h2>
            <div className="dossier-card">
              <div className="ai-advisory-box">
                🤖 <strong>Advisory Notice:</strong> {dossier.ai_context.advisory_notice}
              </div>

              {dossier.ai_context.has_analysis && dossier.ai_context.analysis ? (
                <table className="dossier-table compact">
                  <tbody>
                    <tr>
                      <th>Candidate Category:</th>
                      <td>{dossier.ai_context.analysis.candidate_type}</td>
                    </tr>
                    <tr>
                      <th>Proposal Heuristic Score:</th>
                      <td>
                        {dossier.ai_context.analysis.confidence_score.toFixed(2)} ({dossier.ai_context.analysis.confidence})
                      </td>
                    </tr>
                    <tr>
                      <th>Rationale / Explanation:</th>
                      <td>
                        <ul className="inline-list">
                          {dossier.ai_context.analysis.explanation.map((e, idx) => (
                            <li key={idx}>{e}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                    <tr>
                      <th>Underground Safety Check:</th>
                      <td>
                        {dossier.ai_context.analysis.underground_safety?.is_safe
                          ? "✓ Verified underground safety criteria satisfied."
                          : "⚠ Underground safety attention required."}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="muted-text">
                  Direct spatial reconstruction record; standard AI candidate proposal heuristics not attached.
                </p>
              )}
            </div>
          </section>

          {/* SECTION 10: PROTOTYPE AUDIT HISTORY */}
          <section className="dossier-section">
            <h2 className="dossier-section-title">10. Prototype Audit History & Review Decisions</h2>
            <div className="dossier-card">
              <table className="dossier-table compact">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Action</th>
                    <th>Previous Status</th>
                    <th>New Status</th>
                    <th>Reviewer Role</th>
                    <th>Reviewer Name</th>
                    <th>Review Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.review_history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted-text">No audit history transitions recorded yet.</td>
                    </tr>
                  ) : (
                    dossier.review_history.map((a, idx) => (
                      <tr key={idx}>
                        <td>{new Date(a.timestamp).toISOString().replace("T", " ").substring(0, 19)}</td>
                        <td><strong>{a.action}</strong></td>
                        <td>{a.previous_status || "—"}</td>
                        <td><span className={`dossier-badge ${getStatusBadgeClass(a.new_status)}`}>{a.new_status}</span></td>
                        <td>{a.actor_role}</td>
                        <td>{a.reviewer_name || "—"}</td>
                        <td>{a.review_notes || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 11: SYSTEM LIMITATIONS & PROTOTYPE BOUNDARIES */}
          <section className="dossier-section limitations-section">
            <h2 className="dossier-section-title">11. Research Prototype Boundaries & Disclaimers</h2>
            <div className="dossier-card">
              <ol className="limitations-list">
                {dossier.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ol>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="dossier-footer">
            <div className="footer-line">
              <span>SIH26011 3D ULPIN Research Prototype</span>
              <span>•</span>
              <span>Dossier Version {dossier.dossier_version}</span>
              <span>•</span>
              <span>Page generated: {new Date(dossier.generated_at).toUTCString()}</span>
            </div>
            <div className="footer-disclaimer">
              CONFIDENTIAL RESEARCH PROTOTYPE DOCUMENT — NOT FOR LEGAL, STATUTORY, OR TITLE REGISTRATION PURPOSES
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
