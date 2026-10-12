"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDiagnostics } from "./FileDiagnostics";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { lintResumeDocument, type AtsLintIssue } from "@/lib/linter/ats-linter";
import { auditAtsExtraction } from "@/lib/linter/ats-plain-text";
import {
  ROLE_BENCHMARKS,
  analyzeResumeForRole,
  detectAppliedRoleFromDocument,
} from "@/lib/linter/role-analyzer";
import { scoreResume } from "@/lib/linter/resume-score";
import { ResumeScoreReport } from "../score/ResumeScoreReport";

export interface AtsReadinessPanelProps {
  doc: ResumeDocument;
  onNavigateToIssue?: (issue: AtsLintIssue) => void;
  /** Jump to the editor section with this id ("contact" for personal details). */
  onNavigateToSection?: (sectionId: string) => void;
  onClose: () => void;
}

export function AtsReadinessPanel({
  doc,
  onNavigateToIssue,
  onNavigateToSection,
  onClose,
}: AtsReadinessPanelProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus(onClose);
  const suggestedRole = useMemo(
    () => detectAppliedRoleFromDocument(doc),
    [doc],
  );
  const [selectedRoleId, setSelectedRoleId] = useState(suggestedRole.roleId);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "score" | "role" | "issues" | "plaintext" | "file"
  >("score");
  const score = useMemo(() => scoreResume(doc), [doc]);
  useEffect(() => {
    setSelectedRoleId(suggestedRole.roleId);
    setRoleConfirmed(false);
  }, [doc.id, suggestedRole.roleId]);
  const report = useMemo(() => lintResumeDocument(doc), [doc]);
  const audit = useMemo(() => auditAtsExtraction(doc), [doc]);
  const role = useMemo(
    () => analyzeResumeForRole(doc, selectedRoleId),
    [doc, selectedRoleId],
  );
  function selectRole(id: string) {
    setSelectedRoleId(id);
    setRoleConfirmed(false);
  }

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Resume content review"
    >
      <div className="modal-card ats-modal" style={{ maxWidth: "860px" }}>
        <header className="modal-header">
          <div>
            <h2>Check your CV</h2>
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
          <p className="review-start-note">
            Start with your <strong>Score</strong>: it explains every point and
            what to fix first. <strong>Writing findings</strong> lists each line
            to improve; <strong>File diagnostics</strong> checks a PDF or Word
            file you exported.
          </p>
          {activeTab !== "file" && activeTab !== "score" && (
            <div className="ats-score-hero" style={{ marginBottom: "16px" }}>
              <div className="ats-score-circle">
                <span className="big-score">{report.issues.length}</span>
                <span className="score-desc">Findings to review</span>
              </div>
              <div className="ats-metrics-breakdown">
                <div className="ats-metric-tile">
                  <span className="metric-name">Vague openings</span>
                  <span className="metric-val">
                    {report.weakOpeningCount}/{report.totalBulletsCount}
                  </span>
                  <span className="metric-sub">
                    Visible bullets matching listed phrases
                  </span>
                </div>
                <div className="ats-metric-tile">
                  <span className="metric-name">Numeric patterns</span>
                  <span className="metric-val">
                    {report.metricsCount}/{report.totalBulletsCount}
                  </span>
                  <span className="metric-sub">
                    Matches do not verify outcomes
                  </span>
                </div>
                <div className="ats-metric-tile">
                  <span className="metric-name">Contact fields</span>
                  <span className="metric-val">
                    {report.contactFieldsPresent}/3
                  </span>
                  <span className="metric-sub">
                    Name, email, location present
                  </span>
                </div>
                <div className="ats-metric-tile">
                  <span className="metric-name">
                    Exported-file reading order
                  </span>
                  <span className="metric-val">Not checked</span>
                  <span className="metric-sub">
                    No exported file was analyzed
                  </span>
                </div>
              </div>
            </div>
          )}
          <p className="helper-text">
            These are writing and content checks, not a hiring score. A missing
            number is a prompt to consider a result, not a requirement to invent
            one.
          </p>
          <div className="tailor-tabs" style={{ marginBottom: "16px" }}>
            <button
              type="button"
              className={activeTab === "score" ? "active" : ""}
              onClick={() => setActiveTab("score")}
            >
              Score ({score.total})
            </button>
            <button
              type="button"
              className={activeTab === "role" ? "active" : ""}
              onClick={() => setActiveTab("role")}
            >
              Role checklist
            </button>
            <button
              type="button"
              className={activeTab === "issues" ? "active" : ""}
              onClick={() => setActiveTab("issues")}
            >
              Writing findings ({report.issues.length})
            </button>
            <button
              type="button"
              className={activeTab === "plaintext" ? "active" : ""}
              onClick={() => setActiveTab("plaintext")}
            >
              Document text view
            </button>
            <button
              type="button"
              className={activeTab === "file" ? "active" : ""}
              onClick={() => setActiveTab("file")}
            >
              File diagnostics
            </button>
          </div>
          {activeTab === "score" && (
            <ResumeScoreReport
              score={score}
              onFix={
                onNavigateToSection
                  ? (type) => {
                      const target =
                        type === "contact"
                          ? "contact"
                          : doc.sections.find((s) => s.type === type)?.id;
                      if (target) onNavigateToSection(target);
                    }
                  : undefined
              }
            />
          )}
          {activeTab === "file" && <FileDiagnostics doc={doc} />}
          {activeTab === "role" && (
            <div className="role-analyzer-stage">
              <div className="applied-role-banner">
                <div className="applied-role-info">
                  <span className="applied-role-badge">
                    Suggested checklist · {suggestedRole.source}
                  </span>
                  <strong className="applied-role-name">
                    {suggestedRole.detectedHeadline}
                  </strong>
                  <span className="applied-role-meta">
                    Confirm a checklist relevant to your application.
                    Unsupported roles receive a general content review.
                  </span>
                </div>
              </div>
              <div className="role-selector-bar">
                <div className="role-selector-group">
                  <label htmlFor="target-role-select">Role checklist</label>
                  <select
                    id="target-role-select"
                    value={selectedRoleId}
                    onChange={(e) => selectRole(e.target.value)}
                    className="role-dropdown"
                  >
                    <option value="general">General content review</option>
                    {Object.values(ROLE_BENCHMARKS).map((bench) => (
                      <option key={bench.id} value={bench.id}>
                        {bench.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className={`role-chip-btn applied-chip ${selectedRoleId === suggestedRole.roleId ? "active" : ""}`}
                  onClick={() => selectRole(suggestedRole.roleId)}
                >
                  Suggested: {suggestedRole.roleTitle}
                </button>
              </div>
              {!roleConfirmed ? (
                <div className="role-section-card">
                  <p>
                    This is a curated term checklist, not a job description or a
                    validated market benchmark.
                  </p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setRoleConfirmed(true)}
                  >
                    Review selected checklist
                  </button>
                </div>
              ) : role.status === "general" ? (
                <div className="role-section-card">
                  <h3>General content review</h3>
                  <p>
                    No role-specific checklist is available for this selection.
                    Use writing findings or paste the actual job description in
                    the public reviewer.
                  </p>
                </div>
              ) : (
                <>
                  <div className="role-section-card">
                    <div className="role-section-head">
                      <h3>{role.roleTitle} · Term observations</h3>
                    </div>
                    <p className="helper-text">
                      Literal terms or listed aliases found in visible content:{" "}
                      {role.matchedCompetencies.length}/
                      {role.matchedCompetencies.length +
                        role.missingCompetencies.length}
                      . Term presence does not demonstrate proficiency.
                    </p>
                    <h4>Terms found</h4>
                    <div className="skills-pill-cloud">
                      {role.matchedCompetencies.map((term) => (
                        <span key={term} className="skill-pill matched">
                          {term}
                        </span>
                      ))}
                    </div>
                    {role.matchedCompetencies.length === 0 && (
                      <p>No checklist terms found.</p>
                    )}
                    <h4>Terms not found</h4>
                    <div className="skills-pill-cloud">
                      {role.missingCompetencies.map((term) => (
                        <span key={term} className="skill-pill missing">
                          {term}
                        </span>
                      ))}
                    </div>
                    <p className="helper-text">
                      Only add a skill in the editor if your own experience
                      supports it. An absent term does not establish a skill gap
                      or a job requirement.
                    </p>
                  </div>
                  <div className="role-section-card">
                    <div className="role-section-head">
                      <h3>Role numeric patterns</h3>
                    </div>
                    <p className="helper-text">
                      Regex observations in visible experience and project
                      descriptions and bullets. Values and achievements have not
                      been verified.
                    </p>
                    {role.matchedMetricTypes.map((name) => (
                      <div key={name} className="metric-benchmark-item matched">
                        <strong>{name}</strong>
                        <span className="matched-note">Pattern found</span>
                      </div>
                    ))}
                    {role.missingMetricTypes.map((metric) => (
                      <div
                        key={metric.name}
                        className="metric-benchmark-item missing"
                      >
                        <strong>{metric.name} · Pattern not found</strong>
                        <p>{metric.description}</p>
                        <div className="metric-example-box">
                          <span className="example-label">
                            Fictional wording example
                          </span>
                          <p>{metric.example}</p>
                          <small>
                            Use only your own supported outcomes. A qualitative
                            result can be appropriate.
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === "issues" && (
            <div>
              <p className="helper-text">
                Date strings matching YYYY or YYYY-MM: {report.validDateCount}/
                {report.totalDateCount}. This checks format only.
              </p>
              {report.issues.length === 0 ? (
                <p>
                  No findings from the current rules. File compatibility remains
                  unchecked.
                </p>
              ) : (
                <ul className="ats-issue-list">
                  {report.issues.map((issue) => (
                    <li
                      key={issue.id}
                      className={`ats-issue-card ${issue.severity}`}
                    >
                      <strong>{issue.message}</strong>
                      {issue.suggestion && (
                        <p className="issue-fix">{issue.suggestion}</p>
                      )}
                      {onNavigateToIssue && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onNavigateToIssue(issue)}
                        >
                          Review in editor
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {activeTab === "plaintext" && (
            <div>
              <p className="helper-text">
                Text assembled from the visible document model in section order.
                This is not text extracted from a PDF or another exported file
                and does not simulate an enterprise ATS parser.
              </p>
              <p>
                Exported-file reading order, tables, fonts, and layout:{" "}
                <strong>Not checked</strong>.
              </p>
              {audit.diagnostics.map((diagnostic) => (
                <p key={diagnostic}>{diagnostic}</p>
              ))}
              <pre className="plaintext-terminal">{audit.plainText}</pre>
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
