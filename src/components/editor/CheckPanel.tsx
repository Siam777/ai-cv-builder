"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Circle,
  Info,
  Lightbulb,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import type { ResumeDocument } from "@/lib/document";
import type { AtsLintIssue } from "@/lib/linter/ats-linter";
import { auditAtsExtraction } from "@/lib/linter/ats-plain-text";
import type { CvStrength } from "@/lib/cv-strength";
import {
  describeFinding,
  groupFindings,
  isNotStarted,
  issuesToFix,
} from "@/lib/check-findings";
import { FileDiagnostics } from "./FileDiagnostics";
import { RoleComparison } from "./RoleComparison";

export interface CheckPanelProps {
  doc: ResumeDocument;
  strength: CvStrength;
  /** Every finding for the CV, including dismissed ones. */
  issues: AtsLintIssue[];
  dismissed: Set<string>;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onFix: (issue: AtsLintIssue) => void;
  onOpenStep: (stepId: string) => void;
}

function FindingRow({
  issue,
  sourceText,
  active,
  dismissed,
  onFix,
  onDismiss,
  onRestore,
}: {
  issue: AtsLintIssue;
  sourceText?: string;
  active: boolean;
  dismissed: boolean;
  onFix: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const copy = describeFinding(issue, sourceText);
  return (
    <li
      className={`finding ${copy.tone}${active ? " active" : ""}${dismissed ? " dismissed" : ""}`}
      data-finding-id={issue.id}
    >
      <span className="finding-icon">
        {copy.tone === "attention" ? (
          <TriangleAlert size={18} aria-hidden />
        ) : (
          <Lightbulb size={18} aria-hidden />
        )}
        <span className="sr-only">
          {copy.tone === "attention" ? "Needs attention: " : "Suggestion: "}
        </span>
      </span>
      <div className="finding-text">
        <strong>{copy.title}</strong>
        {copy.quote && <q>{copy.quote}</q>}
        {copy.detail && <p>{copy.detail}</p>}
      </div>
      <div className="finding-actions">
        {dismissed ? (
          <button type="button" onClick={onRestore} aria-label={`Restore: ${copy.title}`}>
            <Undo2 size={16} aria-hidden /> Restore
          </button>
        ) : (
          <>
            <button type="button" onClick={onFix} aria-label={`Fix: ${copy.title}`}>
              Fix
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onDismiss}
              aria-label={`Dismiss: ${copy.title}`}
              title="Dismiss"
            >
              <X size={16} aria-hidden />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** Check my CV: completeness, findings to fix, role comparison and file views. */
export function CheckPanel({
  doc,
  strength,
  issues,
  dismissed,
  onDismiss,
  onRestore,
  onFix,
  onOpenStep,
}: CheckPanelProps) {
  const [tab, setTab] = useState<"fix" | "role">("fix");
  const [showInfo, setShowInfo] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [advancedView, setAdvancedView] = useState<"text" | "file">("text");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sections not started yet are to-dos, listed apart and not counted.
  const fixable = useMemo(() => issues.filter((issue) => !isNotStarted(issue)), [issues]);
  const open = useMemo(() => issuesToFix(issues, dismissed), [issues, dismissed]);
  const notStarted = useMemo(
    () => issues.filter((issue) => isNotStarted(issue) && !dismissed.has(issue.id)),
    [issues, dismissed],
  );
  const hidden = fixable.length - open.length;
  // With nothing dismissed there is nothing to show or hide.
  const listDismissed = showDismissed && hidden > 0;
  const groups = useMemo(
    () => groupFindings(doc, listDismissed ? fixable : open),
    [doc, fixable, open, listDismissed],
  );
  const ordered = useMemo(
    () =>
      groupFindings(doc, open).flatMap((group) => group.issues),
    [doc, open],
  );
  const bulletText = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of doc.sections)
      for (const entry of section.entries)
        for (const bullet of entry.bullets) map.set(bullet.id, bullet.text);
    return map;
  }, [doc]);
  const audit = useMemo(
    () => (advanced && advancedView === "text" ? auditAtsExtraction(doc) : null),
    [doc, advanced, advancedView],
  );

  function fix(issue: AtsLintIssue) {
    setActiveId(issue.id);
    onFix(issue);
  }

  function nextIssue() {
    if (!ordered.length) return;
    const index = ordered.findIndex((issue) => issue.id === activeId);
    const next = ordered[(index + 1) % ordered.length];
    fix(next);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-finding-id="${CSS.escape(next.id)}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  }

  return (
    <div className="check-panel">
      <section className="check-summary" aria-label="CV strength">
        <div className="check-summary-head">
          <strong>CV strength</strong>
          <span className="check-percent">{strength.percent}%</span>
          <button
            type="button"
            className="icon-button info-toggle"
            aria-expanded={showInfo}
            aria-controls="check-info"
            aria-label="About CV strength"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info size={16} aria-hidden />
          </button>
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
        <p className="check-lead">
          How complete your CV is, plus writing checks. Not a hiring score.
        </p>
        {showInfo && (
          <p id="check-info" className="check-info">
            Strength counts the parts of a typical CV you have filled in. The
            findings below are rules about wording and format. They do not
            predict whether a recruiter or tracking system will accept your CV,
            and a missing number is a prompt to describe a result, never to
            invent one.
          </p>
        )}
        <ul className="check-checklist">
          {strength.items.map((item) => (
            <li key={item.id} className={item.done ? "done" : "todo"}>
              {item.done ? (
                <Check size={14} aria-hidden />
              ) : (
                <Circle size={14} aria-hidden />
              )}
              {item.done ? (
                <span>
                  {item.label}
                  {item.detail && ` ${item.detail}`}
                  <span className="sr-only"> (done)</span>
                </span>
              ) : (
                <button type="button" onClick={() => onOpenStep(item.stepId)}>
                  {item.label}
                  {item.detail && ` ${item.detail}`}
                  <span className="sr-only"> (to do)</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="check-tabs" role="tablist" aria-label="Check views">
        <button
          type="button"
          role="tab"
          id="check-tab-fix"
          aria-selected={tab === "fix"}
          aria-controls="check-panel-fix"
          onClick={() => setTab("fix")}
        >
          To fix <span className="count">{open.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="check-tab-role"
          aria-selected={tab === "role"}
          aria-controls="check-panel-role"
          onClick={() => setTab("role")}
        >
          Compare with a role
        </button>
      </div>

      {tab === "fix" ? (
        <div id="check-panel-fix" role="tabpanel" aria-labelledby="check-tab-fix">
          <div className="findings-bar">
            <span>
              {open.length === 0
                ? "Nothing to fix right now."
                : `${open.length} ${open.length === 1 ? "finding" : "findings"} to review`}
            </span>
            {open.length > 0 && (
              <button type="button" className="primary" onClick={nextIssue}>
                Next issue <ArrowRight size={16} aria-hidden />
              </button>
            )}
          </div>
          {open.length === 0 && (
            <p className="findings-empty">
              <CircleCheck size={20} aria-hidden />{" "}
              {notStarted.length
                ? "Nothing to fix in what you have written so far."
                : "The current checks found nothing. Read your CV once more before you send it."}
            </p>
          )}
          {groups.map((group) => (
            <section
              key={group.stepId}
              className="finding-group"
              aria-labelledby={`finding-group-${group.stepId}`}
            >
              <h3 id={`finding-group-${group.stepId}`}>
                {group.label}
                <span className="count">{group.issues.length}</span>
              </h3>
              <ul>
                {group.issues.map((issue) => (
                  <FindingRow
                    key={issue.id}
                    issue={issue}
                    sourceText={issue.bulletId ? bulletText.get(issue.bulletId) : undefined}
                    active={issue.id === activeId}
                    dismissed={dismissed.has(issue.id)}
                    onFix={() => fix(issue)}
                    onDismiss={() => onDismiss(issue.id)}
                    onRestore={() => onRestore(issue.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {notStarted.length > 0 && (
            <section className="not-started" aria-labelledby="not-started-heading">
              <h3 id="not-started-heading">
                Not started yet <span className="count">{notStarted.length}</span>
              </h3>
              <p>Add an entry when you are ready, or hide a section you do not need.</p>
              <ul>
                {notStarted.map((issue) => {
                  const section = doc.sections.find((s) => s.id === issue.sectionId);
                  return (
                    <li key={issue.id}>
                      <span>{section?.label || "Section"}</span>
                      <button
                        type="button"
                        onClick={() => onOpenStep(issue.sectionId!)}
                        aria-label={`Open ${section?.label || "section"}`}
                      >
                        Open
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {hidden > 0 && (
            <button
              type="button"
              className="text-link"
              aria-pressed={listDismissed}
              onClick={() => setShowDismissed(!listDismissed)}
            >
              {listDismissed ? "Hide dismissed" : `Show ${hidden} dismissed`}
            </button>
          )}
        </div>
      ) : (
        <div id="check-panel-role" role="tabpanel" aria-labelledby="check-tab-role">
          <RoleComparison doc={doc} />
        </div>
      )}

      <section className="check-advanced">
        <button
          type="button"
          className="advanced-toggle"
          aria-expanded={advanced}
          aria-controls="check-advanced-body"
          onClick={() => setAdvanced(!advanced)}
        >
          <ChevronDown size={16} aria-hidden />
          Advanced: how a recruiter&apos;s system reads your file
        </button>
        {advanced && (
          <div id="check-advanced-body">
            <div className="advanced-switch" role="group" aria-label="Advanced views">
              <button
                type="button"
                aria-pressed={advancedView === "text"}
                onClick={() => setAdvancedView("text")}
              >
                Document text view
              </button>
              <button
                type="button"
                aria-pressed={advancedView === "file"}
                onClick={() => setAdvancedView("file")}
              >
                File diagnostics
              </button>
            </div>
            {advancedView === "file" ? (
              <FileDiagnostics doc={doc} />
            ) : (
              audit && (
                <div>
                  <p className="helper-text">
                    Text assembled from your CV in section order. This is not
                    text extracted from a PDF or another exported file and does
                    not simulate an enterprise ATS parser.
                  </p>
                  <p>
                    Exported-file reading order, tables, fonts, and layout:{" "}
                    <strong>Not checked</strong>.
                  </p>
                  {audit.diagnostics.map((diagnostic) => (
                    <p key={diagnostic}>{diagnostic}</p>
                  ))}
                  <pre className="plaintext-terminal">{audit.plainText}</pre>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
