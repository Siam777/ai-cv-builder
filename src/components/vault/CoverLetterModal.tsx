"use client";

import { useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
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
  onExport: (
    format: "txt" | "md" | "copy" | "print",
    text: string,
    name: string,
  ) => void;
}

export function CoverLetterModal({
  doc,
  busy,
  onClose,
  onExport,
}: CoverLetterModalProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus(onClose);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [letter, setLetter] = useState<GeneratedCoverLetter | null>(null);
  const [editedText, setEditedText] = useState("");

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

  function exportLetter(format: "txt" | "md" | "copy" | "print") {
    const text = editedText || letter?.fullText || "";
    if (text)
      onExport(format, text, (company || "Target-Company") + "-Cover-Letter");
  }

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Tailored Cover Letter Generator"
    >
      <div
        className="modal-card tailor-modal"
        style={{
          maxWidth: letter ? "1100px" : "760px",
          width: "95vw",
          transition: "max-width 0.2s",
        }}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">
              CAREER VAULT · EVIDENCE-GROUNDED COVER LETTER
            </p>
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
                Draft a cover letter from your existing resume content and
                target job details. Review every claim and edit the text before
                exporting; this tool does not independently verify your
                experience.
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
              <div
                className="coverage-card"
                style={{ padding: "0.85rem 1rem", marginBottom: "1rem" }}
              >
                <div className="score-summary">
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                    Letter for {jobTitle || "Role"} at {company || "Company"}
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "0.85rem",
                      color: "var(--muted)",
                    }}
                  >
                    Uses {letter.matchedEvidenceCount} selected resume bullets.
                    Review the facts and edit the narrative below before
                    exporting.
                  </p>
                </div>
              </div>

              {/* LIVE LETTERHEAD STUDIO VIEW */}
              <div
                className="cover-letter-preview-stage"
                style={{ marginBottom: "16px" }}
              >
                <div className="cover-letter-sheet">
                  {/* Letterhead Header */}
                  <div
                    className="letterhead-header"
                    style={{ borderBottom: `2.5px solid ${accentColor}` }}
                  >
                    <h1 className="letterhead-name">
                      {doc.contact.name || "Candidate Name"}
                    </h1>
                    <p className="letterhead-headline">
                      {jobTitle || doc.contact.headline || "Professional"}
                    </p>
                    <p className="letterhead-contact">
                      {[
                        doc.contact.email,
                        doc.contact.phone,
                        doc.contact.location,
                        doc.contact.website,
                      ]
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
                onClick={() => exportLetter("copy")}
                disabled={busy}
              >
                Copy to clipboard
              </button>
              <button
                type="button"
                onClick={() => exportLetter("print")}
                disabled={busy}
                title="Print or Save as PDF"
              >
                🖨️ Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => exportLetter("txt")}
                disabled={busy}
              >
                Download .txt
              </button>
              <button
                type="button"
                onClick={() => exportLetter("md")}
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
