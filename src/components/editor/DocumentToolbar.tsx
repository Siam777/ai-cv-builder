"use client";

import type { ResumeDocument } from "@/lib/document";

export type ExportFormat = "json" | "txt" | "md" | "html" | "docx" | "pdf";

export interface DocumentToolbarProps {
  doc: ResumeDocument;
  documents: ResumeDocument[];
  busy: boolean;
  undoCount: number;
  showDesign: boolean;
  onSelectDocument: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onImportClick: () => void;
  onUndo: () => void;
  onToggleDesign: () => void;
  onOpenAI: () => void;
  onOpenAiGenerator?: () => void;
  onOpenDemoGallery?: () => void;
  onOpenAts?: () => void;
  onOpenTailor?: () => void;
  onOpenCoverLetter?: () => void;
  onOpenHistory?: () => void;
  onPrint: () => void;
  onExport: (format: ExportFormat) => void;
}

export function DocumentToolbar({
  doc,
  documents,
  busy,
  undoCount,
  showDesign,
  onSelectDocument,
  onNew,
  onDuplicate,
  onImportClick,
  onUndo,
  onToggleDesign,
  onOpenAI,
  onOpenAiGenerator,
  onOpenDemoGallery,
  onOpenAts,
  onOpenTailor,
  onOpenCoverLetter,
  onOpenHistory,
  onPrint,
  onExport,
}: DocumentToolbarProps) {
  return (
    <div className="document-toolbar no-print">
      <div className="document-picker">
        <label htmlFor="resume-select">RESUME</label>
        <select
          id="resume-select"
          value={doc.id}
          disabled={busy}
          onChange={(e) => onSelectDocument(e.target.value)}
        >
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="button-row">
        {onOpenDemoGallery && (
          <button
            type="button"
            disabled={busy}
            onClick={onOpenDemoGallery}
            style={{ fontWeight: 600, color: "#1e3a8a", background: "#eff6ff", borderColor: "#bfdbfe" }}
            title="Test templates with realistic pre-built demo resumes"
          >
            📂 Demo CVs
          </button>
        )}
        {onOpenAiGenerator && (
          <button
            type="button"
            disabled={busy}
            onClick={onOpenAiGenerator}
            style={{ fontWeight: 600, color: "#065f46", background: "#ecfdf5", borderColor: "#a7f3d0" }}
            title="Generate a high-impact, role-tailored resume draft with AI"
          >
            ✨ AI Quick-Start
          </button>
        )}
        <button disabled={busy} onClick={onNew}>
          + New
        </button>
        <button disabled={busy} onClick={onDuplicate}>
          Duplicate
        </button>
        <button disabled={busy} onClick={onImportClick}>
          Import JSON
        </button>
        <button disabled={busy || !undoCount} onClick={onUndo}>
          ↶ Undo
        </button>
        <button
          aria-expanded={showDesign}
          aria-controls="design-panel"
          onClick={onToggleDesign}
        >
          Design & templates
        </button>
        {onOpenAts && (
          <button disabled={busy} onClick={onOpenAts} title="Analyze role match score, skill gaps, and ATS readiness">
            📊 Role Benchmark & Gaps
          </button>
        )}
        <button disabled={busy} onClick={onOpenAI}>
          AI bullet assistant
        </button>
        {onOpenTailor && (
          <button disabled={busy} onClick={onOpenTailor}>
            🎯 Tailor for job
          </button>
        )}
        {onOpenCoverLetter && (
          <button disabled={busy} onClick={onOpenCoverLetter}>
            ✉️ Cover letter
          </button>
        )}
        {onOpenHistory && (
          <button disabled={busy} onClick={onOpenHistory} title="View checkpoints and version history">
            ⏱️ History
          </button>
        )}
        <details
          className="export-menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) {
              e.currentTarget.open = false;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.open = false;
              e.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Export <span>↓</span>
          </summary>
          <div>
            <button onClick={() => onExport("pdf")}>PDF Document (.pdf)</button>
            <button onClick={onPrint}>Print / Save as PDF</button>
            <button onClick={() => onExport("html")}>Standalone HTML (.html)</button>
            <button onClick={() => onExport("docx")}>Word Document (.docx)</button>
            <button onClick={() => onExport("md")}>Markdown (.md)</button>
            <button onClick={() => onExport("txt")}>Plain text (.txt)</button>
            <button onClick={() => onExport("json")}>Backup (.json)</button>
          </div>
        </details>
      </div>
    </div>
  );
}
