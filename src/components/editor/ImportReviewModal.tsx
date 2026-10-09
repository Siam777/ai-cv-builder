"use client";

import type { ResumeDocument } from "@/lib/document";
import { labels } from "@/lib/document";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export interface StagedImportData {
  document: ResumeDocument;
  warnings: string[];
  sourceFile: string;
}

export interface ImportReviewModalProps {
  staged: StagedImportData;
  hasActiveDoc: boolean;
  busy: boolean;
  onRestoreAsNew: () => void;
  onReplaceActive?: () => void;
  onCancel: () => void;
}

export function ImportReviewModal({
  staged,
  hasActiveDoc,
  busy,
  onRestoreAsNew,
  onReplaceActive,
  onCancel,
}: ImportReviewModalProps) {
  useBodyScrollLock(true);
  const doc = staged.document;
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
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">COLD-START ONBOARDING · REVIEW IMPORT</p>
            <h2>{doc.name}</h2>
            <p className="import-meta" style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
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
            ✕
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
