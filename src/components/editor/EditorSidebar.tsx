"use client";

import { labels, type ResumeDocument } from "@/lib/document";
import type { CvStrength, StepStatus } from "@/lib/cv-strength";
import { ArrowRight, EyeOff, Plus } from "lucide-react";

export interface EditorSidebarProps {
  doc: ResumeDocument;
  sectionId: string;
  strength: CvStrength;
  onSelectSection: (id: string) => void;
  onAddSection?: () => void;
  onNextStep?: (stepId: string) => void;
}

const STATUS_TEXT: Record<StepStatus, string> = {
  empty: "not started",
  progress: "in progress",
  done: "complete",
  issues: "needs review",
};

/** A coloured dot; the status is read after the step name. */
function StatusDot({ status }: { status: StepStatus }) {
  return (
    <span
      className={`step-dot ${status}`}
      title={STATUS_TEXT[status]}
      aria-hidden="true"
    />
  );
}

function StatusText({ status }: { status: StepStatus }) {
  return <span className="sr-only">{`, ${STATUS_TEXT[status]}`}</span>;
}

/** The step list: every part of the CV, its status, and the strength meter. */
export function EditorSidebar({
  doc,
  sectionId,
  strength,
  onSelectSection,
  onAddSection,
  onNextStep,
}: EditorSidebarProps) {
  const next = strength.next;
  return (
    <aside className="section-nav no-print" aria-label="Resume sections">
      <p className="eyebrow">Steps</p>
      <button
        type="button"
        className={sectionId === "contact" ? "selected" : ""}
        aria-current={sectionId === "contact" ? "step" : undefined}
        onClick={() => onSelectSection("contact")}
      >
        <StatusDot status={strength.steps.contact ?? "empty"} />
        <span className="nav-label">
          Personal details
          <StatusText status={strength.steps.contact ?? "empty"} />
        </span>
      </button>
      {doc.sections.map((s) => (
        <button
          type="button"
          key={s.id}
          className={sectionId === s.id ? "selected" : ""}
          aria-current={sectionId === s.id ? "step" : undefined}
          onClick={() => onSelectSection(s.id)}
        >
          <StatusDot status={strength.steps[s.id] ?? "empty"} />
          <span className="nav-label">
            {s.label || labels[s.type]}
            <StatusText status={strength.steps[s.id] ?? "empty"} />
          </span>
          {!s.visible && <EyeOff size={14} aria-label="Hidden from CV" />}
        </button>
      ))}
      {onAddSection && (
        <button
          type="button"
          className="add-section-nav-btn"
          onClick={onAddSection}
          title="Add a custom section or preset"
        >
          <Plus size={16} aria-hidden />
          <span className="nav-label">Add section</span>
        </button>
      )}

      <section className="strength-card" aria-label="CV strength">
        <div className="strength-heading">
          <strong>CV strength</strong>
          <span>{strength.percent}%</span>
        </div>
        <div
          className="strength-meter"
          role="meter"
          aria-label="CV strength"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={strength.percent}
          aria-valuetext={`${strength.percent}% complete`}
        >
          <span style={{ width: `${strength.percent}%` }} />
        </div>
        <p className="strength-note">How complete your CV is. Not a hiring score.</p>
        {next ? (
          <button
            type="button"
            className="next-step"
            onClick={() => onNextStep?.(next.stepId)}
          >
            <span>
              Suggested: {next.action}
              <small>+{Math.round((next.weight / strength.items.reduce((s, i) => s + i.weight, 0)) * 100)}%</small>
            </span>
            <ArrowRight size={16} aria-hidden />
          </button>
        ) : (
          <p className="strength-done">Everything is filled in. Check your wording next.</p>
        )}
      </section>
    </aside>
  );
}
