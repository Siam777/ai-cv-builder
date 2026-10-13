"use client";

import { useRef, useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import { ChartColumn, ChevronDown, History, Mail, Target, Undo2 } from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);
  const toolsButton = useRef<HTMLButtonElement>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);

  function closeExport(restoreFocus = false) {
    if (!exportMenu.current) return;
    exportMenu.current.open = false;
    if (restoreFocus) exportMenu.current.querySelector("summary")?.focus();
  }

  return (
    <div className="document-toolbar no-print" aria-label="CV actions">
      <div className="toolbar-primary">
        <div className="document-picker">
          <label htmlFor="resume-select">Resume</label>
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
          <button type="button" disabled={busy || !undoCount} onClick={onUndo}>
            <Undo2 size={16} aria-hidden /> Undo
          </button>
          <button
            type="button"
            disabled={busy}
            aria-expanded={showDesign}
            aria-controls="design-panel"
            onClick={onToggleDesign}
          >
            Design & templates
          </button>
          <button
            type="button"
            ref={toolsButton}
            disabled={busy}
            aria-expanded={expanded}
            aria-controls="additional-cv-tools"
            onClick={() => setExpanded(!expanded)}
          >
            More tools
          </button>
          <details
            className="export-menu"
            ref={exportMenu}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                closeExport();
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button"))
                closeExport(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closeExport(true);
              }
            }}
          >
            <summary
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
              aria-disabled={busy}
            >
              Export <ChevronDown size={16} aria-hidden />
            </summary>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onExport("pdf")}
              >
                PDF Document (.pdf)
              </button>
              <button type="button" disabled={busy} onClick={onPrint}>
                Print / Save as PDF
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onExport("html")}
              >
                Standalone HTML (.html)
              </button>
              <button
                type="button"
                disabled={busy}
                title="Editable single-column document; decorative rails and photos are omitted. Word may wrap text differently."
                onClick={() => onExport("docx")}
              >
                Word Document (.docx)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onExport("md")}
              >
                Markdown (.md)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onExport("txt")}
              >
                Plain text (.txt)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onExport("json")}
              >
                Backup (.json)
              </button>
            </div>
          </details>
        </div>
      </div>
      <div
        id="additional-cv-tools"
        className="toolbar-tools"
        hidden={!expanded}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(false);
            toolsButton.current?.focus();
          }
        }}
      >
        <div role="group" aria-label="Manage CV" className="toolbar-tool-group">
          <h2>Manage CV</h2>
          <div className="button-row">
            <button type="button" disabled={busy} onClick={onNew}>
              + New
            </button>
            <button type="button" disabled={busy} onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" disabled={busy} onClick={onImportClick}>
              Import JSON
            </button>
            {onOpenHistory && (
              <button type="button" disabled={busy} onClick={onOpenHistory}>
                <History size={16} aria-hidden /> History
              </button>
            )}
          </div>
        </div>
        <div
          role="group"
          aria-label="Writing tools"
          className="toolbar-tool-group"
        >
          <h2>Writing tools</h2>
          <div className="button-row">
            {onOpenAts && (
              <button
                type="button"
                disabled={busy}
                onClick={onOpenAts}
                title="Review content findings and confirm a curated role checklist"
              >
                <ChartColumn size={16} aria-hidden /> Role Benchmark & Gaps
              </button>
            )}
            <button type="button" disabled={busy} onClick={onOpenAI}>
              AI bullet assistant
            </button>
            {onOpenTailor && (
              <button type="button" disabled={busy} onClick={onOpenTailor}>
                <Target size={16} aria-hidden /> Tailor for job
              </button>
            )}
            {onOpenCoverLetter && (
              <button type="button" disabled={busy} onClick={onOpenCoverLetter}>
                <Mail size={16} aria-hidden /> Cover letter
              </button>
            )}
          </div>
        </div>
        {(onOpenDemoGallery || onOpenAiGenerator) && (
          <div
            role="group"
            aria-label="Fictional examples"
            className="toolbar-tool-group"
          >
            <h2>Fictional examples</h2>
            <div className="button-row">
              {onOpenDemoGallery && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onOpenDemoGallery}
                >
                  Demo examples
                </button>
              )}
              {onOpenAiGenerator && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onOpenAiGenerator}
                >
                  Create practice example
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
