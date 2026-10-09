"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { DEMO_PROFILES, type DemoResumeMeta } from "@/lib/demo-resumes";
import type { ResumeDocument } from "@/lib/document";

interface DemoResumesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDemo: (doc: ResumeDocument) => void;
}

export function DemoResumesModal({
  isOpen,
  onClose,
  onSelectDemo,
}: DemoResumesModalProps) {
  useBodyScrollLock(isOpen);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (!isOpen) return null;

  const filtered =
    selectedCategory === "all"
      ? DEMO_PROFILES
      : DEMO_PROFILES.filter((p) => p.category === selectedCategory);

  function handlePick(demo: DemoResumeMeta) {
    const doc = demo.create();
    onSelectDemo(doc);
    onClose();
  }

  return (
    <div
      className="modal-backdrop modal-overlay no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Demo Resume Gallery"
      onClick={onClose}
    >
      <div
        className="modal-card demo-gallery-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", width: "95vw" }}
      >
        <div className="modal-header">
          <div>
            <span className="modal-kicker">REAL-WORLD DEMO PROFILES</span>
            <h2 className="modal-title" style={{ margin: "4px 0" }}>
              Explore Templates with Realistic Demo Resumes
            </h2>
            <p className="modal-subtitle" style={{ margin: 0, color: "#64748b" }}>
              Select an industry profile to test typography, photo rendering, and ATS metrics across all 8 template families.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close demo gallery"
          >
            ×
          </button>
        </div>

        {/* Filter categories */}
        <div className="demo-category-tabs">
          {[
            { id: "all", label: "All Profiles (5)" },
            { id: "tech", label: "💻 Engineering" },
            { id: "design", label: "🎨 Product & UX" },
            { id: "executive", label: "🏛️ Solutions Architecture" },
            { id: "business", label: "📊 Business Analysis" },
            { id: "marketing", label: "📈 Digital Growth" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`demo-cat-btn ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid of demo cards */}
        <div className="demo-profiles-grid">
          {filtered.map((profile) => (
            <div
              key={profile.id}
              className="demo-profile-card"
              onClick={() => handlePick(profile)}
            >
              <div className="demo-card-top">
                <div className="demo-avatar-badge">
                  {profile.hasPhoto ? "📷" : "📄"}
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
                  Load Resume <span>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
