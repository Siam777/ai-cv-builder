"use client";

import { useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import type { ImportTidyResult } from "@/lib/ai-contract";
import { applyTidy } from "@/lib/import-tidy";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import { labels } from "@/lib/document";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { Sparkles, Undo2, X } from "lucide-react";
import { AiProgress } from "./AiProgress";

export interface StagedImportData {
  document: ResumeDocument;
  warnings: string[];
  sourceFile: string;
}

/** Tidy with AI (Go and Pro): structure-only fixes before the import is saved. */
export interface ImportTidyOptions {
  /** Signed-in account; tidying needs one even though the import is not saved yet. */
  owner: string | null;
  allowed: boolean;
  /** False when AI is not set up here; null when unknown. */
  configured: boolean | null;
  consent: boolean;
  grantConsent: () => Promise<void>;
  onSeePlans: () => void;
  onSignIn: () => void;
  onTidied: (document: ResumeDocument) => void;
}

export interface ImportReviewModalProps {
  staged: StagedImportData;
  tidy?: ImportTidyOptions;
  hasActiveDoc: boolean;
  busy: boolean;
  onRestoreAsNew: () => void;
  onReplaceActive?: () => void;
  onCancel: () => void;
}

export function ImportReviewModal({
  staged,
  tidy,
  hasActiveDoc,
  busy,
  onRestoreAsNew,
  onReplaceActive,
  onCancel,
}: ImportReviewModalProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus<HTMLElement>(() => { if (!busy) onCancel(); });
  const doc = staged.document;
  const [tidyState, setTidyState] = useState<
    | { stage: "idle" }
    | { stage: "consent" }
    | { stage: "working" }
    | { stage: "done"; original: ResumeDocument; changes: string[]; dropped: number }
    | { stage: "error"; message: string; plans?: boolean }
  >({ stage: "idle" });

  async function runTidy() {
    if (!tidy?.owner) return;
    setTidyState({ stage: "working" });
    const original = staged.document;
    try {
      // The photo is never sent; the rest of the import is checked like any CV.
      const { photoUrl: _photo, ...contact } = original.contact;
      void _photo;
      const result = (await accountRequest(
        "/api/ai/import-tidy",
        {
          method: "POST",
          signal: AbortSignal.timeout(65000),
          body: JSON.stringify({ requestId: crypto.randomUUID(), document: { ...original, contact } }),
        },
        tidy.owner,
      )) as ImportTidyResult;
      const { document, changes } = applyTidy(original, result.ops);
      if (changes.length) tidy.onTidied(document);
      setTidyState({ stage: "done", original, changes, dropped: result.dropped });
    } catch (error) {
      if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
        return setTidyState({ stage: "consent" });
      setTidyState({
        stage: "error",
        message:
          error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
            ? "The assistant could not finish in time or lost its connection. Your import was kept as it was."
            : (error as Error).message,
        plans: error instanceof CloudRequestError && (error.code === "AI_LIMIT" || error.code === "PLAN_REQUIRED"),
      });
    }
  }
  const totalEntries = doc.sections.reduce((n, s) => n + s.entries.length, 0);
  const populatedSections = doc.sections.filter((s) => s.entries.length > 0);

  return (
    <div
      className="modal-backdrop import-review-backdrop no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="presentation"
    >
      <section
        className="import-review modal-card import-review-card no-print"
        aria-label="Review imported resume"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Review import</p>
            <h2>{doc.name}</h2>
            <p className="import-meta" style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
              Extracted from <strong>{staged.sourceFile}</strong> · {populatedSections.length} sections ·{" "}
              {totalEntries} entries
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close dialog"
            disabled={busy}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="modal-body import-review-body">
          {staged.warnings.length > 0 && (
            <div className="import-warnings-box" role="alert">
              <strong>Import Notes &amp; Warnings:</strong>
              <ul>
                {staged.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {tidy && (
            <section className="import-tidy" aria-labelledby="import-tidy-heading">
              <h4 id="import-tidy-heading">
                <Sparkles size={16} aria-hidden /> Tidy with AI
              </h4>
              {!tidy.owner ? (
                <p className="field-ai-help">
                  Sign in to tidy this import with AI. New accounts get Go free during the beta.
                </p>
              ) : !tidy.allowed ? (
                <div className="field-ai-note">
                  <p>Tidying an imported CV with AI is part of Go and Pro.</p>
                  <button type="button" onClick={tidy.onSeePlans} disabled={busy}>
                    See plans
                  </button>
                </div>
              ) : tidy.configured === false ? (
                <p className="field-ai-help">AI is not set up on this installation.</p>
              ) : tidyState.stage === "consent" ? (
                <div className="field-ai-form">
                  <p>
                    <strong>Use AI writing help?</strong> Your CV text is sent to OpenAI; contact details and
                    photos are not. You can turn this off in Account settings, Data &amp; privacy.
                  </p>
                  <div className="field-ai-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        void tidy
                          .grantConsent()
                          .then(runTidy)
                          .catch((e: Error) => setTidyState({ stage: "error", message: e.message }))
                      }
                    >
                      Turn on AI writing help
                    </button>
                    <button type="button" onClick={() => setTidyState({ stage: "idle" })}>
                      Not now
                    </button>
                  </div>
                </div>
              ) : tidyState.stage === "done" ? (
                <div className="field-ai-form" role="status">
                  {tidyState.changes.length ? (
                    <>
                      <p>
                        <strong>What moved</strong> (your wording was not changed):
                      </p>
                      <ul>
                        {tidyState.changes.map((change, index) => (
                          <li key={index}>{change}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          tidy.onTidied(tidyState.original);
                          setTidyState({ stage: "idle" });
                        }}
                      >
                        <Undo2 size={16} aria-hidden /> Undo tidy
                      </button>
                    </>
                  ) : (
                    <p>Nothing needed tidying. The import is unchanged.</p>
                  )}
                  {tidyState.dropped > 0 && (
                    <p className="field-ai-help">
                      {tidyState.dropped} suggested change{tidyState.dropped === 1 ? " was" : "s were"} left
                      out because {tidyState.dropped === 1 ? "it" : "they"} would have changed your wording or
                      used dates your CV does not show.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="field-ai-help">
                    Fixes the structure only: moves items to the right section, splits run-on bullets and
                    sets dates written in the text. Your wording is never changed. Sends the CV text, not
                    your contact details or photo.
                  </p>
                  {tidyState.stage === "working" && (
                    <AiProgress
                      title="Tidying the imported CV"
                      steps={["Reading the imported text", "Moving items to the right sections", "Checking your wording is unchanged"]}
                    />
                  )}
                  {tidyState.stage === "error" && (
                    <div className="field-ai-note">
                      <p className="field-ai-error" role="alert">{tidyState.message}</p>
                      {tidyState.plans && (
                        <button type="button" onClick={tidy.onSeePlans}>See plans</button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy || tidyState.stage === "working"}
                    onClick={() => (tidy.consent ? void runTidy() : setTidyState({ stage: "consent" }))}
                  >
                    {tidyState.stage === "working" ? "Tidying…" : "Tidy with AI"}
                  </button>
                </>
              )}
            </section>
          )}

          <div className="import-extracted-summary">
            <div className="extracted-card">
              <h4>Contact Details</h4>
              <p>
                <strong>{doc.contact.name || "—"}</strong>
                {doc.contact.headline ? ` · ${doc.contact.headline}` : ""}
              </p>
              <p className="contact-sub">
                {[doc.contact.email, doc.contact.phone, doc.contact.location]
                  .filter(Boolean)
                  .join(" • ") || "No direct contact details found"}
              </p>
            </div>

            <div className="extracted-card">
              <h4>Detected Sections</h4>
              <ul className="extracted-section-list">
                {populatedSections.map((s) => (
                  <li key={s.id}>
                    <strong>{s.label || labels[s.type]}:</strong> {s.entries.length}{" "}
                    {s.entries.length === 1 ? "entry" : "entries"}
                    {s.type === "experience" && (
                      <span className="bullet-count">
                        {" "}
                        (
                        {s.entries.reduce(
                          (sum, e) => sum + e.bullets.length,
                          0,
                        )}{" "}
                        bullets)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="button-row">
          <button
            type="button"
            disabled={busy}
            className="primary"
            onClick={onRestoreAsNew}
          >
            Restore as new
          </button>
          {hasActiveDoc && onReplaceActive && (
            <button
              type="button"
              disabled={busy}
              onClick={onReplaceActive}
            >
              Replace active content
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </section>
  </div>
  );
}
