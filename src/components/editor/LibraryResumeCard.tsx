"use client";

import type { ResumeDocument } from "@/lib/document";
import { templates } from "@/lib/presentation";
import { ResumeThumbnail } from "@/components/public/PublicResume";

export function LibraryResumeCard({
  doc,
  accountEmail,
  busy,
  onOpen,
  onDuplicate,
  onDelete,
  onClassify,
}: {
  doc: ResumeDocument;
  accountEmail?: string;
  busy: boolean;
  onOpen: (doc: ResumeDocument) => void;
  onDuplicate: (doc: ResumeDocument) => void;
  onDelete: (doc: ResumeDocument) => void;
  onClassify: (doc: ResumeDocument, purpose: "personal" | "practice") => void;
}) {
  const purpose = doc.provenance.purpose;
  return (
    <article className="library-card" aria-label={doc.name}>
      <button
        className="library-preview"
        disabled={busy}
        onClick={() => onOpen(doc)}
        aria-label={`Open preview of ${doc.name}`}
      >
        <ResumeThumbnail doc={doc} scale={0.18} />
      </button>
      <div className="library-card-content">
        <span className="library-kind">
          {purpose === "personal"
            ? "Personal CV"
            : purpose === "practice"
              ? "Practice / sample"
              : "Needs review"}
        </span>
        <h3>{doc.name}</h3>
        <p>{doc.contact.name || "Add your name"}</p>
        <p>{doc.contact.headline || "Role not set"}</p>
        <p className="library-design">
          {
            templates.find((item) => item.id === doc.presentation.template)
              ?.name
          }{" "}
          design · Draft
        </p>
        <small>
          {accountEmail ? "Saved in your account" : "Saved on this device"} ·
          Updated{" "}
          <time dateTime={doc.updatedAt}>
            {new Date(doc.updatedAt).toLocaleDateString()}
          </time>
        </small>
        <div className="button-row library-card-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => onOpen(doc)}
          >
            Open CV
          </button>
          <button disabled={busy} onClick={() => onDuplicate(doc)}>
            Duplicate CV
          </button>
          <button
            className="library-delete"
            disabled={busy}
            onClick={() => onDelete(doc)}
          >
            Delete CV
          </button>
        </div>
        <div className="button-row library-classification">
          {purpose !== "personal" && (
            <button disabled={busy} onClick={() => onClassify(doc, "personal")}>
              Mark as my CV
            </button>
          )}
          {purpose !== "practice" && (
            <button disabled={busy} onClick={() => onClassify(doc, "practice")}>
              Mark as practice
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
