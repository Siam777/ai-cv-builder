"use client";

import { useState } from "react";
import type { ResumeDocument } from "@/lib/document";

export function EditorStartGuide({
  doc,
  busy,
  onSection,
  onReview,
}: {
  doc: ResumeDocument;
  busy: boolean;
  onSection: (id: string) => void;
  onReview: () => void;
}) {
  const [open, setOpen] = useState(
    !doc.contact.name &&
      doc.sections.every((section) => !section.entries.length),
  );
  if (
    doc.provenance.purpose !== "personal" ||
    !["blank", "example"].includes(doc.provenance.origin)
  )
    return null;
  return (
    <section
      className="editor-start-guide no-print"
      aria-label="Resume start guide"
    >
      <button
        className="guide-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="resume-start-steps"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide start guide" : "Show start guide"}
      </button>
      {open && (
        <div id="resume-start-steps" className="guide-steps">
          <div>
            <h2>Start with your details</h2>
            <p>
              Use your name and a way to reach you. You can rename this draft
              separately.
            </p>
            <button disabled={busy} onClick={() => onSection("contact")}>
              Add personal details
            </button>
          </div>
          <div>
            <h2>Lead with what you have</h2>
            <p>
              Experience, education or projects can come first. Add only work
              you can support.
            </p>
            <div className="button-row">
              {doc.sections
                .filter((section) =>
                  ["experience", "education", "projects"].includes(
                    section.type,
                  ),
                )
                .map((section) => (
                  <button
                    key={section.id}
                    disabled={busy}
                    onClick={() => onSection(section.id)}
                  >
                    Start with {section.label}
                  </button>
                ))}
            </div>
          </div>
          <div>
            <h2>Review before sending</h2>
            <p>
              Preview the pages and review the wording. Sign in to download.
            </p>
            <button disabled={busy} onClick={onReview}>
              Open content review
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
