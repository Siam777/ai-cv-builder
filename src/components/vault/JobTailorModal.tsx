"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import {
  parseJobDescriptionHeuristics,
  matchEvidenceAndCalculateCoverage,
  generateTailoredVariant,
  type JobMatchResult,
} from "@/lib/vault/job-tailoring";

export interface JobTailorModalProps {
  doc: ResumeDocument;
  busy: boolean;
  onApplyTailoredVariant: (tailored: ResumeDocument) => void;
  onClose: () => void;
}

export function JobTailorModal({
  doc,
  busy,
  onApplyTailoredVariant,
  onClose,
}: JobTailorModalProps) {
  useBodyScrollLock(true);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [activeTab, setActiveTab] = useState<"matched" | "gaps">("matched");

  function handleAnalyze() {
    if (!jobDescription.trim()) return;
    const parsedJob = parseJobDescriptionHeuristics(jobDescription, jobTitle, company);
    const result = matchEvidenceAndCalculateCoverage(parsedJob, doc);
    setMatchResult(result);
    if (!jobTitle && parsedJob.jobTitle) setJobTitle(parsedJob.jobTitle);
    if (!company && parsedJob.company) setCompany(parsedJob.company);
  }

  function handleCreateVariant() {
    if (!matchResult) return;
    const tailored = generateTailoredVariant(doc, matchResult, {
      jobTitle: jobTitle || matchResult.jobTitle,
      company: company || matchResult.company,
    });
    onApplyTailoredVariant(tailored);
  }

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-label="Job Tailoring Engine">
      <div className="modal-card tailor-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">CAREER VAULT · 1-CLICK JOB TAILORING</p>
            <h2>Tailor Resume for a Job Description</h2>
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

        <div className="tailor-content">
          {!matchResult ? (
            <div className="tailor-input-stage">
              <p className="helper-text">
                Paste any job posting. The tailoring engine extracts hard requirements and
                matches them against your resume evidence, re-ranking your most relevant
                accomplishments without inventing facts.
              </p>
              <div className="field-grid">
                <label>
                  Target Job Title
                  <input
                    type="text"
                    value={jobTitle}
                    placeholder="e.g. Senior Software Engineer"
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </label>
                <label>
                  Company Name
                  <input
                    type="text"
                    value={company}
                    placeholder="e.g. Stripe"
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Job Description
                <textarea
                  rows={10}
                  value={jobDescription}
                  placeholder="Paste the full job requirements and responsibilities here..."
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="tailor-results-stage">
              <div className="coverage-card">
                <div className="score-badge">
                  <span className="score-number">{matchResult.coverageScore}%</span>
                  <span className="score-label">Requirement Match</span>
                </div>
                <div className="score-summary">
                  <h3>
                    {jobTitle || matchResult.jobTitle} at {company || matchResult.company}
                  </h3>
                  <p>
                    <strong>{matchResult.matchedCount}</strong> matched requirements ·{" "}
                    <strong>{matchResult.skillGaps.length}</strong> identified gaps
                  </p>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${matchResult.coverageScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="tailor-tabs">
                <button
                  type="button"
                  className={activeTab === "matched" ? "active" : ""}
                  onClick={() => setActiveTab("matched")}
                >
                  Matched Evidence ({matchResult.matchedEvidence.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "gaps" ? "active" : ""}
                  onClick={() => setActiveTab("gaps")}
                >
                  Skill Gaps & Opportunities ({matchResult.skillGaps.length})
                </button>
              </div>

              <div className="tab-body">
                {activeTab === "matched" ? (
                  <ul className="evidence-list">
                    {matchResult.matchedEvidence.map((m) => (
                      <li key={m.requirementId} className="evidence-item">
                        <div className="evidence-head">
                          <span className="match-tag">✓ Matched</span>
                          <strong>{m.description}</strong>
                        </div>
                        {m.matchedBullets.length > 0 && (
                          <div className="evidence-bullets">
                            <span className="role-chip">
                              In {m.matchedBullets[0].entryTitle}:
                            </span>
                            <p className="bullet-preview">
                              “{m.matchedBullets[0].text}”
                            </p>
                          </div>
                        )}
                        {m.matchedSkills.length > 0 && (
                          <div className="matched-skills-chips">
                            Skills: {m.matchedSkills.join(", ")}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="gaps-list">
                    <p className="anti-hallucination-note">
                      🔒 <strong>Anti-Hallucination Guard:</strong> These requirements were not
                      found in your current resume. We never invent experience or insert
                      unverified skills into your resume.
                    </p>
                    <ul>
                      {matchResult.skillGaps.map((g) => (
                        <li key={g.requirementId} className="gap-item">
                          <span className="gap-tag">Gap</span>
                          <span>{g.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="button-row">
          {!matchResult ? (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy || !jobDescription.trim()}
                onClick={handleAnalyze}
              >
                Analyze &amp; Match Evidence <span>↗</span>
              </button>
              <button type="button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={handleCreateVariant}
              >
                Generate 1-Click Tailored Variant <span>↗</span>
              </button>
              <button
                type="button"
                onClick={() => setMatchResult(null)}
                disabled={busy}
              >
                Edit Job Description
              </button>
              <button type="button" onClick={onClose} disabled={busy}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
