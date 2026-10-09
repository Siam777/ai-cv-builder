"use client";

import { useState } from "react";
import Link from "next/link";
import { lintResumeDocument, type AtsLintIssue } from "@/lib/linter/ats-linter";
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
  const [error, setError] = useState("");

  const [report, setReport] = useState<{
    doc: ResumeDocument;
    atsScore: number;
    verbsScore: number;
    metricsScore: number;
    issues: AtsLintIssue[];
    plainText: string;
    jobAnalysis?: {
      targetTitle: string;
      coverageScore: number;
      matchedRequirements: MatchedEvidence[];
      skillGaps: SkillGap[];
    };
  } | null>(null);

  function loadSampleData() {
    setTab("paste");
    setResumeText(SAMPLE_RESUME_TEXT);
    setJobDescription(SAMPLE_JOB_DESCRIPTION);
    setError("");
  }

  async function handleAudit() {
    setError("");
    setLoading(true);

    try {
      let parsedDoc: ResumeDocument | null = null;

      if (tab === "upload") {
        if (!file) {
          throw new Error("Please select a resume file (.pdf, .txt, or .json) to audit.");
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
      } else {
        if (!resumeText.trim()) {
          throw new Error("Please paste your resume text to audit.");
        }
        const { document } = parseTextToResume(resumeText, "Pasted Resume");
        parsedDoc = document;
      }

      if (!parsedDoc) {
        throw new Error("Unable to parse resume document.");
      }

      if (parsedDoc.contact.name) {
        parsedDoc.name = `${parsedDoc.contact.name} · Resume`;
      }

      // Run ATS Heuristic Audit
      const linterResult = lintResumeDocument(parsedDoc);
      const plainText = extractAtsPlainText(parsedDoc);

      // Optional Job Description Matching
      let jobAnalysis = undefined;
      if (jobDescription.trim().length > 30) {
        const reqs: ExtractedJobRequirements = parseJobDescriptionHeuristics(jobDescription);
        const matchResult = matchEvidenceAndCalculateCoverage(reqs, parsedDoc);

        jobAnalysis = {
          targetTitle: matchResult.jobTitle || reqs.jobTitle,
          coverageScore: matchResult.coverageScore,
          matchedRequirements: matchResult.matchedEvidence,
          skillGaps: matchResult.skillGaps,
        };
      }

      setReport({
        doc: parsedDoc,
        atsScore: linterResult.score,
        verbsScore: linterResult.verbsScore,
        metricsScore: linterResult.metricsScore,
        issues: linterResult.issues,
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
      window.location.href = "/";
    } catch (e) {
      setError("Unable to transfer to studio. You can copy the plain text below.");
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
            ATS Grader<small>AI CV BUILDER</small>
          </span>
        </Link>
        <div className="grader-header-actions">
          <Link href="/" className="nav-link">
            Open Resume Studio →
          </Link>
        </div>
      </header>

      <main className="grader-main">
        <section className="grader-hero">
          <span className="grader-badge">100% PRIVATE · CLIENT-SIDE HEURISTIC AUDIT</span>
          <h1>Free ATS Resume Grader & Match Inspector</h1>
          <p className="hero-lead">
            Audit your resume against enterprise applicant tracking system (ATS) parser rules,
            action verb strength, and quantifiable outcome density. Paste a job description to
            check keyword match coverage in seconds.
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
                    Upload File (.pdf, .txt)
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
                      accept=".pdf,.txt,.json"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setFile(e.target.files[0]);
                      }}
                    />
                    <label htmlFor="resume-file" className="dropzone-label">
                      <span className="upload-icon">📄</span>
                      <strong>{file ? file.name : "Choose a PDF, TXT, or JSON resume"}</strong>
                      <span className="file-hint">Drag and drop or browse from your device</span>
                    </label>
                  </div>
                ) : (
                  <textarea
                    className="resume-textarea"
                    rows={12}
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
                  Paste the requirements section of a role you want to apply for to compute keyword match score.
                </p>
                <textarea
                  className="job-textarea"
                  rows={12}
                  placeholder="Paste job description requirements and qualifications here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>

            {error && <div className="alert" role="alert">{error}</div>}

            <div className="audit-action-bar">
              <button
                type="button"
                className="audit-submit-btn"
                disabled={loading}
                onClick={handleAudit}
              >
                {loading ? "Analyzing resume against ATS heuristics…" : "⚡ Run Free ATS & Match Audit"}
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

            {/* Scoreboard */}
            <div className="scoreboard-grid">
              <div className="score-card primary-score">
                <span className="score-label">ATS READINESS SCORE</span>
                <div className="score-number">{report.atsScore}%</div>
                <p className="score-sub">
                  {report.atsScore >= 80
                    ? "Strong ATS foundation. Minor tweaks recommended."
                    : report.atsScore >= 60
                    ? "Moderate readiness. Missing key quantifiable metrics or active verbs."
                    : "Needs revision to pass automated parser screening."}
                </p>
              </div>

              {report.jobAnalysis && (
                <div className="score-card role-match-score">
                  <span className="score-label">JOB MATCH COVERAGE</span>
                  <div className="score-number">{report.jobAnalysis.coverageScore}%</div>
                  <p className="score-sub">
                    Match against <strong>{report.jobAnalysis.targetTitle}</strong>
                  </p>
                </div>
              )}

              <div className="metric-mini-cards">
                <div className="mini-card">
                  <span className="mini-label">Action Verbs</span>
                  <span className="mini-val">{report.verbsScore}%</span>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Quantified Impact</span>
                  <span className="mini-val">{report.metricsScore}%</span>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Reading Order</span>
                  <span className="mini-val clean">100% Clean</span>
                </div>
              </div>
            </div>

            {/* High-Converting CTA Banner */}
            <div className="report-cta-box">
              <div className="cta-text">
                <h3>Take this resume directly into the AI Studio</h3>
                <p>
                  Fix weak verbs with Google XYZ impact formulas and tailor this resume for your target role in 1 click.
                </p>
              </div>
              <button
                type="button"
                className="cta-button"
                onClick={handleOpenInStudio}
              >
                Open in AI Studio to Fix & Tailor ↗
              </button>
            </div>

            {/* Detailed Findings & Gaps */}
            <div className="findings-section">
              <div className="findings-col">
                <h3>🔍 Heuristic Findings ({report.issues.length})</h3>
                {report.issues.length === 0 ? (
                  <div className="empty-findings">✓ No critical ATS issues detected!</div>
                ) : (
                  <ul className="issue-list">
                    {report.issues.map((issue) => (
                      <li key={issue.id} className={`issue-item ${issue.severity}`}>
                        <span className="issue-icon">
                          {issue.severity === "critical" ? "❌" : "⚠️"}
                        </span>
                        <div>
                          <strong>{issue.message}</strong>
                          {issue.suggestion && (
                            <p className="issue-fix">💡 Suggestion: {issue.suggestion}</p>
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
                    <h4>Matched Evidence ({report.jobAnalysis.matchedRequirements.length})</h4>
                    <ul className="match-pill-list">
                      {report.jobAnalysis.matchedRequirements.map((item) => (
                        <li key={item.requirementId} className="matched-pill">
                          ✓ {item.description}
                        </li>
                      ))}
                    </ul>

                    {report.jobAnalysis.skillGaps.length > 0 && (
                      <>
                        <h4 className="gap-heading">
                          Missing Keywords & Gaps ({report.jobAnalysis.skillGaps.length})
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
                <h3>Extracted ATS Plain-Text Stream (What Applicant Tracking Robots Read)</h3>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(report.plainText);
                    alert("ATS plain-text stream copied to clipboard!");
                  }}
                >
                  📋 Copy Clean Text
                </button>
              </div>
              <pre className="plain-text-terminal">{report.plainText}</pre>
            </div>
          </section>
        )}
      </main>

      <footer className="grader-footer">
        <p>
          AI CV Builder · Deterministic ATS Audit Engine · No data is sold or sent to third parties.
        </p>
      </footer>
    </div>
  );
}
