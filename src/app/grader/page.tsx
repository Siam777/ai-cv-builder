"use client";

import type { FileDiagnosticReport } from "@/lib/file-diagnostics";
import { FileDiagnosticResults } from "@/components/editor/FileDiagnostics";
import { useState } from "react";
import Link from "next/link";
import {
  lintResumeDocument,
  type AtsReadinessReport,
} from "@/lib/linter/ats-linter";
import { extractAtsPlainText } from "@/lib/linter/ats-plain-text";
import { parseTextToResume } from "@/lib/importers/text-resume-parser";
import {
  parseJobDescriptionHeuristics,
  matchEvidenceAndCalculateCoverage,
  type ExtractedJobRequirements,
  type MatchedEvidence,
  type SkillGap,
} from "@/lib/vault/job-tailoring";
import { createRepository } from "@/lib/repository";
import type { ResumeDocument } from "@/lib/document";

const SAMPLE_RESUME_TEXT = `Alex Morgan
alex.morgan@example.com · San Francisco, CA · github.com/alexmorgan

SUMMARY
Full-Stack Product Engineer with 6+ years experience architecting scalable distributed systems and reactive web applications.

EXPERIENCE
Staff Software Engineer | Acme Cloud Corp | 2022 - Present
- Architected event-driven microservices processing 12M daily requests with 99.99% uptime.
- Optimized PostgreSQL database queries, reducing p99 latency by 42% across core endpoints.
- Spearheaded team migration to Next.js and TypeScript, increasing engineering deployment velocity by 2.5x.
- Responsible for running daily standups and sprint planning meetings.

Senior Software Engineer | Beta Technologies | 2019 - 2022
- Engineered high-throughput analytics pipeline handling 500k events/sec using Kafka and Redis.
- Mentored 6 junior engineers and established automated CI/CD pipelines reducing defect escape rate by 30%.
- Worked on customer onboarding flow with React and GraphQL.

EDUCATION
B.S. in Computer Science | University of California, Berkeley | 2015 - 2019

SKILLS
TypeScript, React, Next.js, Node.js, Python, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, GraphQL
`;

const SAMPLE_JOB_DESCRIPTION = `Staff Full-Stack Engineer

Requirements:
- 5+ years building and deploying scalable web services in production.
- Deep expertise in TypeScript, React, Next.js, and Node.js.
- Strong knowledge of distributed systems, message queues (Kafka/RabbitMQ), and database optimization.
- Experience with Docker, Kubernetes, and AWS cloud infrastructure.
- Proven track record mentoring engineers and driving architectural decisions.
- Preferred: Experience with GraphQL and real-time event streaming.
`;

export default function GraderPage() {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [error, setError] = useState("");

  const [report, setReport] = useState<{
    doc: ResumeDocument;
    findings: AtsReadinessReport;
    warnings: string[];
    plainText: string;
    fileDiagnostics?: FileDiagnosticReport;
    jobAnalysis?: {
      targetTitle: string;
      matchedCount: number;
      totalCount: number;
      matchedRequirements: MatchedEvidence[];
      skillGaps: SkillGap[];
    };
  } | null>(null);

  function loadSampleData() {
    setTab("paste");
    setIsPractice(true);
    setResumeText(SAMPLE_RESUME_TEXT);
    setJobDescription(SAMPLE_JOB_DESCRIPTION);
    setError("");
  }

  async function handleAudit() {
    setError("");
    setLoading(true);

    try {
      let parsedDoc: ResumeDocument | null = null;
      let warnings: string[] = [];
      let fileDiagnostics: FileDiagnosticReport | undefined;

      if (tab === "upload") {
        if (!file) {
          throw new Error(
            "Please select a resume file (.pdf, .docx or .txt) to audit.",
          );
        }
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/resumes/import-file", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to process resume file.");
        }
        parsedDoc = data.document;
        warnings = Array.isArray(data.warnings) ? data.warnings : [];
        fileDiagnostics = data.diagnostics;
      } else {
        if (!resumeText.trim()) {
          throw new Error("Please paste your resume text to audit.");
        }
        const { document, warnings: parseWarnings } = parseTextToResume(
          resumeText,
          "Pasted Resume",
        );
        parsedDoc = document;
        warnings = parseWarnings;
      }

      if (!parsedDoc) {
        throw new Error("Unable to parse resume document.");
      }

      if (parsedDoc.contact.name) {
        parsedDoc.name = `${parsedDoc.contact.name} · Resume`;
      }

      if (tab === "paste" && isPractice)
        parsedDoc.provenance = { purpose: "practice", origin: "example" };

      // Run ATS Heuristic Audit
      const linterResult = lintResumeDocument(parsedDoc);
      const plainText = extractAtsPlainText(parsedDoc);

      // Optional Job Description Matching
      let jobAnalysis = undefined;
      if (jobDescription.trim().length > 30) {
        const reqs: ExtractedJobRequirements =
          parseJobDescriptionHeuristics(jobDescription);
        const matchResult = matchEvidenceAndCalculateCoverage(reqs, parsedDoc);

        jobAnalysis = {
          targetTitle: matchResult.jobTitle || reqs.jobTitle,
          matchedCount: matchResult.matchedCount,
          totalCount: matchResult.totalRequirementsCount,
          matchedRequirements: matchResult.matchedEvidence,
          skillGaps: matchResult.skillGaps,
        };
      }

      setReport({
        doc: parsedDoc,
        findings: linterResult,
        fileDiagnostics,
        warnings,
        plainText,
        jobAnalysis,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenInStudio() {
    if (!report) return;
    try {
      const repo = createRepository();
      await repo.save(report.doc, null);
      sessionStorage.setItem("cv-workspace", "device");
      window.location.href = "/builder";
    } catch (e) {
      setError("Unable to transfer to the editor. Please try again.");
    }
  }

  return (
    <div className="grader-container">
      <header className="grader-header">
        <Link href="/" className="brand" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Resume Reviewer<small>AI CV BUILDER</small>
          </span>
        </Link>
        <div className="grader-header-actions">
          <Link href="/builder" className="nav-link">
            Open Resume Studio →
          </Link>
        </div>
      </header>

      <main className="grader-main">
        <section className="grader-hero">
          <span className="grader-badge">
            VISIBLE CONTENT · DETERMINISTIC CHECKS
          </span>
          <h1>Free Resume Content Review</h1>
          <p>
            Upload your CV or paste its text, then choose Review resume content.
            Read the findings, check any import notes, and open the editor to
            make changes. A job description is optional.
          </p>
          <p className="hero-lead">
            Review contact details, vague bullet openings, dates, and numeric
            patterns. Add a job description to see keyword and token overlaps.
            These checks do not predict ATS acceptance or hiring outcomes.
          </p>
        </section>

        {!report ? (
          <section className="grader-input-card">
            <div className="input-split">
              <div className="resume-source-box">
                <div className="box-header">
                  <span className="step-num">1</span>
                  <h3>Select or Paste Your Resume</h3>
                </div>

                <div className="tab-pill-row">
                  <button
                    type="button"
                    className={`tab-pill ${tab === "upload" ? "active" : ""}`}
                    onClick={() => setTab("upload")}
                  >
                    Upload File (.pdf, .docx, .txt)
                  </button>
                  <button
                    type="button"
                    className={`tab-pill ${tab === "paste" ? "active" : ""}`}
                    onClick={() => setTab("paste")}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    className="tab-pill sample-btn"
                    onClick={loadSampleData}
                  >
                    Load Sample
                  </button>
                </div>

                {tab === "upload" ? (
                  <div className="file-dropzone">
                    <input
                      type="file"
                      id="resume-file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setFile(e.target.files[0]);
                      }}
                    />
                    <label htmlFor="resume-file" className="dropzone-label">
                      <span className="upload-icon">📄</span>
                      <strong>
                        {file ? file.name : "Choose a PDF, DOCX or TXT resume"}
                      </strong>
                      <span className="file-hint">
                        Up to 5 MB · Files are sent to this application server
                      </span>
                    </label>
                  </div>
                ) : (
                  <textarea
                    className="resume-textarea"
                    rows={12}
                    aria-label="Resume text"
                    placeholder="Paste the full text of your resume here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                )}
              </div>

              <div className="job-description-box">
                <div className="box-header">
                  <span className="step-num">2</span>
                  <h3>Target Job Description (Optional)</h3>
                </div>
                <p className="box-hint">
                  Paste actual requirements to compare skill aliases and token
                  fragments. Text overlap does not verify qualifications.
                </p>
                <textarea
                  className="job-textarea"
                  rows={12}
                  aria-label="Job description"
                  placeholder="Paste job description requirements and qualifications here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}

            <div className="audit-action-bar">
              <button
                type="button"
                className="audit-submit-btn"
                disabled={loading}
                onClick={handleAudit}
              >
                {loading
                  ? "Reviewing resume content…"
                  : "Review resume content"}
              </button>
            </div>
          </section>
        ) : (
          <section className="grader-report-card">
            <div className="report-top-banner">
              <div>
                <p className="eyebrow">DIAGNOSTIC REPORT FOR</p>
                <h2>{report.doc.contact.name || "Candidate Resume"}</h2>
              </div>
              <button
                type="button"
                className="audit-retry-btn"
                onClick={() => setReport(null)}
              >
                ← Audit Another Resume
              </button>
            </div>

            <p className="box-hint">
              The report checks the parsed document model. Exported-file layout
              and reading order have not been checked. Numeric patterns do not
              verify achievements.
            </p>
            {report.warnings.length > 0 && (
              <div className="import-warnings">
                <h3>Import notes</h3>
                <ul>
                  {report.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.fileDiagnostics && (
              <FileDiagnosticResults report={report.fileDiagnostics} />
            )}
            {/* Observed counts */}
            <div className="scoreboard-grid">
              <div className="score-card primary-score">
                <span className="score-label">WRITING FINDINGS</span>
                <div className="score-number">
                  {report.findings.issues.length}
                </div>
                <p className="score-sub">
                  Review these rule matches in context. This is a findings
                  count, not an ATS score.
                </p>
              </div>

              {report.jobAnalysis && (
                <div className="score-card role-match-score">
                  <span className="score-label">JOB REQUIREMENT OVERLAP</span>
                  <div className="score-number">
                    {report.jobAnalysis.totalCount > 0
                      ? `${report.jobAnalysis.matchedCount}/${report.jobAnalysis.totalCount}`
                      : "Not assessed"}
                  </div>
                  <p className="score-sub">
                    Parsed requirement lines in{" "}
                    <strong>{report.jobAnalysis.targetTitle}</strong>
                  </p>
                </div>
              )}

              <div className="metric-mini-cards">
                <div className="mini-card">
                  <span className="mini-label">Vague openings</span>
                  <span className="mini-val">
                    {report.findings.weakOpeningCount}/
                    {report.findings.totalBulletsCount}
                  </span>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Numeric patterns</span>
                  <span className="mini-val">
                    {report.findings.metricsCount}/
                    {report.findings.totalBulletsCount}
                  </span>
                </div>
                <div className="mini-card">
                  <span className="mini-label">
                    Exported-file reading order
                  </span>
                  <span className="mini-val clean">Not checked</span>
                </div>
              </div>
            </div>

            {/* High-Converting CTA Banner */}
            <div className="report-cta-box">
              <div className="cta-text">
                <h3>Review and edit your imported content</h3>
                <p>
                  Save a copy on this device and check the imported content
                  before making changes.
                </p>
              </div>
              <button
                type="button"
                className="cta-button"
                onClick={handleOpenInStudio}
              >
                Open in Resume Studio ↗
              </button>
            </div>

            {/* Detailed Findings & Gaps */}
            <p className="review-start-note">
              Start with Writing findings below. They describe possible fixes,
              not a hiring score. Review the imported text before trusting a
              finding; the original file may contain details the import missed.
            </p>
            <div className="findings-section">
              <div className="findings-col">
                <h3>🔍 Writing findings ({report.findings.issues.length})</h3>
                {report.findings.issues.length === 0 ? (
                  <div className="empty-findings">
                    No findings from the current rules. File compatibility
                    remains unchecked.
                  </div>
                ) : (
                  <ul className="issue-list">
                    {report.findings.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`issue-item ${issue.severity}`}
                      >
                        <span className="issue-icon">
                          {issue.severity === "critical" ? "❌" : "⚠️"}
                        </span>
                        <div>
                          <strong>{issue.message}</strong>
                          {issue.suggestion && (
                            <p className="issue-fix">
                              💡 Suggestion: {issue.suggestion}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {report.jobAnalysis && (
                <div className="findings-col">
                  <h3>🎯 Keyword & Requirements Breakdown</h3>
                  <div className="keyword-section">
                    <p className="box-hint">
                      Rules detect requirement lines and compare skill aliases
                      and token fragments. A partial match may leave other parts
                      of a requirement unmet. Review the candidate text for each
                      match; no qualifications have been verified.
                    </p>
                    <h4>
                      Candidate text overlaps (
                      {report.jobAnalysis.matchedRequirements.length})
                    </h4>
                    <ul className="match-pill-list">
                      {report.jobAnalysis.matchedRequirements.map((item) => (
                        <li key={item.requirementId} className="matched-pill">
                          {item.description}
                          {item.matchedBullets.map((bullet) => (
                            <p key={bullet.bulletId}>
                              {bullet.entryTitle}: “{bullet.text}”
                            </p>
                          ))}
                          {item.matchedSkills.length > 0 && (
                            <p>
                              Listed skill terms:{" "}
                              {item.matchedSkills.join(", ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>

                    {report.jobAnalysis.skillGaps.length > 0 && (
                      <>
                        <h4 className="gap-heading">
                          No text overlap found (
                          {report.jobAnalysis.skillGaps.length})
                        </h4>
                        <ul className="gap-pill-list">
                          {report.jobAnalysis.skillGaps.map((gap) => (
                            <li key={gap.requirementId} className="gap-pill">
                              ✗ {gap.description}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ATS Plain Text Stream Preview */}
            <div className="plain-text-preview-box">
              <div className="box-header">
                <h3>Document model text</h3>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={handleOpenInStudio}
                >
                  Open in editor to export
                </button>
              </div>
              <p className="box-hint">
                Assembled from parsed fields in section order. This does not
                reproduce an ATS parser or validate the original file.
              </p>
              <pre className="plain-text-terminal">{report.plainText}</pre>
            </div>
          </section>
        )}
      </main>

      <footer className="grader-footer">
        <p>
          AI CV Builder · Deterministic content checks · Pasted text is analyzed
          in your browser. File uploads are processed by this application
          server.
        </p>
      </footer>
    </div>
  );
}
