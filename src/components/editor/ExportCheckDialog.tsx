"use client";

import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { AtsLintIssue } from "@/lib/linter/ats-linter";
import { describeFinding } from "@/lib/check-findings";
import { useModalFocus } from "@/lib/use-modal-focus";

/**
 * A reminder before a CV export when consistency findings still need
 * attention. It never blocks: Export anyway continues the normal export.
 */
export function ExportCheckDialog({
  issues,
  onReview,
  onExportAnyway,
  onClose,
}: {
  issues: AtsLintIssue[];
  onReview: () => void;
  onExportAnyway: (skipForVersion: boolean) => void;
  onClose: () => void;
}) {
  const ref = useModalFocus(onClose);
  const [skip, setSkip] = useState(false);
  const titleId = useId();
  const count = issues.length;
  return (
    <div
      className="modal-backdrop no-print"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <section className="modal-card export-check-dialog">
        <div className="modal-body">
          <h2 id={titleId}>
            Before you send it: {count} {count === 1 ? "thing" : "things"} to
            check
          </h2>
          <ul className="export-check-list">
            {issues.slice(0, 5).map((issue) => {
              const copy = describeFinding(issue);
              return (
                <li key={issue.id}>
                  <TriangleAlert size={16} aria-hidden />
                  <span>
                    <strong>{copy.title}</strong>
                    {copy.detail && (
                      <span className="export-check-detail">{copy.detail}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {count > 5 && (
            <p className="helper-text">And {count - 5} more in Check my CV.</p>
          )}
          <label className="export-check-skip">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => setSkip(e.target.checked)}
            />
            Don&apos;t remind me for this version
          </label>
        </div>
        <footer className="modal-footer">
          <button type="button" className="primary" onClick={onReview}>
            Review
          </button>
          <button type="button" onClick={() => onExportAnyway(skip)}>
            Export anyway
          </button>
        </footer>
      </section>
    </div>
  );
}
