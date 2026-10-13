"use client";

import { useRef } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  Copy,
  FilePlus2,
  FileUp,
  FolderOpen,
  History,
  Palette,
  PenLine,
  Redo2,
  Sparkles,
  Undo2,
  UserCheck,
  Wand2,
} from "lucide-react";
import type { ResumeDocument } from "@/lib/document";
import { Menu, type MenuItem } from "./Menu";
import type { SaveState } from "./types";

export type ExportFormat = "json" | "txt" | "md" | "html" | "docx" | "pdf";
export type SidePanelId = "design" | "check" | "ai";

export interface EditorToolbarProps {
  doc: ResumeDocument;
  /** CVs in the same collection, for the switcher. */
  documents: ResumeDocument[];
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  status: SaveState;
  savedToAccount: boolean;
  /** Shown next to the save status when the CV only lives in this browser. */
  saveAction?: { label: string; onClick: () => void };
  strength: number;
  activePanel: SidePanelId | null;
  onRename: (name: string) => void;
  onSelectDocument: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onImportClick: () => void;
  onOpenHistory: () => void;
  onOpenDemoGallery: () => void;
  onOpenAiGenerator: () => void;
  onMarkPersonal?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePanel: (panel: SidePanelId) => void;
  onWritingHelp: () => void;
  onMatchJob: () => void;
  onCoverLetter: () => void;
  onPrint: () => void;
  onExport: (format: ExportFormat) => void;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { doc, busy, activePanel } = props;
  const exportMenu = useRef<HTMLDetailsElement>(null);

  function closeExport(restoreFocus = false) {
    if (!exportMenu.current) return;
    exportMenu.current.open = false;
    if (restoreFocus) exportMenu.current.querySelector("summary")?.focus();
  }

  const others = props.documents.filter((d) => d.id !== doc.id);
  const cvItems: MenuItem[] = [
    ...others.slice(0, 8).map((d, index) => ({
      label: d.name,
      hint: index === 0 ? "Switch to" : undefined,
      icon: <FolderOpen size={16} aria-hidden />,
      className: "cv-switch",
      onSelect: () => props.onSelectDocument(d.id),
    })),
    {
      label: "New",
      hint: "Blank CV",
      icon: <FilePlus2 size={16} aria-hidden />,
      onSelect: props.onNew,
      separated: others.length > 0,
    },
    {
      label: "Duplicate",
      icon: <Copy size={16} aria-hidden />,
      onSelect: props.onDuplicate,
    },
    {
      label: "Import JSON",
      hint: "Restore a backup",
      icon: <FileUp size={16} aria-hidden />,
      onSelect: props.onImportClick,
    },
    {
      label: "History",
      hint: "Saved versions",
      icon: <History size={16} aria-hidden />,
      onSelect: props.onOpenHistory,
    },
    ...(props.onMarkPersonal
      ? [
          {
            label: "Mark as my CV",
            hint: "This is my own information",
            icon: <UserCheck size={16} aria-hidden />,
            onSelect: props.onMarkPersonal,
          },
        ]
      : []),
    {
      label: "Demo examples",
      hint: "Fictional CVs to explore",
      icon: <FolderOpen size={16} aria-hidden />,
      onSelect: props.onOpenDemoGallery,
      separated: true,
    },
    {
      label: "Create practice example",
      hint: "A fictional CV for practice",
      icon: <Wand2 size={16} aria-hidden />,
      onSelect: props.onOpenAiGenerator,
    },
  ];

  const aiItems: MenuItem[] = [
    {
      label: "Writing help",
      hint: "Bullets, summary, results and skills",
      onSelect: props.onWritingHelp,
    },
    {
      label: "Match a job",
      hint: "Compare your CV with a job posting",
      onSelect: props.onMatchJob,
    },
    {
      label: "Cover letter",
      hint: "Draft a letter from your CV",
      onSelect: props.onCoverLetter,
    },
  ];

  const status =
    props.savedToAccount && props.status === "Saved in this browser"
      ? "Saved to your account"
      : props.status;

  return (
    <div className="editor-toolbar no-print" aria-label="CV actions" role="toolbar">
      <div className="toolbar-document">
        <label className="cv-title">
          <PenLine size={16} aria-hidden />
          <span className="sr-only">CV name</span>
          <input
            value={doc.name}
            maxLength={200}
            disabled={busy}
            onChange={(e) => props.onRename(e.target.value)}
            onBlur={(e) => {
              if (!e.target.value.trim()) props.onRename("Untitled resume");
            }}
          />
        </label>
        <Menu
          ariaLabel="CV options"
          label={<ChevronDown size={18} aria-hidden />}
          items={cvItems}
          disabled={busy}
          className="cv-menu"
        />
        {doc.provenance.purpose !== "personal" && (
          <span className="cv-kind">
            {doc.provenance.purpose === "practice" ? "Practice CV" : "Older draft"}
          </span>
        )}
        <div className="save-indicator">
          <div className="save-status" role="status" aria-live="polite">
            <span className={props.status === "Save failed" ? "dot failed" : "dot"} />
            {status}
          </div>
          {props.saveAction && props.status !== "Loading" && (
            <button
              type="button"
              className="save-indicator-action"
              disabled={busy}
              onClick={props.saveAction.onClick}
            >
              {props.saveAction.label}
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-actions">
        <button
          type="button"
          className="icon-text"
          disabled={busy || !props.canUndo}
          onClick={props.onUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} aria-hidden />
          <span className="toolbar-label">Undo</span>
        </button>
        <button
          type="button"
          className="icon-text redo-button"
          disabled={busy || !props.canRedo}
          onClick={props.onRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} aria-hidden />
          <span className="toolbar-label">Redo</span>
        </button>
        <span className="toolbar-divider" aria-hidden />
        <button
          type="button"
          aria-pressed={activePanel === "design"}
          aria-controls="side-panel"
          disabled={busy}
          onClick={() => props.onTogglePanel("design")}
        >
          <Palette size={16} aria-hidden />
          <span className="toolbar-label">Design</span>
        </button>
        <button
          type="button"
          className="check-button"
          aria-pressed={activePanel === "check"}
          aria-controls="side-panel"
          disabled={busy}
          onClick={() => props.onTogglePanel("check")}
          title="CV strength: how complete your CV is. Not a hiring score."
        >
          <ClipboardCheck size={16} aria-hidden />
          <span className="toolbar-label check-label">Check</span>
          <span className="strength-badge">
            {props.strength}%<span className="sr-only"> complete</span>
          </span>
        </button>
        <Menu
          ariaLabel="AI Assistant"
          label={
            <>
              <Sparkles size={16} aria-hidden />
              <span className="toolbar-label">AI Assistant</span>
              <ChevronDown size={14} aria-hidden />
            </>
          }
          items={aiItems}
          disabled={busy}
          className="ai-menu"
          align="end"
        />
        <details
          className="export-menu"
          ref={exportMenu}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              closeExport();
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) closeExport(true);
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
            Download <ChevronDown size={16} aria-hidden />
          </summary>
          <div>
            <button type="button" disabled={busy} onClick={() => props.onExport("pdf")}>
              PDF Document (.pdf)
            </button>
            <button
              type="button"
              disabled={busy}
              title="Editable single-column document; decorative rails and photos are omitted. Word may wrap text differently."
              onClick={() => props.onExport("docx")}
            >
              Word Document (.docx)
            </button>
            <button type="button" disabled={busy} onClick={() => props.onExport("txt")}>
              Plain text (.txt)
            </button>
            <button type="button" disabled={busy} onClick={props.onPrint}>
              Print / Save as PDF
            </button>
            <button type="button" disabled={busy} onClick={() => props.onExport("md")}>
              Markdown (.md)
            </button>
            <button type="button" disabled={busy} onClick={() => props.onExport("html")}>
              Standalone HTML (.html)
            </button>
            <button type="button" disabled={busy} onClick={() => props.onExport("json")}>
              Backup (.json)
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
