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
import {
  analyzeJobGap,
  scoreResume,
  type JobGapAnalysis,
  type ResumeScore,
} from "@/lib/linter/resume-score";
import {
  JobGapReport,
  ResumeScoreReport,
} from "@/components/score/ResumeScoreReport";
import { PublicShell } from "@/components/public/PublicShell";
import type { ResumeDocument } from "@/lib/document";
import { CircleX, FileText, TriangleAlert, X } from "lucide-react";

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
    score: ResumeScore;
    gap?: JobGapAnalysis;
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

      const score = scoreResume(parsedDoc);
      const gap =
        jobDescription.trim().length > 30
          ? analyzeJobGap(parsedDoc, jobDescription)
          : undefined;

      setReport({
        doc: parsedDoc,
        score,
        gap,
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
    <PublicShell active="/grader">
      <div className="grader-main">
        <section className="grader-hero">
          <h1>How good is your resume?</h1>
          <p>
            Get a 0–100 score with the reasons behind every point, see how you
            compare with common recruiter benchmarks, and add a job posting to
            find the gaps. Free, no account needed.
          </p>
        </section>

        {!report ? (
          <section className="grader-input-card">
            <div className="input-split">
              <div className="resume-source-box">
                <div className="box-header">
                  <span className="step-num">1</span>
                  <h3>Your resume</h3>
                </div>

                <div className="tab-pill-row" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "upload"}
                    className={`tab-pill ${tab === "upload" ? "active" : ""}`}
                    onClick={() => setTab("upload")}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "paste"}
                    className={`tab-pill ${tab === "paste" ? "active" : ""}`}
                    onClick={() => setTab("paste")}
                  >
                    Paste text
                  </button>
                  <button
                    type="button"
                    className="tab-pill sample-btn"
                    onClick={loadSampleData}
                  >
                    Try a sample
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
                      <FileText className="upload-icon" size={32} aria-hidden />
                      <strong>
                        {file ? file.name : "Choose a PDF, DOCX or TXT resume"}
                      </strong>
                      <span className="file-hint">
                        Up to 5 MB · Files are sent to this application server
                        for text extraction and are not saved
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
                  <h3>
                    Job posting <small>optional</small>
                  </h3>
                </div>
                <p className="box-hint">
                  Paste a job description to get a gap analysis: which skills
                  and requirements your resume covers, and which are missing.
                </p>
                <textarea
                  className="job-textarea"
                  rows={12}
                  aria-label="Job description"
                  placeholder="Paste the job description here..."
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
                {loading ? "Scoring your resume…" : "Review resume content"}
              </button>
              <p className="box-hint">
                Pasted text is analyzed in your browser. Scores describe the
                written content, not ATS acceptance or hiring outcomes.
              </p>
            </div>
          </section>
        ) : (
          <section className="grader-report-card">
            <div className="report-top-banner">
              <div>
                <p className="eyebrow">Resume report</p>
                <h2>{report.doc.contact.name || "Your resume"}</h2>
              </div>
              <div className="report-actions">
                <button
                  type="button"
                  className="audit-retry-btn"
                  onClick={() => setReport(null)}
                >
                  ← Review another
                </button>
                <button
                  type="button"
                  className="cta-button"
                  onClick={handleOpenInStudio}
                >
                  Improve it in the editor
                </button>
              </div>
            </div>

            {report.warnings.length > 0 && (
              <details className="import-warnings">
                <summary>
                  Import notes ({report.warnings.length}): check these if a
                  score looks wrong
                </summary>
                <ul>
                  {report.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}

            <ResumeScoreReport
              score={report.score}
              jobMatch={report.gap?.matchPercent}
            />

            {report.gap && (
              <JobGapReport
                gap={report.gap}
                title={report.jobAnalysis?.targetTitle}
              />
            )}

            <div className="report-cta-box">
              <div className="cta-text">
                <h3>Fix it in minutes</h3>
                <p>
                  Open this resume in the editor to apply the fixes, pick a
                  design and watch your score update as you type.
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

            <details className="report-section">
              <summary>
                Line-by-line writing findings ({report.findings.issues.length})
              </summary>
              <div className="scoreboard-grid">
                <div className="score-card primary-score">
                  <span className="score-label">Writing findings</span>
                  <div className="score-number">
                    {report.findings.issues.length}
                  </div>
                </div>
                <div className="metric-mini-cards">
                  <div className="mini-card">
                    <span className="mini-label">Vague openings</span>
                    <span className="mini-val">
                      {report.findings.weakOpeningCount}/
                      {report.findings.totalBulletsCount}
                    </span>
                  </div>
                  <div className="mini-card">
                    <span className="mini-label">Bullets with numbers</span>
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
              {report.findings.issues.length === 0 ? (
                <div className="empty-findings">
                  No findings from the current rules.
                </div>
              ) : (
                <ul className="issue-list">
                  {report.findings.issues.map((issue) => (
                    <li
                      key={issue.id}
                      className={`issue-item ${issue.severity}`}
                    >
                      <span className="issue-icon">
                        {issue.severity === "critical" ? (
                          <CircleX size={18} aria-label="Critical" />
                        ) : (
                          <TriangleAlert size={18} aria-label="Warning" />
                        )}
                      </span>
                      <div>
                        <strong>{issue.message}</strong>
                        {issue.suggestion && (
                          <p className="issue-fix">{issue.suggestion}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            {report.jobAnalysis && (
              <details className="report-section">
                <summary>
                  Requirement-by-requirement evidence (
                  {report.jobAnalysis.matchedCount}/
                  {report.jobAnalysis.totalCount} requirement lines)
                </summary>
                <div className="keyword-section">
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
                          <p>Skills: {item.matchedSkills.join(", ")}</p>
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
                            <X size={16} aria-hidden /> {gap.description}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </details>
            )}

            {report.fileDiagnostics && (
              <details className="report-section" open>
                <summary>File diagnostics for your upload</summary>
                <FileDiagnosticResults report={report.fileDiagnostics} />
              </details>
            )}

            <details className="report-section plain-text-preview-box">
              <summary>Plain-text view of your resume</summary>
              <p className="box-hint">
                Assembled from parsed fields in section order. This does not
                reproduce an ATS parser or validate the original file.
              </p>
              <pre className="plain-text-terminal">{report.plainText}</pre>
            </details>
          </section>
        )}
      </div>
    </PublicShell>
  );
}
