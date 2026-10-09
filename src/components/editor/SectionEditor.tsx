"use client";

import { useEffect, useRef, useState } from "react";
import {
  labels,
  newEntry,
  type Entry,
  type ResumeDocument,
  type Section,
} from "@/lib/document";
import { saveCustomSectionToLibrary } from "@/lib/custom-sections";
import type { AccountUser } from "@/lib/cloud-contract";
import { Field } from "./Field";
import { BulletList } from "./BulletList";
import { SkillEntryEditor } from "./SkillEntryEditor";
import type { FocusTarget } from "./types";

export interface SectionEditorProps {
  doc: ResumeDocument;
  sectionId: string;
  busy: boolean;
  cloudUser: AccountUser | null;
  focusTarget?: FocusTarget | null;
  onUpdateDocument: (mutator: (draft: ResumeDocument) => void) => void;
  onDeleteSection?: (sectionId: string) => void;
  onDeleteResume: () => void;
}

export function SectionEditor({
  doc,
  sectionId,
  busy,
  cloudUser,
  focusTarget,
  onUpdateDocument,
  onDeleteSection,
  onDeleteResume,
}: SectionEditorProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [librarySaved, setLibrarySaved] = useState(false);
  const activeSection = doc.sections.find((s) => s.id === sectionId);

  // Smooth scroll and focus on target when focusTarget changes
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.bulletId) {
      const el = containerRef.current?.querySelector(
        `[data-bullet-id="${focusTarget.bulletId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
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
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-target");
        setTimeout(() => el.classList.remove("ring-target"), 1200);
      }
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

  return (
    <section
      ref={containerRef}
      className="editor-panel no-print"
      aria-label="Resume editor"
      data-section-id={sectionId}
    >
      <fieldset disabled={busy}>
        {sectionId === "contact" ? (
          <>
            <div className="panel-heading">
              <p className="eyebrow">THE INTRODUCTION</p>
              <h2>Personal details</h2>
              <p>Make it easy for your next team to find you.</p>
            </div>
            <Field
              label="Resume name"
              value={doc.name}
              maxLength={200}
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.name = v || "Untitled resume";
                })
              }
            />
            <div className="form-divider" />

            {/* Profile Photo Uploader */}
            <div className="photo-upload-section">
              <div className="photo-preview-circle">
                {doc.contact.photoUrl ? (
                  <img
                    src={doc.contact.photoUrl}
                    alt="Applicant Photo Preview"
                    className="avatar-thumbnail"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {doc.contact.name
                      ? doc.contact.name
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      : "📷"}
                  </div>
                )}
              </div>
              <div className="photo-upload-actions">
                <span className="photo-label">Profile Photo (Optional)</span>
                <p className="photo-hint">
                  Included in Creative, Modern, Timeline, and Minimalist templates.
                </p>
                <div className="photo-buttons-row">
                  <label className="photo-upload-btn">
                    <span>{doc.contact.photoUrl ? "Change Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const maxDim = 320;
                            let w = img.width;
                            let h = img.height;
                            if (w > h) {
                              if (w > maxDim) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                              }
                            } else {
                              if (h > maxDim) {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                              }
                            }
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext("2d");
                            if (ctx) {
                              ctx.drawImage(img, 0, 0, w, h);
                              const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                              onUpdateDocument((d) => {
                                d.contact.photoUrl = dataUrl;
                              });
                            }
                          };
                          img.src = event.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {doc.contact.photoUrl && (
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() =>
                        onUpdateDocument((d) => {
                          d.contact.photoUrl = "";
                        })
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="form-divider" />

            <Field
              label="Full name"
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
              value={doc.contact.website}
              placeholder="yourwebsite.com"
              onChange={(v) =>
                onUpdateDocument((d) => {
                  d.contact.website = v;
                })
              }
            />
            <div className="editor-tip">
              <span>✦</span>
              <p>
                A city and country are usually enough. Include the contact
                details you want to share.
              </p>
            </div>
            <button
              type="button"
              className="danger-link"
              onClick={onDeleteResume}
            >
              Delete this resume
            </button>
          </>
        ) : (
          activeSection && (
            <>
              <div className="panel-heading">
                <p className="eyebrow">
                  {activeSection.type === "custom"
                    ? "CUSTOM SECTION"
                    : activeSection.type === "summary"
                      ? "THE INTRODUCTION"
                      : "YOUR EXPERIENCE"}
                </p>
                <h2>{activeSection.label || labels[activeSection.type]}</h2>
                <p>
                  {activeSection.type === "summary"
                    ? "A short introduction to the work you do best."
                    : activeSection.type === "custom"
                      ? "Highlight your volunteer work, publications, speaking, awards, or unique achievements."
                      : "Add the details that tell your story."}
                </p>
              </div>
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
                        const s = d.sections.find((sec) => sec.id === sectionId);
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
                      {delta === -1 ? "↑" : "↓"}
                    </button>
                  ))}
                  {activeSection.type === "custom" && (
                    <button
                      key="save-library"
                      type="button"
                      className="section-tool-btn"
                      aria-label={librarySaved ? "Saved to library" : "Save section to library"}
                      title="Save section to reusable library"
                      onClick={() => {
                        saveCustomSectionToLibrary(activeSection);
                        setLibrarySaved(true);
                        setTimeout(() => setLibrarySaved(false), 2000);
                      }}
                    >
                      {librarySaved ? "✓ Saved" : "💾 Save"}
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
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              {!activeSection.entries.length && (
                <div className="empty-section">
                  <span>+</span>
                  <p>No entries yet. Start with one detail.</p>
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
                          {delta === -1 ? "↑" : "↓"}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="Remove entry"
                        onClick={() => removeEntry(entry.id)}
                      >
                        ×
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
                          : "High-level overview (optional — use accomplishment bullets below)..."
                      }
                      onChange={(v) => editEntry(entry.id, { description: v })}
                    />
                  )}
                  {activeSection.type !== "summary" && (
                    <BulletList
                      bullets={entry.bullets}
                      disabled={busy}
                      activeBulletId={focusTarget?.bulletId}
                      onChange={(bullets) => editEntry(entry.id, { bullets })}
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                className="add-entry"
                disabled={activeSection.entries.length >= 100}
                onClick={() =>
                  onUpdateDocument((d) => {
                    const s = d.sections.find((sec) => sec.id === sectionId);
                    if (s) s.entries.push(newEntry());
                  })
                }
              >
                + Add{" "}
                {activeSection.type === "experience"
                  ? "experience"
                  : activeSection.type === "custom"
                    ? "item"
                    : "entry"}
              </button>
            </>
          )
        )}
      </fieldset>
    </section>
  );
}
