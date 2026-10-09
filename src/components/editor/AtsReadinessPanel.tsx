"use client";

import { useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { lintResumeDocument, type AtsLintIssue } from "@/lib/linter/ats-linter";
import { extractAtsPlainText, auditAtsExtraction } from "@/lib/linter/ats-plain-text";
import {
  ROLE_BENCHMARKS,
  analyzeResumeForRole,
  detectAppliedRoleFromDocument,
  type RoleAnalysisResult,
  type RoleBenchmark,
} from "@/lib/linter/role-analyzer";

function getShortTitle(bench?: RoleBenchmark): string {
  if (!bench) return "Role";
  if (bench.id === "software-architect") return "Architect";
  if (bench.id === "devops-engineer") return "DevOps";
  if (bench.id === "product-designer") return "Designer";
  if (bench.id === "marketing-lead") return "Marketing";
  if (bench.id === "business-analyst") return "Business Analyst";
  if (bench.id === "data-engineer") return "Data Engineer";
  if (bench.id === "product-manager") return "Product Manager";
  if (bench.id === "project-manager") return "Project Manager";
  if (bench.id === "software-engineer") return "Software Engineer";
  return bench.title.split("/")[0].trim();
}

export interface AtsReadinessPanelProps {
  doc: ResumeDocument;
  onNavigateToIssue?: (issue: AtsLintIssue) => void;
  onAddSkill?: (skill: string) => void;
  onClose: () => void;
}

export function AtsReadinessPanel({
  doc,
  onNavigateToIssue,
  onAddSkill,
  onClose,
}: AtsReadinessPanelProps) {
  useBodyScrollLock(true);

  // Automatically detect the applied role from the CV's headline, name, experience, or skills
  const appliedRole = useMemo(() => detectAppliedRoleFromDocument(doc), [doc]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(appliedRole.roleId);
  const [activeTab, setActiveTab] = useState<"role" | "issues" | "plaintext">("role");
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const [addedSkills, setAddedSkills] = useState<Set<string>>(new Set());

  // Keep selected role synchronized when document or detected applied role changes
  useEffect(() => {
    setSelectedRoleId(appliedRole.roleId);
  }, [doc.id, appliedRole.roleId]);

  const report = useMemo(() => lintResumeDocument(doc), [doc]);
  const plainText = useMemo(() => extractAtsPlainText(doc), [doc]);
  const audit = useMemo(() => auditAtsExtraction(doc), [doc]);
  const roleAnalysis: RoleAnalysisResult = useMemo(
    () =>
      analyzeResumeForRole(
        doc,
        selectedRoleId,
        selectedRoleId === appliedRole.roleId ? appliedRole.detectedHeadline : undefined,
      ),
    [doc, selectedRoleId, appliedRole.roleId, appliedRole.detectedHeadline],
  );

  function getScoreClass(s: number) {
    if (s >= 80) return "score-high";
    if (s >= 60) return "score-mid";
    return "score-low";
  }

  function handleAddSkill(skill: string) {
    if (onAddSkill) {
      onAddSkill(skill);
      setAddedSkills((prev) => new Set(prev).add(skill));
    }
  }

  async function handleCopyExample(example: string, key: string) {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(key);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-label="ATS Readiness Audit">
      <div className="modal-card ats-modal" style={{ maxWidth: "860px" }}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">QUALITY, ATS & ROLE BENCHMARK AUDIT</p>
            <h2>CV Analyzer & Role Gap Inspector</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        <div className="ats-content">
          {/* Top ATS Readiness Hero */}
          <div className="ats-score-hero" style={{ marginBottom: "16px" }}>
            <div className={`ats-score-circle ${getScoreClass(report.score)}`}>
              <span className="big-score">{report.score}%</span>
              <span className="score-desc">ATS Readiness</span>
            </div>
            <div className="ats-metrics-breakdown">
              <div className="ats-metric-tile">
                <span className="metric-name">Active Verbs</span>
                <span className="metric-val">{report.verbsScore}%</span>
                <span className="metric-sub">{report.strongVerbsCount}/{report.totalBulletsCount} bullets</span>
              </div>
              <div className="ats-metric-tile">
                <span className="metric-name">Quantified Impact</span>
                <span className="metric-val">{report.metricsScore}%</span>
                <span className="metric-sub">{report.metricsCount}/{report.totalBulletsCount} bullets</span>
              </div>
              <div className="ats-metric-tile">
                <span className="metric-name">Formatting & Hygiene</span>
                <span className="metric-val">{report.hygieneScore}%</span>
                <span className="metric-sub">Dates & Contact</span>
              </div>
              <div className="ats-metric-tile">
                <span className="metric-name">Extraction Purity</span>
                <span className="metric-val">{report.extractionScore}%</span>
                <span className="metric-sub">Strict Reading Order</span>
              </div>
            </div>
          </div>

          {/* Main Top Navigation Tabs */}
          <div className="tailor-tabs" style={{ marginBottom: "16px" }}>
            <button
              type="button"
              className={activeTab === "role" ? "active" : ""}
              onClick={() => setActiveTab("role")}
            >
              🎯 Role Benchmark ({roleAnalysis.overallScore}%)
            </button>
            <button
              type="button"
              className={activeTab === "issues" ? "active" : ""}
              onClick={() => setActiveTab("issues")}
            >
              Actionable Recommendations ({report.issues.length})
            </button>
            <button
              type="button"
              className={activeTab === "plaintext" ? "active" : ""}
              onClick={() => setActiveTab("plaintext")}
            >
              Robot Plain-Text View
            </button>
          </div>

          <div className="tab-body">
            {/* TAB 1: ROLE BENCHMARK & GAP ANALYZER */}
            {activeTab === "role" && (
              <div className="role-analyzer-stage">
                {/* Applied CV Role Banner */}
                <div className="applied-role-banner">
                  <div className="applied-role-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className="applied-role-badge">🎯 Applied CV Role</span>
                      <span className="applied-source-badge">
                        From {appliedRole.source} ({appliedRole.confidence})
                      </span>
                    </div>
                    <strong className="applied-role-name">
                      {appliedRole.detectedHeadline || ROLE_BENCHMARKS[appliedRole.roleId]?.title}
                    </strong>
                    <span className="applied-role-meta">
                      Analysis is calibrated to your applied role ({ROLE_BENCHMARKS[appliedRole.roleId]?.title}).
                    </span>
                  </div>
                  {selectedRoleId !== appliedRole.roleId && (
                    <button
                      type="button"
                      className="revert-role-btn"
                      onClick={() => setSelectedRoleId(appliedRole.roleId)}
                      title="Return evaluation to your CV's applied role"
                    >
                      ↺ Reset to Applied Role ({ROLE_BENCHMARKS[appliedRole.roleId]?.title.split("/")[0].trim()})
                    </button>
                  )}
                </div>

                {/* Role Selector Header */}
                <div className="role-selector-bar">
                  <div className="role-selector-group">
                    <label htmlFor="target-role-select">Target Benchmark Role:</label>
                    <select
                      id="target-role-select"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="role-dropdown"
                    >
                      {Object.values(ROLE_BENCHMARKS).map((bench) => (
                        <option key={bench.id} value={bench.id}>
                          {bench.id === appliedRole.roleId ? `★ ${bench.title} (Applied on CV)` : bench.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="role-quick-chips">
                    <button
                      type="button"
                      className={`role-chip-btn applied-chip ${selectedRoleId === appliedRole.roleId ? "active" : ""}`}
                      onClick={() => setSelectedRoleId(appliedRole.roleId)}
                      title={`Applied on CV: ${appliedRole.detectedHeadline}`}
                    >
                      🎯 {getShortTitle(ROLE_BENCHMARKS[appliedRole.roleId])} (Applied)
                    </button>
                    {Object.values(ROLE_BENCHMARKS)
                      .filter((b) => b.id !== appliedRole.roleId)
                      .slice(0, 3)
                      .map((bench) => (
                        <button
                          key={bench.id}
                          type="button"
                          className={`role-chip-btn ${selectedRoleId === bench.id ? "active" : ""}`}
                          onClick={() => setSelectedRoleId(bench.id)}
                        >
                          {getShortTitle(bench)}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Role Fit Sub-Hero */}
                <div className="role-section-card" style={{ background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                          Role Benchmark Evaluation
                        </span>
                        {selectedRoleId === appliedRole.roleId ? (
                          <span style={{ fontSize: "11px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                            ✓ CV Applied Role
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                            Comparing Alternate Role
                          </span>
                        )}
                      </div>
                      <h3 style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: 700 }}>
                        {roleAnalysis.roleTitle} Fit: <span style={{ color: roleAnalysis.overallScore >= 75 ? "#166534" : "#ea580c" }}>{roleAnalysis.overallScore}%</span>
                      </h3>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: "14px", fontWeight: 600 }}>
                        Detected: {roleAnalysis.detectedSeniority}
                      </span>
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        Skills: {roleAnalysis.competencyScore}% · Metrics: {roleAnalysis.metricScore}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Market Skills Gap Section */}
                <div className="role-section-card">
                  <div className="role-section-head">
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                      Market Skills Match & Gaps ({roleAnalysis.roleTitle})
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      1-click to append missing competencies to your resume
                    </span>
                  </div>

                  {/* Matched Skills */}
                  {roleAnalysis.matchedCompetencies.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <span className="skills-subhead matched-subhead">
                        ✓ Matched in Resume ({roleAnalysis.matchedCompetencies.length})
                      </span>
                      <div className="skills-pill-cloud">
                        {roleAnalysis.matchedCompetencies.map((skill) => (
                          <span key={skill} className="skill-pill matched">
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Skills */}
                  <div>
                    <span className="skills-subhead missing-subhead">
                      ⚠️ Missing High-Demand Market Skills ({roleAnalysis.missingCompetencies.length})
                    </span>
                    {roleAnalysis.missingCompetencies.length === 0 ? (
                      <p className="helper-text" style={{ margin: "4px 0 0" }}>
                        All target competencies for this role are represented in your resume!
                      </p>
                    ) : (
                      <div className="skills-pill-cloud">
                        {roleAnalysis.missingCompetencies.map((skill) => {
                          const isAdded = addedSkills.has(skill);
                          return (
                            <span key={skill} className={`skill-pill missing ${isAdded ? "added" : ""}`}>
                              <span>+ {skill}</span>
                              {onAddSkill && (
                                <button
                                  type="button"
                                  className="add-skill-action-btn"
                                  onClick={() => handleAddSkill(skill)}
                                  disabled={isAdded}
                                  title={`Add ${skill} to resume skills section`}
                                >
                                  {isAdded ? "✓ Added" : "+ Add to Skills"}
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role-Specific Metric Benchmark */}
                <div className="role-section-card" style={{ marginTop: "14px" }}>
                  <div className="role-section-head">
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                      Role Metric Benchmarks & Google XYZ Templates
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Quantifiable proof expected by hiring managers
                    </span>
                  </div>

                  <div className="metric-benchmark-list">
                    {/* Matched Metrics */}
                    {roleAnalysis.matchedMetricTypes.map((m) => (
                      <div key={m} className="metric-benchmark-item matched">
                        <div className="metric-benchmark-status">
                          <span className="status-icon">✓</span>
                          <strong>{m}</strong>
                        </div>
                        <span className="matched-note">Verified present in bullet achievements</span>
                      </div>
                    ))}

                    {/* Missing Metrics with copyable examples */}
                    {roleAnalysis.missingMetricTypes.map((m) => {
                      const isCopied = copiedExample === m.name;
                      return (
                        <div key={m.name} className="metric-benchmark-item missing">
                          <div className="metric-benchmark-status">
                            <span className="status-icon">⚠️</span>
                            <strong>{m.name}</strong>
                            <span className="missing-tag">Missing</span>
                          </div>
                          <p className="metric-desc">{m.description}</p>
                          <div className="metric-example-box">
                            <span className="example-label">Example XYZ formula:</span>
                            <p className="example-text">“{m.example}”</p>
                            <button
                              type="button"
                              className="copy-example-btn"
                              onClick={() => handleCopyExample(m.example, m.name)}
                            >
                              {isCopied ? "✓ Copied" : "📋 Copy Template"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actionable Insights */}
                {roleAnalysis.actionableInsights.length > 0 && (
                  <div className="role-section-card" style={{ marginTop: "14px" }}>
                    <div className="role-section-head">
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                        High-Impact Recommendations for {roleAnalysis.roleTitle}
                      </h3>
                    </div>
                    <ul className="ats-issue-list" style={{ marginTop: "10px" }}>
                      {roleAnalysis.actionableInsights.map((insight) => (
                        <li key={insight.id} className={`ats-issue-card ${insight.severity === "high" ? "critical" : insight.severity === "medium" ? "warning" : "suggestion"}`}>
                          <div className="issue-head">
                            <span className={`severity-badge ${insight.severity === "high" ? "critical" : insight.severity === "medium" ? "warning" : "suggestion"}`}>
                              {insight.type.toUpperCase()}
                            </span>
                            <p className="issue-msg">{insight.title}</p>
                          </div>
                          <p className="issue-suggestion" style={{ marginTop: "4px" }}>
                            {insight.message}
                          </p>
                          {insight.suggestion && (
                            <p className="issue-suggestion" style={{ color: "var(--ink)", fontWeight: 500, marginTop: "4px" }}>
                              💡 {insight.suggestion}
                            </p>
                          )}
                          {insight.skillToAdd && onAddSkill && (
                            <div style={{ marginTop: "8px" }}>
                              <button
                                type="button"
                                className="add-skill-action-btn"
                                onClick={() => handleAddSkill(insight.skillToAdd!)}
                                disabled={addedSkills.has(insight.skillToAdd!)}
                              >
                                {addedSkills.has(insight.skillToAdd!) ? "✓ Added" : `+ Add "${insight.skillToAdd}" to Skills`}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACTIONABLE RECOMMENDATIONS & ATS RULES */}
            {activeTab === "issues" && (
              <div>
                {report.issues.length === 0 ? (
                  <div className="all-clear-banner">
                    <span className="check-icon">✓</span>
                    <div>
                      <h4>All Quality Checks Passed</h4>
                      <p>
                        Your resume has high active verb density, quantified accomplishment metrics,
                        clean date formatting, and 100% linear ATS text extraction.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="ats-issue-list">
                    {report.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`ats-issue-card ${issue.severity}`}
                        onClick={() => onNavigateToIssue?.(issue)}
                      >
                        <div className="issue-head">
                          <span className={`severity-badge ${issue.severity}`}>
                            {issue.severity.toUpperCase()}
                          </span>
                          <p className="issue-msg">{issue.message}</p>
                        </div>
                        {issue.suggestion && (
                          <p className="issue-suggestion">💡 {issue.suggestion}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* TAB 3: ROBOT PLAIN-TEXT SIMULATION */}
            {activeTab === "plaintext" && (
              <div className="ats-plaintext-stage">
                <p className="helper-text">
                  This simulates the flat UTF-8 text stream extracted by applicant tracking systems
                  (Workday, Taleo, Greenhouse). It confirms section headings, contact details, and
                  reading order are never scrambled by visual columns.
                </p>
                {audit.diagnostics.length > 0 && (
                  <div className="audit-diagnostics-box">
                    {audit.diagnostics.map((d, i) => (
                      <p key={i}>⚠️ {d}</p>
                    ))}
                  </div>
                )}
                <pre className="plaintext-terminal">{plainText}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="button-row ats-modal-footer">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
