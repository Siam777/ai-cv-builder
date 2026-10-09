"use client";

import { labels, type ResumeDocument } from "@/lib/document";
import type { AccountUser } from "@/lib/cloud-contract";

export interface EditorSidebarProps {
  doc: ResumeDocument;
  sectionId: string;
  cloudUser: AccountUser | null;
  onSelectSection: (id: string) => void;
  onAddSection?: () => void;
}

export function EditorSidebar({
  doc,
  sectionId,
  cloudUser,
  onSelectSection,
  onAddSection,
}: EditorSidebarProps) {
  return (
    <aside className="section-nav no-print">
      <p className="eyebrow">BUILD YOUR RESUME</p>
      <button
        className={sectionId === "contact" ? "selected" : ""}
        onClick={() => onSelectSection("contact")}
      >
        <span>01</span> Personal details <span>↗</span>
      </button>
      {doc.sections.map((s, i) => (
        <button
          key={s.id}
          className={sectionId === s.id ? "selected" : ""}
          onClick={() => onSelectSection(s.id)}
        >
          <span>{String(i + 2).padStart(2, "0")}</span>
          <span className="nav-label">{s.label || labels[s.type]}</span>
          {!s.visible && <span title="Hidden">○</span>}
        </button>
      ))}
      {onAddSection && (
        <button
          type="button"
          className="add-section-nav-btn"
          onClick={onAddSection}
          title="Add a custom section or preset"
        >
          <span>＋</span>
          <span className="nav-label">Add section</span>
        </button>
      )}
      <div className="sidebar-note">
        <span>✧</span>
        <strong>Make it yours.</strong>
        <p>Keep your story clear, specific, and true to your experience.</p>
      </div>
      <p className="local-note">
        {cloudUser ? "Saved in your account." : "Saved in this browser."}
        <br />
        Back up before changing devices.
      </p>
    </aside>
  );
}
