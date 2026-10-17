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
import { Printer, Sparkles, X } from "lucide-react";
import { useFieldAi } from "../editor/FieldAiContext";
import { AiBlocked, AiConsent } from "../editor/AiGate";
import { AiProgress } from "../editor/AiProgress";
import { rewriteStatus } from "@/lib/ai-access";
import type { CoverLetterResult } from "@/lib/ai-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";

export interface CoverLetterModalProps {
  doc: ResumeDocument;
  busy: boolean;
  onClose: () => void;
  /** Render inside the AI Assistant panel instead of as a dialog. */
  embedded?: boolean;
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
  embedded = false,
  onExport,
}: CoverLetterModalProps) {
  useBodyScrollLock(!embedded);
  const dialogRef = useModalFocus(onClose, !embedded);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [letter, setLetter] = useState<GeneratedCoverLetter | null>(null);
  const [editedText, setEditedText] = useState("");
  // Write with AI (Go and Pro): the person's reason for applying, and the request state.
  const ai = useFieldAi();
  const [note, setNote] = useState("");
  const [aiState, setAiState] = useState<
    | { stage: "idle" }
    | { stage: "consent" }
    | { stage: "working" }
    | { stage: "error"; message: string; plans?: boolean }
  >({ stage: "idle" });
  const [aiNote, setAiNote] = useState("");
  const aiStatus = ai ? rewriteStatus(ai.owner, ai.availability, ai.signedIn) : null;

  async function writeWithAi() {
    if (!ai) return;
    setAiState({ stage: "working" });
    try {
      const snapshot = await ai.prepare();
      const result = (await accountRequest(
        "/api/ai/cover-letter",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            job: {
              title: (jobTitle || "the role").slice(0, 120),
              ...(company.trim() ? { company: company.trim().slice(0, 120) } : {}),
              ...(jobDescription.trim() ? { post: jobDescription.trim().slice(0, 12000) } : {}),
            },
            ...(recipientName.trim() ? { recipient: recipientName.trim().slice(0, 120) } : {}),
            ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
          }),
        },
        ai.owner ?? undefined,
      )) as CoverLetterResult;
      if (!result.paragraphs.length) {
        setAiState({ stage: "error", message: result.message });
        return;
      }
      const generated = generateCoverLetter(doc, {
        title: jobTitle || "Target Role",
        company: company || "Target Company",
        recipientName: recipientName || "Hiring Team",
        description: jobDescription,
      });
      setLetter(generated);
      setEditedText(`Dear ${recipientName.trim() || "Hiring Team"},\n\n${result.paragraphs.join("\n\n")}`);
      setAiNote(
        `Written by AI from your CV${note.trim() ? " and your note" : ""}. Check every claim before you send it.${
          result.withheld
            ? ` ${result.withheld} paragraph${result.withheld === 1 ? " was" : "s were"} withheld because your CV does not support ${result.withheld === 1 ? "it" : "them"}.`
            : ""
        }`,
      );
      setAiState({ stage: "idle" });
    } catch (error) {
      if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
        return setAiState({ stage: "consent" });
      setAiState({
        stage: "error",
        message:
          error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
            ? "The assistant could not finish in time or lost its connection. Your CV was kept."
            : (error as Error).message,
        plans: error instanceof CloudRequestError && (error.code === "AI_LIMIT" || error.code === "PLAN_REQUIRED"),
      });
    }
  }

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
    setAiNote("");
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

  const content = (
    <>
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
              {ai && (
                <section className="cover-letter-ai" aria-labelledby="cover-letter-ai-heading">
                  <h4 id="cover-letter-ai-heading">
                    <Sparkles size={16} aria-hidden /> Write with AI
                  </h4>
                  {!ai.coverLetterAi ? (
                    <div className="field-ai-note">
                      <p>Writing a cover letter with AI is part of Go and Pro. The quick draft below works without AI.</p>
                      <button type="button" className="primary" onClick={ai.onSeePlans}>
                        See plans
                      </button>
                    </div>
                  ) : aiStatus !== "ready" ? (
                    <AiBlocked status={aiStatus!} services={ai} />
                  ) : aiState.stage === "consent" ? (
                    <AiConsent
                      services={ai}
                      sends="Sends the job details, your note, and your headline, jobs, bullets, education and skills to OpenAI. Contact details are not sent."
                      onAgreed={() => void writeWithAi()}
                      onCancel={() => setAiState({ stage: "idle" })}
                    />
                  ) : (
                    <>
                      <label>
                        Why do you want this job? (optional, in your words)
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={note}
                          placeholder="e.g. I use their app every week and want to work on scheduling tools."
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      <p className="field-ai-help">
                        AI writes 3–4 short paragraphs from your CV and this note. The job post says what to
                        emphasise; it is never presented as your experience. Sends the job details, your note and
                        your CV text, not your contact details.
                      </p>
                      {aiState.stage === "working" && (
                        <AiProgress
                          title="Writing your cover letter"
                          steps={["Reading your CV and the job", "Writing the letter", "Checking every claim against your CV"]}
                        />
                      )}
                      {aiState.stage === "error" && (
                        <div className="field-ai-note">
                          <p className="field-ai-error" role="alert">{aiState.message}</p>
                          {aiState.plans && (
                            <button type="button" onClick={ai.onSeePlans}>See plans</button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className="tailor-results-stage">
              <div
                className="coverage-card"
                style={{ padding: "0.85rem 1rem", marginBottom: "1rem" }}
              >
                <div className="score-summary">
                  <h3 style={{ margin: 0, fontSize: "var(--text-md)" }}>
                    Letter for {jobTitle || "Role"} at {company || "Company"}
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "var(--text-xs)",
                      color: "var(--muted)",
                    }}
                  >
                    {aiNote ||
                      `Uses ${letter.matchedEvidenceCount} selected resume bullets. Review the facts and edit the narrative below before exporting.`}
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
              {ai?.coverLetterAi && aiStatus === "ready" && (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || aiState.stage === "working"}
                  onClick={() =>
                    ai.aiConsent ? void writeWithAi() : setAiState({ stage: "consent" })
                  }
                >
                  <Sparkles size={16} aria-hidden />{" "}
                  {aiState.stage === "working" ? "Writing your letter…" : "Write with AI"}
                </button>
              )}
              <button
                type="button"
                className={ai?.coverLetterAi && aiStatus === "ready" ? undefined : "primary"}
                disabled={busy}
                onClick={handleGenerate}
              >
                Quick draft (template)
              </button>
              {!embedded && (
                <button type="button" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
              )}
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
                <Printer size={16} aria-hidden /> Print / Save as PDF
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
              {!embedded && (
                <button type="button" onClick={onClose} disabled={busy}>
                  Done
                </button>
              )}
            </>
          )}
        </div>
    </>
  );

  if (embedded)
    return (
      <section
        className="embedded-tool tailor-modal cover-letter-embedded"
        aria-label="Cover letter"
      >
        <h3 className="embedded-tool-title">Cover letter</h3>
        {content}
      </section>
    );
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
            <X size={18} aria-hidden />
          </button>
        </header>
        {content}
      </div>
    </div>
  );
}
