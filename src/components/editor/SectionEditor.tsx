"use client";

import { useEffect, useRef, useState } from "react";
import {
  isAchievementSection,
  labels,
  newEntry,
  uid,
  type Entry,
  type ResumeDocument,
  type Section,
  type SectionType,
} from "@/lib/document";
import { saveCustomSectionToLibrary } from "@/lib/custom-sections";
import type { AccountUser } from "@/lib/cloud-contract";
import { Field } from "./Field";
import { BulletList } from "./BulletList";
import { PhotoUploader } from "./PhotoUploader";
import { templates } from "@/lib/presentation";
import { SkillEntryEditor } from "./SkillEntryEditor";
import { FieldAi } from "./FieldAi";
import { EntryAi } from "./EntryAi";
import { ImproveAll } from "./ImproveAll";
import type { FocusTarget } from "./types";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Lightbulb, Plus, Save, Settings2, Trash2, X } from "lucide-react";

export interface SectionEditorProps {
  doc: ResumeDocument;
  sectionId: string;
  busy: boolean;
  cloudUser: AccountUser | null;
  focusTarget?: FocusTarget | null;
  onUpdateDocument: (mutator: (draft: ResumeDocument) => void) => void;
  onDeleteSection?: (sectionId: string) => void;
  onOpenPhotoDesigns?: () => void;
  /** Finding ids the person dismissed; their inline hints are hidden. */
  dismissed?: Set<string>;
  /** Every step in order, for the Back and Next buttons. */
  steps?: { id: string; label: string }[];
  onStep?: (id: string) => void;
  /** Called by Next on the last step. */
  onFinish?: () => void;
}

/** What one entry is called in the add buttons, by section type. */
const ENTRY_NOUN: Record<SectionType, string> = {
  summary: "summary",
  experience: "job",
  education: "school or course",
  skills: "skill group",
  projects: "project",
  certifications: "certificate",
  languages: "language",
  custom: "item",
};

const EMPTY_HELP: Record<SectionType, string> = {
  summary: "Two or three sentences about the work you do best.",
  experience: "Start with your most recent job, internship or volunteer role.",
  education: "Add your degree, diploma or training. Most recent first.",
  skills: "Group related skills, for example Tools or Languages.",
  projects: "Add a project you can talk about in an interview.",
  certifications: "Add a certificate or licence, with the year you earned it.",
  languages: "Add a language and how well you speak it.",
  custom: "Add the first item for this section.",
};

export function SectionEditor({
  doc,
  sectionId,
  busy,
  cloudUser,
  focusTarget,
  onUpdateDocument,
  onDeleteSection,
  onOpenPhotoDesigns,
  dismissed,
  steps = [],
  onStep,
  onFinish,
}: SectionEditorProps) {
  const stepIndex = steps.findIndex((step) => step.id === sectionId);
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : null;
  const nextStep = stepIndex >= 0 ? steps[stepIndex + 1] : null;
  const containerRef = useRef<HTMLElement>(null);
  const [librarySaved, setLibrarySaved] = useState(false);
  const activeSection = doc.sections.find((s) => s.id === sectionId);
  const activeTemplate = templates.find(
    (t) => t.id === doc.presentation.template,
  );

  // Smooth scroll and focus on target when focusTarget changes
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.bulletId) {
      const el = containerRef.current?.querySelector(
        `[data-bullet-id="${focusTarget.bulletId}"]`,
      );
      if (el) {
        el.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        });
        const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        );
        input?.focus();
        el.classList.add("ring-target");
        setTimeout(() => el.classList.remove("ring-target"), 1200);
      }
    } else if (focusTarget.entryId) {
      const el = containerRef.current?.querySelector(
        `[data-entry-id="${focusTarget.entryId}"]`,
      );
      if (el) {
        el.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        });
        el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input:not(:disabled), textarea:not(:disabled)",
        )?.focus();
        el.classList.add("ring-target");
        setTimeout(() => el.classList.remove("ring-target"), 1200);
      }
    } else if (focusTarget.field === "photo") {
      const photo =
        containerRef.current?.querySelector<HTMLElement>("#contact-photo");
      photo?.scrollIntoView({ block: "center" });
      photo
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    } else if (
      focusTarget.field &&
      ["name", "headline", "email", "phone", "location", "website"].includes(
        focusTarget.field,
      )
    ) {
      containerRef.current
        ?.querySelector<HTMLInputElement>(`#contact-${focusTarget.field}`)
        ?.focus();
    } else {
      containerRef.current?.focus();
    }
  }, [focusTarget]);

  function editEntry(entryId: string, values: Partial<Entry>) {
    onUpdateDocument((d) => {
      const s = d.sections.find((sec) => sec.id === sectionId);
      if (!s) return;
      const entry = s.entries.find((e) => e.id === entryId);
      if (entry) Object.assign(entry, values);
    });
  }

  function moveSection(delta: -1 | 1) {
    if (!activeSection) return;
    onUpdateDocument((d) => {
      const index = d.sections.findIndex((s) => s.id === sectionId);
      if (index + delta < 0 || index + delta >= d.sections.length) return;
      [d.sections[index], d.sections[index + delta]] = [
        d.sections[index + delta],
        d.sections[index],
      ];
    });
  }

  function moveEntry(index: number, delta: -1 | 1) {
    onUpdateDocument((d) => {
      const s = d.sections.find((sec) => sec.id === sectionId);
      if (!s) return;
      const entries = s.entries;
      if (index + delta < 0 || index + delta >= entries.length) return;
      [entries[index], entries[index + delta]] = [
        entries[index + delta],
        entries[index],
      ];
    });
  }

  function removeEntry(entryId: string) {
    onUpdateDocument((d) => {
      const s = d.sections.find((sec) => sec.id === sectionId);
      if (!s) return;
      s.entries = s.entries.filter((e) => e.id !== entryId);
    });
  }

  function addEntry() {
    onUpdateDocument((d) => {
      const s = d.sections.find((sec) => sec.id === sectionId);
      if (s && s.entries.length < 100) s.entries.push(newEntry());
    });
  }

  return (
    <section
      ref={containerRef}
      className="editor-panel no-print"
      aria-label="Resume editor"
      tabIndex={-1}
      data-section-id={sectionId}
    >
      <fieldset disabled={busy}>
        {sectionId === "contact" ? (
          <>
            <div className="panel-heading">
              <h2>Personal details</h2>
              <p>Make it easy for your next team to find you.</p>
            </div>

            <Field
              label="Full name"
              id="contact-name"
              value={doc.contact.name}
              placeholder="e.g. Alex Morgan"
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.contact.name = v;
                })
              }
            />
            <Field
              label="Professional headline"
              id="contact-headline"
              value={doc.contact.headline}
              placeholder="e.g. Product designer"
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.contact.headline = v;
                })
              }
            />
            <div className="field-grid">
              <Field
                label="Email"
                id="contact-email"
                value={doc.contact.email}
                placeholder="you@example.com"
                onChange={(v) =>
                  onUpdateDocument((d) => {
                    d.contact.email = v;
                  })
                }
              />
              <Field
                label="Phone"
                id="contact-phone"
                value={doc.contact.phone}
                placeholder="+1 (555) 000-0000"
                onChange={(v) =>
                  onUpdateDocument((d) => {
                    d.contact.phone = v;
                  })
                }
              />
            </div>
            <Field
              label="Location"
              id="contact-location"
              value={doc.contact.location}
              placeholder="City, Country"
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.contact.location = v;
                })
              }
            />
            <Field
              label="Website or portfolio"
              id="contact-website"
              value={doc.contact.website}
              placeholder="yourwebsite.com"
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.contact.website = v;
                })
              }
            />
            <div className="editor-tip">
              <Lightbulb size={18} aria-hidden />
              <p>
                A city and country are usually enough. Include the contact
                details you want to share.
              </p>
            </div>
            <PhotoUploader
              value={doc.contact.photoUrl || ""}
              disabled={busy}
              templateName={activeTemplate?.name ?? "this design"}
              photoSupported={Boolean(activeTemplate?.photoSupported)}
              photoHidden={doc.presentation.showPhoto === false}
              onChange={(value) =>
                onUpdateDocument((d) => {
                  d.contact.photoUrl = value;
                  d.presentation.showPhoto = Boolean(value);
                })
              }
              onSwitchDesign={onOpenPhotoDesigns}
              onKeepDesign={() =>
                onUpdateDocument((d) => {
                  d.presentation.showPhoto = false;
                })
              }
            />
          </>
        ) : (
          activeSection && (
            <>
              <div className="panel-heading">
                <h2>{activeSection.label || labels[activeSection.type]}</h2>
                <p>
                  {activeSection.type === "summary"
                    ? "A short introduction to the work you do best."
                    : activeSection.type === "custom"
                      ? "Highlight your volunteer work, publications, speaking, awards, or unique achievements."
                      : "Add the details that tell your story."}
                </p>
              </div>
              {!activeSection.visible && (
                <div className="section-hidden-note" role="status">
                  <p>This section is hidden on your CV.</p>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateDocument((d) => {
                        const s = d.sections.find((sec) => sec.id === sectionId);
                        if (s) s.visible = true;
                      })
                    }
                  >
                    Show it
                  </button>
                </div>
              )}
              {!activeSection.entries.length && (
                <div className="empty-section">
                  <p>{EMPTY_HELP[activeSection.type]}</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={addEntry}
                  >
                    <Plus size={16} aria-hidden /> Add your first {ENTRY_NOUN[activeSection.type]}
                  </button>
                </div>
              )}
              {activeSection.entries.map((entry, index) => (
                <div
                  className="entry-card"
                  key={entry.id}
                  data-entry-id={entry.id}
                >
                  <div className="entry-toolbar">
                    <strong>
                      {String(index + 1).padStart(2, "0")} /{" "}
                      {entry.title || "New entry"}
                    </strong>
                    <div className="button-row">
                      {([-1, 1] as const).map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          aria-label={
                            delta === -1 ? "Move entry up" : "Move entry down"
                          }
                          disabled={
                            index + delta < 0 ||
                            index + delta >= activeSection.entries.length
                          }
                          onClick={() => moveEntry(index, delta)}
                        >
                          {delta === -1 ? (
                            <ArrowUp size={16} aria-hidden />
                          ) : (
                            <ArrowDown size={16} aria-hidden />
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="Remove entry"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  </div>
                  {activeSection.type !== "summary" && (
                    <Field
                      label={
                        activeSection.type === "experience"
                          ? "Job title"
                          : activeSection.type === "education"
                            ? "Degree or qualification"
                            : activeSection.type === "custom"
                              ? "Title / Role / Honor"
                              : "Title"
                      }
                      placeholder={
                        activeSection.type === "skills"
                          ? "e.g. Languages & Frameworks / Cloud & DevOps"
                          : activeSection.type === "custom"
                            ? "e.g. Volunteer Lead / Keynote Speaker / Winner"
                            : undefined
                      }
                      value={entry.title}
                      onChange={(v) => editEntry(entry.id, { title: v })}
                    />
                  )}
                  {[
                    "experience",
                    "education",
                    "certifications",
                    "projects",
                    "custom",
                  ].includes(activeSection.type) && (
                    <>
                      <Field
                        label={
                          activeSection.type === "custom"
                            ? "Organization / Publisher / Event"
                            : "Organization"
                        }
                        placeholder={
                          activeSection.type === "custom"
                            ? "e.g. ACM / Tech Summit / Non-profit"
                            : undefined
                        }
                        value={entry.organization}
                        onChange={(v) =>
                          editEntry(entry.id, { organization: v })
                        }
                      />
                      <Field
                        label="Location"
                        value={entry.location}
                        onChange={(v) => editEntry(entry.id, { location: v })}
                      />
                      <div className="field-grid">
                        <Field
                          label="Start date (YYYY or YYYY-MM)"
                          value={entry.start}
                          maxLength={7}
                          placeholder="2022-03"
                          onChange={(v) => editEntry(entry.id, { start: v })}
                        />
                        <Field
                          label="End date (YYYY or YYYY-MM)"
                          value={entry.end}
                          maxLength={7}
                          placeholder="2024-06"
                          onChange={(v) => editEntry(entry.id, { end: v })}
                        />
                      </div>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={entry.current}
                          onChange={(e) =>
                            editEntry(entry.id, {
                              current: e.target.checked,
                            })
                          }
                        />
                        Currently active
                      </label>
                    </>
                  )}
                  {activeSection.type === "skills" ? (
                    <SkillEntryEditor
                      entry={entry}
                      disabled={busy}
                      onChange={(fields) => editEntry(entry.id, fields)}
                    />
                  ) : (
                    <Field
                      id={
                        activeSection.type === "summary"
                          ? `field-summary-${entry.id}`
                          : undefined
                      }
                      label={
                        activeSection.type === "summary"
                          ? "Professional summary"
                          : "Description"
                      }
                      value={entry.description}
                      multiline
                      placeholder={
                        activeSection.type === "summary"
                          ? "Write a high-impact overview of your expertise, core domains, and key achievements..."
                          : isAchievementSection(activeSection.type)
                            ? "High-level overview (optional — use accomplishment bullets below)..."
                            : "Optional details"
                      }
                      onChange={(v) => editEntry(entry.id, { description: v })}
                    />
                  )}
                  {activeSection.type === "skills" && (
                    <FieldAi
                      kind="skills"
                      label="Skills"
                      sectionId={activeSection.id}
                      entryId={entry.id}
                      text={entry.description}
                      disabled={busy}
                      onApply={(description) =>
                        editEntry(entry.id, { description })
                      }
                    />
                  )}
                  {activeSection.type === "summary" && (
                    <FieldAi
                      kind="summary"
                      label="Professional summary"
                      text={entry.description}
                      focusId={`field-summary-${entry.id}`}
                      disabled={busy}
                      onApply={(description) =>
                        editEntry(entry.id, { description })
                      }
                    />
                  )}
                  {isAchievementSection(activeSection.type) && (
                    <EntryAi
                      sectionId={activeSection.id}
                      entry={entry}
                      noun={ENTRY_NOUN[activeSection.type]}
                      disabled={busy}
                      onAdd={(texts, title, description) =>
                        onUpdateDocument((d) => {
                          const target = d.sections
                            .find((sec) => sec.id === activeSection.id)
                            ?.entries.find((item) => item.id === entry.id);
                          if (!target) return;
                          if (title && !target.title.trim()) target.title = title;
                          if (description) target.description = description;
                          // Drop an empty starter bullet so the added ones come first.
                          target.bullets = target.bullets
                            .filter((b) => b.text.trim())
                            .concat(texts.map((text) => ({ id: uid(), text })))
                            .slice(0, 100);
                        })
                      }
                    />
                  )}
                  {isAchievementSection(activeSection.type) &&
                    entry.bullets.filter((b) => b.text.trim()).length > 1 && (
                      <ImproveAll
                        target={{
                          sectionId: activeSection.id,
                          entryId: entry.id,
                          label:
                            [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(" at ") ||
                            `this ${ENTRY_NOUN[activeSection.type]}`,
                        }}
                      />
                    )}
                  {activeSection.type !== "summary" && (
                    <BulletList
                      bullets={entry.bullets}
                      sectionType={activeSection.type}
                      dismissed={dismissed}
                      disabled={busy}
                      activeBulletId={focusTarget?.bulletId}
                      onChange={(bullets) => editEntry(entry.id, { bullets })}
                    />
                  )}
                </div>
              ))}
              {activeSection.entries.length > 0 && (
                <button
                  type="button"
                  className="add-entry"
                  disabled={activeSection.entries.length >= 100}
                  onClick={addEntry}
                >
                  <Plus size={16} aria-hidden /> Add another {ENTRY_NOUN[activeSection.type]}
                </button>
              )}
              <details className="section-settings">
                <summary>
                  <Settings2 size={16} aria-hidden /> Section settings
                  <span className="section-settings-hint">
                    Heading, show or hide, order
                  </span>
                </summary>
                <div className="section-settings-body">
                  <Field
                    label="Section heading"
                    value={activeSection.label}
                    onChange={(v) =>
                      onUpdateDocument((d) => {
                        const s = d.sections.find((sec) => sec.id === sectionId);
                        if (s) s.label = v;
                      })
                    }
                  />
                  <div className="section-controls">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={activeSection.visible}
                        onChange={(e) =>
                          onUpdateDocument((d) => {
                            const s = d.sections.find(
                              (sec) => sec.id === sectionId,
                            );
                            if (s) s.visible = e.target.checked;
                          })
                        }
                      />
                      Show in resume
                    </label>
                    <div className="button-row">
                      {([-1, 1] as const).map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          aria-label={
                            delta === -1 ? "Move section up" : "Move section down"
                          }
                          disabled={
                            doc.sections.indexOf(activeSection) + delta < 0 ||
                            doc.sections.indexOf(activeSection) + delta >=
                              doc.sections.length
                          }
                          onClick={() => moveSection(delta)}
                        >
                          {delta === -1 ? (
                            <ArrowUp size={16} aria-hidden />
                          ) : (
                            <ArrowDown size={16} aria-hidden />
                          )}
                        </button>
                      ))}
                      {activeSection.type === "custom" && (
                        <button
                          key="save-library"
                          type="button"
                          className="section-tool-btn"
                          aria-label={
                            librarySaved
                              ? "Saved to library"
                              : "Save section to library"
                          }
                          title="Save section to reusable library"
                          onClick={() => {
                            saveCustomSectionToLibrary(activeSection);
                            setLibrarySaved(true);
                            setTimeout(() => setLibrarySaved(false), 2000);
                          }}
                        >
                          {librarySaved ? <Check size={16} aria-hidden /> : <Save size={16} aria-hidden />}
                          {librarySaved ? "Saved" : "Save"}
                        </button>
                      )}
                      {activeSection.type === "custom" && onDeleteSection && (
                        <button
                          key="delete-section"
                          type="button"
                          className="section-tool-btn section-delete-btn"
                          aria-label="Remove section"
                          title="Remove section"
                          onClick={() => {
                            if (
                              activeSection.entries.length === 0 ||
                              window.confirm(
                                `Remove section “${activeSection.label}”? You can undo this change.`,
                              )
                            ) {
                              onDeleteSection(activeSection.id);
                            }
                          }}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            </>
          )
        )}
      </fieldset>
      {onStep && stepIndex >= 0 && (
        <nav className="step-footer" aria-label="Steps">
          <button
            type="button"
            disabled={!previousStep}
            onClick={() => previousStep && onStep(previousStep.id)}
          >
            <ArrowLeft size={16} aria-hidden /> Back
          </button>
          {nextStep ? (
            <button
              type="button"
              className="primary"
              onClick={() => onStep(nextStep.id)}
            >
              Next: {nextStep.label} <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button type="button" className="primary" onClick={onFinish}>
              Next: Check my CV <ArrowRight size={16} aria-hidden />
            </button>
          )}
        </nav>
      )}
    </section>
  );
}
