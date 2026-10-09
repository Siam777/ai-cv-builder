"use client";

import { useEffect, useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  CUSTOM_SECTION_PRESETS,
  createCustomSectionFromPreset,
  getSavedCustomSectionsLibrary,
  getReusableSectionsFromDocuments,
  removeCustomSectionFromLibrary,
  type CustomSectionPreset,
  type SavedCustomSection,
} from "@/lib/custom-sections";
import {
  createCustomSection,
  newEntry,
  type Entry,
  type ResumeDocument,
  type Section,
} from "@/lib/document";

export interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSection: (section: Section) => void;
  existingSections: Section[];
  allDocuments?: ResumeDocument[];
}

export function AddSectionModal({
  isOpen,
  onClose,
  onAddSection,
  existingSections,
  allDocuments = [],
}: AddSectionModalProps) {
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<"presets" | "library" | "custom">("presets");
  const [includeStarterExample, setIncludeStarterExample] = useState(true);
  const [customName, setCustomName] = useState("");
  const [libraryItems, setLibraryItems] = useState<SavedCustomSection[]>([]);
  const [reusableFromDocs, setReusableFromDocs] = useState<
    { sourceResumeName: string; section: Section }[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      setLibraryItems(getSavedCustomSectionsLibrary());
      setReusableFromDocs(getReusableSectionsFromDocuments(allDocuments));
      setCustomName("");
    }
  }, [isOpen, allDocuments]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const existingLabels = new Set(
    existingSections.map((s) => s.label.trim().toLowerCase()),
  );

  function handleSelectPreset(preset: CustomSectionPreset) {
    const sec = createCustomSectionFromPreset(preset.id, includeStarterExample);
    onAddSection(sec);
    onClose();
  }

  function handleCreateBlankCustom() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const sec = createCustomSection(trimmed, [newEntry()]);
    onAddSection(sec);
    onClose();
  }

  function handleReuseLibrarySection(item: SavedCustomSection) {
    const sec: Section = {
      id: crypto.randomUUID(),
      type: "custom",
      label: item.label,
      visible: true,
      entries: structuredClone(item.entries),
    };
    onAddSection(sec);
    onClose();
  }

  function handleReuseDocSection(secFromDoc: Section) {
    const sec: Section = {
      id: crypto.randomUUID(),
      type: "custom",
      label: secFromDoc.label,
      visible: true,
      entries: structuredClone(secFromDoc.entries),
    };
    onAddSection(sec);
    onClose();
  }

  function handleDeleteLibraryItem(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    removeCustomSectionFromLibrary(id);
    setLibraryItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-section-title"
      onClick={onClose}
    >
      <div
        className="modal-card add-section-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">CUSTOM SECTIONS &amp; PRESETS</p>
            <h2 id="add-section-title">Add Section to Resume</h2>
          </div>
          <button
            type="button"
            className="icon-button modal-close-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${activeTab === "presets" ? "active" : ""}`}
            onClick={() => setActiveTab("presets")}
          >
            Popular Presets
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === "library" ? "active" : ""}`}
            onClick={() => setActiveTab("library")}
          >
            Saved Library{" "}
            {libraryItems.length + reusableFromDocs.length > 0 && (
              <span className="badge-count">
                {libraryItems.length + reusableFromDocs.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === "custom" ? "active" : ""}`}
            onClick={() => setActiveTab("custom")}
          >
            Custom Blank Section
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "presets" && (
            <div className="presets-tab-content">
              <div className="presets-toolbar">
                <label className="checkbox starter-checkbox">
                  <input
                    type="checkbox"
                    checked={includeStarterExample}
                    onChange={(e) => setIncludeStarterExample(e.target.checked)}
                  />
                  Include realistic starter example entry
                </label>
              </div>

              <div className="preset-cards-grid">
                {CUSTOM_SECTION_PRESETS.map((preset) => {
                  const isAlreadyAdded = existingLabels.has(
                    preset.label.toLowerCase(),
                  );
                  return (
                    <div
                      key={preset.id}
                      className={`preset-card ${isAlreadyAdded ? "already-added" : ""}`}
                    >
                      <div className="preset-card-header">
                        <span className="preset-icon">{preset.icon}</span>
                        <div>
                          <h3 className="preset-title">{preset.label}</h3>
                          <p className="preset-desc">{preset.description}</p>
                        </div>
                      </div>

                      <div className="preset-example-box">
                        <strong>Example:</strong>
                        <p className="example-entry-title">
                          {preset.exampleTitle}
                        </p>
                        <p className="example-bullet">
                          • {preset.exampleBullet}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn-select-preset"
                        onClick={() => handleSelectPreset(preset)}
                      >
                        {isAlreadyAdded ? "+ Add another" : "+ Add to resume"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "library" && (
            <div className="library-tab-content">
              <p className="library-intro">
                Sections you save from any resume are kept in your reusable library
                so you can instantly include them in other tailored variants.
              </p>

              {libraryItems.length === 0 && reusableFromDocs.length === 0 ? (
                <div className="empty-library-state">
                  <span className="empty-icon">📂</span>
                  <h3>No saved sections yet</h3>
                  <p>
                    When editing any custom section, click{" "}
                    <strong>“💾 Save”</strong> in the section controls to save it
                    here for reuse across all your resumes.
                  </p>
                </div>
              ) : (
                <div className="library-items-list">
                  {libraryItems.map((item) => (
                    <div key={item.id} className="library-item-card">
                      <div className="library-item-info">
                        <div className="library-item-header">
                          <h4>{item.label}</h4>
                          <span className="library-source-badge">
                            Saved in Library · {item.entries.length} {item.entries.length === 1 ? "entry" : "entries"}
                          </span>
                        </div>
                        {item.entries[0] && (
                          <p className="library-item-snippet">
                            {item.entries[0].title || "Untitled entry"}
                            {item.entries[0].organization && ` · ${item.entries[0].organization}`}
                          </p>
                        )}
                      </div>
                      <div className="library-item-actions">
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => handleReuseLibrarySection(item)}
                        >
                          + Add to resume
                        </button>
                        <button
                          type="button"
                          className="btn-delete-sm"
                          title="Delete from library"
                          onClick={(e) => handleDeleteLibraryItem(e, item.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  {reusableFromDocs.map((docItem, idx) => (
                    <div key={`doc-${idx}`} className="library-item-card">
                      <div className="library-item-info">
                        <div className="library-item-header">
                          <h4>{docItem.section.label}</h4>
                          <span className="library-source-badge">
                            From resume: {docItem.sourceResumeName} · {docItem.section.entries.length} entries
                          </span>
                        </div>
                        {docItem.section.entries[0] && (
                          <p className="library-item-snippet">
                            {docItem.section.entries[0].title || "Untitled entry"}
                            {docItem.section.entries[0].organization && ` · ${docItem.section.entries[0].organization}`}
                          </p>
                        )}
                      </div>
                      <div className="library-item-actions">
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => handleReuseDocSection(docItem.section)}
                        >
                          + Add to resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "custom" && (
            <div className="custom-tab-content">
              <p className="custom-intro">
                Create an entirely new section with your own custom heading.
              </p>
              <div className="custom-input-group">
                <label htmlFor="custom-section-heading">
                  Section Heading
                </label>
                <input
                  id="custom-section-heading"
                  type="text"
                  className="text-input"
                  placeholder="e.g. Board Memberships, Exhibitions, Advisory Roles"
                  value={customName}
                  maxLength={100}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateBlankCustom();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!customName.trim()}
                  onClick={handleCreateBlankCustom}
                >
                  Create Section
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
