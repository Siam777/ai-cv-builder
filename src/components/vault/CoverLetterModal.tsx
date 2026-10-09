"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { accents } from "@/lib/presentation";
import {
  generateCoverLetter,
  type GeneratedCoverLetter,
} from "@/lib/vault/cover-letter";

export interface CoverLetterModalProps {
  doc: ResumeDocument;
  busy: boolean;
  onClose: () => void;
  onDownloadFile?: (content: string, filename: string, mime: string) => void;
}

export function CoverLetterModal({
  doc,
  busy,
  onClose,
  onDownloadFile,
}: CoverLetterModalProps) {
  useBodyScrollLock(true);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<"executive" | "confident" | "modern">("confident");
  const [letter, setLetter] = useState<GeneratedCoverLetter | null>(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  const accentColor = accents[doc.presentation.accent] || "#285641";

  function handleGenerate() {
    const generated = generateCoverLetter(doc, {
      title: jobTitle || "Target Role",
      company: company || "Target Company",
      recipientName: recipientName || "Hiring Team",
      description: jobDescription,
    });
    setLetter(generated);
    setEditedText(generated.fullText);
  }

  async function handleCopy() {
    const textToCopy = editedText || letter?.fullText || "";
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownloadText() {
    const text = editedText || letter?.fullText || "";
    if (!text) return;
    const name = `${(company || "Target-Company").replace(/\s+/g, "-")}-Cover-Letter.txt`;
    if (onDownloadFile) {
      onDownloadFile(text, name, "text/plain;charset=utf-8");
    } else {
      triggerDownload(text, name, "text/plain;charset=utf-8");
    }
  }

  function handleDownloadMarkdown() {
    const md = letter?.markdown || editedText;
    if (!md) return;
    const name = `${(company || "Target-Company").replace(/\s+/g, "-")}-Cover-Letter.md`;
    if (onDownloadFile) {
      onDownloadFile(md, name, "text/markdown;charset=utf-8");
    } else {
      triggerDownload(md, name, "text/markdown;charset=utf-8");
    }
  }

  function handlePrint() {
    window.print();
  }

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-label="Tailored Cover Letter Generator"
    >
      <div
        className="modal-card tailor-modal"
        style={{ maxWidth: letter ? "1100px" : "760px", width: "95vw", transition: "max-width 0.2s" }}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">CAREER VAULT · EVIDENCE-GROUNDED COVER LETTER</p>
            <h2>Tailored Cover Letter Generator</h2>
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
          {!letter ? (
            <div className="tailor-input-stage">
              <p className="helper-text">
                Generate an executive, 3-to-4 paragraph cover letter matched to your target
                company and job description. Every claim, metric, and past project is verified
                against your resume evidence — guaranteed 0 hallucinated facts.
              </p>
              <div className="field-grid">
                <label>
                  Target Role Title
                  <input
                    type="text"
                    value={jobTitle}
                    placeholder="e.g. Staff Software Engineer"
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
              <div className="field-grid">
                <label>
                  Hiring Manager / Recipient (Optional)
                  <input
                    type="text"
                    value={recipientName}
                    placeholder="e.g. Jane Smith or Hiring Team"
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </label>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Letter Tone
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(
                      [
                        { id: "confident", label: "Impact & Metrics" },
                        { id: "executive", label: "Executive" },
                        { id: "modern", label: "Modern" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`role-chip-btn ${tone === t.id ? "active" : ""}`}
                        onClick={() => setTone(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label>
                Target Job Description (Optional, enables requirement matching)
                <textarea
                  rows={6}
                  value={jobDescription}
                  placeholder="Paste the job description or leave blank to tailor using your top career achievements..."
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="tailor-results-stage">
              <div className="coverage-card" style={{ padding: "0.85rem 1rem", marginBottom: "1rem" }}>
                <div className="score-summary">
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                    Letter for {jobTitle || "Role"} at {company || "Company"}
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                    Grounded with {letter.matchedEvidenceCount} verified resume achievements. You can
                    edit the narrative below before exporting.
                  </p>
                </div>
              </div>

              {/* LIVE LETTERHEAD STUDIO VIEW */}
              <div className="cover-letter-preview-stage" style={{ marginBottom: "16px" }}>
                <div className="cover-letter-sheet">
                  {/* Letterhead Header */}
                  <div className="letterhead-header" style={{ borderBottom: `2.5px solid ${accentColor}` }}>
                    <h1 className="letterhead-name">{doc.contact.name || "Candidate Name"}</h1>
                    <p className="letterhead-headline">{jobTitle || doc.contact.headline || "Professional"}</p>
                    <p className="letterhead-contact">
                      {[doc.contact.email, doc.contact.phone, doc.contact.location, doc.contact.website]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>

                  {/* Recipient & Date Meta */}
                  <div className="letterhead-meta">
                    <span className="letterhead-date">{today}</span>
                    <div className="letterhead-to">
                      <strong>{recipientName || "Hiring Team"}</strong>
                      <span>{company || "Target Company"}</span>
                    </div>
                  </div>

                  {/* Editable Letter Body */}
                  <textarea
                    className="letterhead-editable-body"
                    rows={12}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    placeholder="Your cover letter text appears here..."
                  />

                  {/* Sign-off */}
                  <div className="letterhead-signoff">
                    <p>Sincerely,</p>
                    <strong>{doc.contact.name || "Candidate"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="button-row">
          {!letter ? (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={handleGenerate}
              >
                Generate Grounded Cover Letter <span>↗</span>
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
                onClick={handleCopy}
                disabled={busy}
              >
                {copied ? "✓ Copied to Clipboard!" : "📋 Copy to Clipboard"}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={busy}
                title="Print or Save as PDF"
              >
                🖨️ Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadText}
                disabled={busy}
              >
                Download .txt
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                disabled={busy}
              >
                Download .md
              </button>
              <button
                type="button"
                onClick={() => setLetter(null)}
                disabled={busy}
              >
                Adjust Inputs
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

function triggerDownload(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}
