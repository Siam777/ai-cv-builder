"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  Copy,
  FilePlus2,
  FileUp,
  FolderOpen,
  History,
  Palette,
  Trash2,
  PenLine,
  Redo2,
  Sparkles,
  Undo2,
  UserCheck,
  FlaskConical,
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
  /** Findings to fix (not dismissed, not just sections not started yet). */
  issueCount: number;
  activePanel: SidePanelId | null;
  onRename: (name: string) => void;
  onSelectDocument: (id: string) => void;
  onNew: () => void;
  /** Deletes the open CV after confirmation. */
  onDelete: () => void;
  onDuplicate: () => void;
  onImportClick: () => void;
  onOpenHistory: () => void;
  onOpenDemoGallery: () => void;
  onOpenAiGenerator: () => void;
  onMarkPersonal?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePanel: (panel: SidePanelId) => void;
  onPrint: () => void;
  onExport: (format: ExportFormat) => void;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { doc, busy, activePanel } = props;
  const exportMenu = useRef<HTMLDetailsElement>(null);

  // The toolbar is sticky; panels below it offset by its live height.
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = toolbar.current;
    if (!node) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty("--editor-toolbar-height", `${node.offsetHeight}px`),
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--editor-toolbar-height");
    };
  }, []);

  // Once the page scrolls past the toolbar's resting place it is "stuck";
  // on phones the stuck toolbar keeps only its action row.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    // Collapsing shortens the page. On a page that barely scrolls that would
    // pull the scroll back and expand it again, so only collapse with room.
    const observer = new IntersectionObserver((entries) => {
      // Several changes can arrive together; the last one is current.
      const entry = entries[entries.length - 1];
      setStuck(
        !entry.isIntersecting &&
          document.documentElement.scrollHeight - window.innerHeight > 240,
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
      hint: "Upload, import or blank",
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
      label: "Practice CV (fictional)",
      hint: "Built-in fictional CV, not AI",
      icon: <FlaskConical size={16} aria-hidden />,
      onSelect: props.onOpenAiGenerator,
    },
    {
      label: "Delete this CV",
      icon: <Trash2 size={16} aria-hidden />,
      onSelect: props.onDelete,
      separated: true,
      className: "menu-danger",
    },
  ];

  const status =
    props.savedToAccount && props.status === "Saved in this browser"
      ? "Saved to your account"
      : props.status;

  return (
    <>
    <div ref={sentinel} className="toolbar-sentinel" aria-hidden />
    <div ref={toolbar} className={`editor-toolbar no-print${stuck ? " is-stuck" : ""}`} aria-label="CV actions" role="toolbar">
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
          title="Check my CV: things to fix and what is still missing."
        >
          <ClipboardCheck size={16} aria-hidden />
          <span className="toolbar-label check-label">Check</span>
          {props.issueCount > 0 && (
            <span className="strength-badge">
              {props.issueCount}
              <span className="sr-only"> to fix</span>
            </span>
          )}
        </button>
        <button
          type="button"
          className="ai-button"
          aria-pressed={activePanel === "ai"}
          aria-controls="side-panel"
          disabled={busy}
          onClick={() => props.onTogglePanel("ai")}
          title="Help finishing your CV, matching a job and writing a cover letter"
        >
          <Sparkles size={16} aria-hidden />
          <span className="toolbar-label">AI Assistant</span>
        </button>
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
    </>
  );
}
