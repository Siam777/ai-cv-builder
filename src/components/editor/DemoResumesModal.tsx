"use client";

import { useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { DEMO_PROFILES, type DemoResumeMeta } from "@/lib/demo-resumes";
import type { ResumeDocument } from "@/lib/document";
import { ResumePreview } from "../resume-preview";
import { Camera, FileText, X } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tech", label: "Engineering" },
  { id: "design", label: "Product & UX" },
  { id: "executive", label: "Solutions Architecture" },
  { id: "business", label: "Business Analysis" },
  { id: "marketing", label: "Digital Growth" },
] as const;

interface DemoResumesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseDesign: (doc: ResumeDocument, exampleId: string) => void;
}

export function DemoResumesModal({
  isOpen,
  onClose,
  onUseDesign,
}: DemoResumesModalProps) {
  useBodyScrollLock(isOpen);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selected, setSelected] = useState<{ meta: DemoResumeMeta; doc: ResumeDocument } | null>(null);
  const dialog = useModalFocus(onClose, isOpen);

  if (!isOpen) return null;

  const filtered =
    selectedCategory === "all"
      ? DEMO_PROFILES
      : DEMO_PROFILES.filter((p) => p.category === selectedCategory);

  function handlePick(demo: DemoResumeMeta) {
    setSelected({ meta: demo, doc: demo.create() });
  }

  return (
    <div
      className="modal-backdrop modal-overlay no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Demo Resume Gallery"
      onClick={onClose}
      ref={dialog}
      tabIndex={-1}

    >
      <div
        className="modal-card demo-gallery-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", width: "95vw" }}
      >
        <div className="modal-header">
          <div>
            <span className="library-kind">Demo · fictional content</span>
            <h2 className="modal-title" style={{ margin: "4px 0" }}>
              Demo examples
            </h2>
            <p className="modal-subtitle" style={{ margin: 0, color: "#64748b" }}>
              Preview a fictional CV, then use its design with your own details. Browsing adds nothing to My CVs.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close demo gallery"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Filter categories */}
        {selected ? (
          <div className="example-preview">
            <div className="button-row">
              <button onClick={() => setSelected(null)}>Back to examples</button>
              <button className="primary" onClick={() => onUseDesign(selected.doc, selected.meta.id)}>Use this design</button>
            </div>
            <p>Read-only example. Names, employers, and achievements will not be copied to your CV.</p>
            <div className="paper-stage"><ResumePreview doc={selected.doc} /></div>
          </div>
        ) : <>
        <div className="demo-category-tabs">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === "all"
                ? DEMO_PROFILES.length
                : DEMO_PROFILES.filter((p) => p.category === cat.id).length;
            return count ? (
              <button
                key={cat.id}
                type="button"
                aria-pressed={selectedCategory === cat.id}
                className={`demo-cat-btn ${selectedCategory === cat.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label} ({count})
              </button>
            ) : null;
          })}
        </div>

        {/* Grid of demo cards */}
        <div className="demo-profiles-grid">
          {filtered.map((profile) => (
            <div
              key={profile.id}
              className="demo-profile-card"
            >
              <div className="demo-card-top">
                <div className="demo-avatar-badge">
                  {profile.hasPhoto ? (
                    <Camera size={20} aria-label="Photo design" />
                  ) : (
                    <FileText size={20} aria-label="Text-only design" />
                  )}
                </div>
                <div className="demo-meta-titles">
                  <h3 className="demo-name">{profile.name}</h3>
                  <span className="demo-role-tag">{profile.role}</span>
                </div>
              </div>

              <p className="demo-summary-preview">{profile.summaryPreview}</p>

              <div className="demo-card-footer">
                <div className="demo-recommended-tags">
                  <span className="demo-template-pill">
                    Layout: <strong>{profile.recommendedTemplate}</strong>
                  </span>
                  <span
                    className="demo-accent-dot"
                    style={{
                      background:
                        profile.recommendedAccent === "forest"
                          ? "#27614c"
                          : profile.recommendedAccent === "navy"
                            ? "#1e3a8a"
                            : profile.recommendedAccent === "plum"
                              ? "#581c87"
                              : profile.recommendedAccent === "rust"
                                ? "#9a3412"
                                : "#334155",
                    }}
                    title={`Accent: ${profile.recommendedAccent}`}
                  />
                </div>
                <button
                  type="button"
                  className="demo-load-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePick(profile);
                  }}
                >
                  Preview example
                </button>
              </div>
            </div>
          ))}
        </div>
        </>}

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
