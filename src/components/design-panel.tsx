"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import { layoutBlocks, type LayoutBlock } from "@/lib/layout";
import {
  accents,
  densities,
  fonts,
  templates,
  pageMetrics,
  type Presentation,
} from "@/lib/presentation";
import {
  presentationClass,
  presentationStyle,
  ResumeBlock,
} from "./resume-preview";

export interface DesignPanelProps {
  doc: ResumeDocument;
  onChange: (change: Partial<Presentation>) => void;
  disabled?: boolean;
  onClose?: () => void;
  onOpenDemoGallery?: () => void;
}

const ACCENT_PALETTE: { id: Presentation["accent"]; name: string; hex: string }[] = [
  { id: "forest", name: "Forest", hex: "#285641" },
  { id: "navy", name: "Navy", hex: "#234b73" },
  { id: "plum", name: "Plum", hex: "#703b61" },
  { id: "rust", name: "Rust", hex: "#8a452e" },
  { id: "charcoal", name: "Charcoal", hex: "#343d42" },
  { id: "indigo", name: "Indigo", hex: "#3730a3" },
  { id: "slate", name: "Slate", hex: "#334155" },
];

const FONT_OPTIONS: { id: Presentation["font"]; name: string; label: string; family: string }[] = [
  { id: "sans", name: "Arial", label: "Clean Sans-Serif", family: "Arial, 'Segoe UI', sans-serif" },
  { id: "serif", name: "Georgia", label: "Classic Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "humanist", name: "Verdana", label: "Humanist Sans", family: "Verdana, Geneva, sans-serif" },
];

const FONT_SIZES: { value: Presentation["fontSize"]; label: string; desc: string }[] = [
  { value: 10, label: "10 pt", desc: "Compact · Fits more" },
  { value: 11, label: "11 pt", desc: "Standard · Recommended" },
  { value: 12, label: "12 pt", desc: "Spacious · Readability" },
];

const DENSITY_OPTIONS: { id: Presentation["density"]; name: string; desc: string }[] = [
  { id: "airy", name: "Airy", desc: "Generous breathing room" },
  { id: "balanced", name: "Balanced", desc: "Standard optimal spacing" },
  { id: "compact", name: "Compact", desc: "Condensed section gaps" },
  { id: "tight", name: "Tight", desc: "Maximum lines per page" },
];

function TemplateThumbnail({
  settings,
  blocks,
}: {
  settings: Presentation;
  blocks: LayoutBlock[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.18);
  const width = (pageMetrics(settings).width * 96) / 25.4;

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const w = entries[0].contentRect.width;
      if (w > 0) {
        setScale(Math.min(0.24, Math.max(0.12, (w - 12) / width)));
      }
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={container} className="template-thumbnail" aria-hidden="true">
      <div
        className={`template-miniature ${presentationClass(settings)}`}
        style={{
          ...presentationStyle(settings),
          transform: `scale(${scale})`,
          marginLeft: (-width * scale) / 2,
        }}
      >
        <div className="page-content">
          {blocks.map((block) => (
            <ResumeBlock key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DesignPanel({
  doc,
  onChange,
  disabled = false,
  onClose,
  onOpenDemoGallery,
}: DesignPanelProps) {
  useBodyScrollLock(true);
  const thumbnailBlocks = useMemo(() => layoutBlocks(doc).slice(0, 18), [doc]);
  const p = doc.presentation;
  const modalCardRef = useRef<HTMLDivElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ats" | "modern" | "executive" | "creative">("all");

  // Keyboard navigation & ESC handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const activeTemplateObj = templates.find((t) => t.id === p.template) || templates[0];

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [categoryFilter]);

  return (
    <div
      className="modal-backdrop design-modal-backdrop no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        id="design-panel"
        ref={modalCardRef}
        className="modal-card design-modal design-modal-spacious"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-modal-title"
      >
        {/* Modal Header */}
        <div className="design-modal-header">
          <div className="design-modal-header-info">
            <span className="eyebrow">CUSTOMIZE YOUR RESUME</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h2 id="design-modal-title" style={{ margin: 0 }}>Design & Templates</h2>
              {onOpenDemoGallery && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenDemoGallery();
                  }}
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1e3a8a",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                  title="Switch to another realistic demo resume profile"
                >
                  📂 Switch Demo CV ▾
                </button>
              )}
            </div>
            <p style={{ marginTop: "4px" }}>
              Choose from 8 professionally crafted, ATS-tested templates inspired by Canva, Resume.io, and Novoresume.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close design dialog"
            title="Close dialog (Esc)"
          >
            ×
          </button>
        </div>

        {/* Modal Body: Spacious Full-Width Studio (No Squished Live Preview) */}
        <div className="design-modal-body design-modal-full-width">
          <div className="design-modal-scroll-pane">
            <fieldset disabled={disabled} className="design-fieldset">
              <legend className="sr-only">Customize resume design</legend>

              {/* Section 1: Template Selection with Category Filter Tabs */}
              <section className="design-section">
                <div className="design-section-header">
                  <div>
                    <h3>Choose Template Family</h3>
                    <p className="design-section-sub">
                      All templates preserve 100% of your career data, accomplishments, and ATS readability.
                    </p>
                  </div>
                  <div className="template-category-tabs" role="tablist" aria-label="Template categories">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === "all"}
                      className={`cat-tab-btn ${categoryFilter === "all" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("all")}
                    >
                      All ({templates.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === "ats"}
                      className={`cat-tab-btn ${categoryFilter === "ats" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("ats")}
                    >
                      ATS Classic
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === "modern"}
                      className={`cat-tab-btn ${categoryFilter === "modern" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("modern")}
                    >
                      Modern & Tech
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === "executive"}
                      className={`cat-tab-btn ${categoryFilter === "executive" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("executive")}
                    >
                      Executive
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={categoryFilter === "creative"}
                      className={`cat-tab-btn ${categoryFilter === "creative" ? "active" : ""}`}
                      onClick={() => setCategoryFilter("creative")}
                    >
                      Creative & Visual
                    </button>
                  </div>
                </div>

                <div className="template-gallery template-gallery-expanded">
                  {filteredTemplates.map((template) => {
                    const isSelected = p.template === template.id;
                    const settings = { ...p, template: template.id };
                    return (
                      <button
                        type="button"
                        key={template.id}
                        className={`template-card template-card-expanded ${isSelected ? "active" : ""}`}
                        aria-pressed={isSelected}
                        aria-label={`${template.name} template`}
                        onClick={() => onChange({ template: template.id })}
                      >
                        <div className="template-card-preview">
                          <TemplateThumbnail settings={settings} blocks={thumbnailBlocks} />
                          {isSelected ? (
                            <span className="template-active-badge">✓ Active</span>
                          ) : (
                            <span className="template-ats-badge">{template.atsRating} ATS Safe</span>
                          )}
                        </div>
                        <div className="template-caption">
                          <div className="template-title-row">
                            <strong>{template.name}</strong>
                            <span className="template-action-label">
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </div>
                          <span className="template-style-pill">{template.badge}</span>
                        </div>
                        <p className="template-desc">{template.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Design Customizations Grid: Accents, Typography & Layout */}
              <div className="design-controls-columns">
                {/* Section 2: Accent Color Palette */}
                <section className="design-section">
                  <div className="design-section-header">
                    <h3>Accent Color</h3>
                    <span className="section-hint">High-contrast readable tones</span>
                  </div>
                  <div className="color-swatches-grid">
                    {ACCENT_PALETTE.map((acc) => {
                      const isSelected = p.accent === acc.id;
                      return (
                        <button
                          type="button"
                          key={acc.id}
                          className={`color-swatch-item ${isSelected ? "selected" : ""}`}
                          onClick={() => onChange({ accent: acc.id })}
                          aria-label={`Accent ${acc.name}`}
                        >
                          <span
                            className="swatch-bubble"
                            style={{ backgroundColor: acc.hex }}
                          >
                            {isSelected && <span className="swatch-check-mark">✓</span>}
                          </span>
                          <span className="swatch-label">{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Form fallback select for accessibility & automated tests */}
                  <div className="accessible-fallback-select">
                    <label htmlFor="accent-color-select">Accent color</label>
                    <select
                      id="accent-color-select"
                      aria-label="Accent color"
                      value={p.accent}
                      onChange={(e) =>
                        onChange({ accent: e.target.value as Presentation["accent"] })
                      }
                    >
                      {Object.keys(accents).map((value) => (
                        <option key={value} value={value}>
                          {value[0].toUpperCase() + value.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>

                {/* Section 3: Typography */}
                <section className="design-section">
                  <div className="design-section-header">
                    <h3>Typography</h3>
                    <span className="section-hint">Clean, system-tested font families</span>
                  </div>
                  <div className="typography-cards-grid">
                    {FONT_OPTIONS.map((f) => {
                      const isSelected = p.font === f.id;
                      return (
                        <button
                          type="button"
                          key={f.id}
                          className={`typography-card ${isSelected ? "selected" : ""}`}
                          onClick={() => onChange({ font: f.id })}
                          style={{ fontFamily: f.family }}
                        >
                          <div className="typography-card-header">
                            <strong className="font-name">{f.name}</strong>
                            {isSelected && <span className="font-check">✓</span>}
                          </div>
                          <span className="font-sublabel">{f.label}</span>
                          <p className="font-sample-preview" style={{ fontFamily: f.family }}>
                            The quick brown fox jumps over the lazy dog.
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="accessible-fallback-select">
                    <label htmlFor="resume-font-select">Resume font</label>
                    <select
                      id="resume-font-select"
                      aria-label="Resume font"
                      value={p.font}
                      onChange={(e) =>
                        onChange({ font: e.target.value as Presentation["font"] })
                      }
                    >
                      {Object.entries(fonts).map(([value, font]) => (
                        <option key={value} value={value}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              </div>

              {/* Section 4: Scale, Density, Page Size & Layout Controls */}
              <section className="design-section">
                <div className="design-section-header">
                  <h3>Layout & Spacing</h3>
                  <span className="section-hint">Control margins, density, page size, and orientation</span>
                </div>

                <div className="controls-row-multi">
                  {/* Font Size */}
                  <div className="control-group">
                    <label htmlFor="resume-text-size-select">Text size</label>
                    <div className="segmented-control">
                      {FONT_SIZES.map((sz) => (
                        <button
                          type="button"
                          key={sz.value}
                          className={`segmented-btn ${p.fontSize === sz.value ? "active" : ""}`}
                          onClick={() => onChange({ fontSize: sz.value })}
                        >
                          <strong>{sz.label}</strong>
                          <small>{sz.desc.split(" · ")[0]}</small>
                        </button>
                      ))}
                    </div>
                    <select
                      id="resume-text-size-select"
                      aria-label="Resume text size"
                      className="accessible-select"
                      value={p.fontSize}
                      onChange={(e) =>
                        onChange({
                          fontSize: Number(e.target.value) as Presentation["fontSize"],
                        })
                      }
                    >
                      {[10, 11, 12].map((value) => (
                        <option key={value} value={value}>
                          {value} pt
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Density */}
                  <div className="control-group">
                    <label htmlFor="resume-density-select">Density</label>
                    <div className="segmented-control">
                      {DENSITY_OPTIONS.map((dens) => (
                        <button
                          type="button"
                          key={dens.id}
                          className={`segmented-btn ${p.density === dens.id ? "active" : ""}`}
                          onClick={() => onChange({ density: dens.id })}
                        >
                          <strong>{dens.name}</strong>
                          <small>{dens.desc.split(" ")[0]}</small>
                        </button>
                      ))}
                    </div>
                    <select
                      id="resume-density-select"
                      aria-label="Resume density"
                      className="accessible-select"
                      value={p.density}
                      onChange={(e) =>
                        onChange({ density: e.target.value as Presentation["density"] })
                      }
                    >
                      {Object.entries(densities).map(([value, density]) => (
                        <option key={value} value={value}>
                          {density.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Page Size */}
                  <div className="control-group">
                    <label htmlFor="modal-page-size-select">Page size</label>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-btn ${p.pageSize === "A4" ? "active" : ""}`}
                        onClick={() => onChange({ pageSize: "A4" })}
                      >
                        <strong>A4</strong>
                        <small>210 × 297 mm</small>
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${p.pageSize === "Letter" ? "active" : ""}`}
                        onClick={() => onChange({ pageSize: "Letter" })}
                      >
                        <strong>Letter</strong>
                        <small>8.5 × 11 in</small>
                      </button>
                    </div>
                    <select
                      id="modal-page-size-select"
                      aria-label="Page size"
                      className="accessible-select"
                      value={p.pageSize}
                      onChange={(e) =>
                        onChange({ pageSize: e.target.value as "A4" | "Letter" })
                      }
                    >
                      <option value="A4">A4</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </div>

                  {/* Direction */}
                  <div className="control-group">
                    <label htmlFor="reading-direction-select">Reading direction</label>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-btn ${p.direction !== "rtl" ? "active" : ""}`}
                        onClick={() => onChange({ direction: "ltr" })}
                      >
                        <strong>➔ LTR</strong>
                        <small>Left to right</small>
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${p.direction === "rtl" ? "active" : ""}`}
                        onClick={() => onChange({ direction: "rtl" })}
                      >
                        <strong>⬅ RTL</strong>
                        <small>العربية / עברית</small>
                      </button>
                    </div>
                    <select
                      id="reading-direction-select"
                      aria-label="Reading direction"
                      className="accessible-select"
                      value={p.direction ?? "ltr"}
                      onChange={(e) =>
                        onChange({
                          direction: e.target.value as "ltr" | "rtl",
                        })
                      }
                    >
                      <option value="ltr">LTR (Left to right)</option>
                      <option value="rtl">RTL (Right to left · العربية / עברית)</option>
                    </select>
                  </div>
                </div>

                {/* Additional Toggles: Colored Side Rail & Profile Photo */}
                <div className="design-toggles-row" style={{ marginTop: "16px" }}>
                  {p.template === "creative" && (
                    <div className="sidebar-toggle-card">
                      <label className="toggle-switch-label">
                        <input
                          type="checkbox"
                          aria-label="Colored side rail"
                          checked={p.sidebar}
                          onChange={(e) => onChange({ sidebar: e.target.checked })}
                        />
                        <span className="toggle-switch-slider" />
                        <div className="toggle-text-block">
                          <strong>Colored side rail</strong>
                          <span>Shades the left column with an elegant background tint.</span>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="sidebar-toggle-card">
                    <label className="toggle-switch-label">
                      <input
                        type="checkbox"
                        aria-label="Show Profile Photo"
                        checked={p.showPhoto !== false}
                        onChange={(e) => onChange({ showPhoto: e.target.checked })}
                      />
                      <span className="toggle-switch-slider" />
                      <div className="toggle-text-block">
                        <strong>Show Profile Photo</strong>
                        <span>Displays candidate avatar in templates that support photos.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <div className="design-notice-card">
                <span className="notice-icon">✦</span>
                <p>
                  <strong>Live Preview Active:</strong> The main editor stage updates immediately behind this dialog.
                  All formatting changes preserve your exact accomplishments and bullet points.
                </p>
              </div>
            </fieldset>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="design-modal-footer">
          <div className="active-config-summary">
            <span className="summary-dot" style={{ backgroundColor: accents[p.accent] }} />
            <span>
              <strong>{activeTemplateObj.name}</strong> · {accents[p.accent]} accent ·{" "}
              {fonts[p.font].name} ({p.fontSize} pt) · {densities[p.density].name} density · {p.pageSize}
            </span>
          </div>
          <div className="footer-button-group">
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
            >
              Done & Return to Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
