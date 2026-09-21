import { useEffect, useMemo, useRef, useState } from "react";
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

function TemplateThumbnail({
  settings,
  blocks,
}: {
  settings: Presentation;
  blocks: LayoutBlock[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.15);
  const width = (pageMetrics(settings).width * 96) / 25.4;
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setScale(
        Math.min(
          0.21,
          Math.max(0.08, (entries[0].contentRect.width - 12) / width),
        ),
      ),
    );
    observer.observe(container.current!);
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
  disabled,
}: {
  doc: ResumeDocument;
  onChange: (change: Partial<Presentation>) => void;
  disabled: boolean;
}) {
  const blocks = useMemo(() => layoutBlocks(doc).slice(0, 18), [doc]);
  const p = doc.presentation;
  return (
    <section className="design-panel no-print" aria-label="Resume design">
      <div className="design-heading">
        <div>
          <p className="eyebrow">A FRAME FOR YOUR STORY</p>
          <h2>Find your style.</h2>
          <p>The same experience. A fresh perspective.</p>
        </div>
        <span>4 templates · All included</span>
      </div>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Choose a template</legend>
        <div className="template-gallery">
          {templates.map((template) => {
            const settings = { ...p, template: template.id };
            return (
              <button
                className={`template-card ${p.template === template.id ? "active" : ""}`}
                key={template.id}
                aria-pressed={p.template === template.id}
                aria-label={`${template.name} template`}
                onClick={() => onChange({ template: template.id })}
              >
                <TemplateThumbnail settings={settings} blocks={blocks} />
                <div className="template-caption">
                  <strong>{template.name}</strong>
                  <span>
                    {p.template === template.id ? "✓ Selected" : "Choose"}
                  </span>
                </div>
                <p>{template.description}</p>
              </button>
            );
          })}
        </div>
        <div className="design-controls">
          <label>
            Accent
            <select
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
          </label>
          <label>
            Typography
            <select
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
          </label>
          <label>
            Text size
            <select
              aria-label="Resume text size"
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
          </label>
          <label>
            Density
            <select
              aria-label="Resume density"
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
          </label>
          {p.template === "creative" && (
            <label className="sidebar-toggle">
              <input
                type="checkbox"
                checked={p.sidebar}
                onChange={(e) => onChange({ sidebar: e.target.checked })}
              />
              Colored side rail
            </label>
          )}
        </div>
        <p className="design-note">
          Colors are chosen for readable contrast. Density changes spacing and
          margins; your text size stays the same.
        </p>
      </fieldset>
    </section>
  );
}
