"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { ResumeDocument } from "@/lib/document";
import { layoutBlocks, paginateBlocks, type LayoutBlock } from "@/lib/layout";
import {
  accents,
  densities,
  fonts,
  pageMetrics,
  type Presentation,
} from "@/lib/presentation";

export function presentationStyle(p: Presentation): CSSProperties {
  const metrics = pageMetrics(p);
  return {
    "--page-width": `${metrics.width}mm`,
    "--page-height": `${metrics.height}mm`,
    "--page-margin": `${metrics.margin}mm`,
    "--accent": accents[p.accent],
    "--resume-font": fonts[p.font].family,
    "--body-size": `${p.fontSize}pt`,
    "--leading": densities[p.density].lineHeight,
    "--section-gap": `${densities[p.density].gap}pt`,
    direction: p.direction ?? "ltr",
  } as CSSProperties;
}
export function presentationClass(p: Presentation) {
  const rtlClass = p.direction === "rtl" ? " rtl" : "";
  return `template-${p.template}${p.template === "creative" && p.sidebar ? " with-sidebar" : ""}${rtlClass}`;
}
export function ResumeBlock({
  block,
  onSelect,
}: {
  block: LayoutBlock;
  onSelect?: (block: LayoutBlock) => void;
}) {
  if (block.kind === "photo") {
    return (
      <div
        className="resume-block block-photo"
        data-block-id={block.id}
        data-block-group={block.group}
        onClick={onSelect ? () => onSelect(block) : undefined}
      >
        <img
          src={block.text}
          alt="Applicant Profile Photo"
          className="resume-avatar-img"
        />
      </div>
    );
  }

  const Tag =
    block.kind === "name"
      ? "h1"
      : block.kind === "section"
        ? "h2"
        : block.kind === "title"
          ? "h3"
          : "p";
  return (
    <Tag
      className={`resume-block block-${block.kind}${block.continued ? " continued" : ""}${onSelect ? " interactive-block" : ""}`}
      data-block-id={block.id}
      data-block-group={block.group}
      onClick={onSelect ? () => onSelect(block) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(block);
              }
            }
          : undefined
      }
    >
      {block.href ? (
        <a data-block-text href={block.href}>
          {block.text}
        </a>
      ) : (
        <span data-block-text>{block.text}</span>
      )}
    </Tag>
  );
}

export type PreviewHandle = { prepare: () => Promise<void> };
export const ResumePreview = forwardRef<
  PreviewHandle,
  {
    doc: ResumeDocument;
    onBlockClick?: (block: LayoutBlock) => void;
    showWatermark?: boolean;
  }
>(function ResumePreview({ doc, onBlockClick, showWatermark = false }, ref) {
    const blocks = useMemo(() => layoutBlocks(doc), [doc]);
    const measurement = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<{
      source: ResumeDocument;
      pages: LayoutBlock[][];
    } | null>(null);
    const [failure, setFailure] = useState("");
    const [autoScale, setAutoScale] = useState(0.65);
    const [zoomMode, setZoomMode] = useState<"auto" | number>("auto");
    const scale = zoomMode === "auto" ? autoScale : zoomMode;
    const [fontRevision, setFontRevision] = useState(0);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      setMounted(true);
    }, []);
    const metrics = pageMetrics(doc.presentation);

    function handleZoomIn() {
      setZoomMode((prev) => {
        const current = prev === "auto" ? autoScale : prev;
        return Math.min(1.75, Math.round((current + 0.15) * 100) / 100);
      });
    }

    function handleZoomOut() {
      setZoomMode((prev) => {
        const current = prev === "auto" ? autoScale : prev;
        return Math.max(0.35, Math.round((current - 0.15) * 100) / 100);
      });
    }

    function handleZoomReset() {
      setZoomMode("auto");
    }

    function handleZoom100() {
      setZoomMode(1.0);
    }

    const readiness = useMemo(() => {
      let finish!: (error?: string) => void;
      const promise = new Promise<string | undefined>((resolve) => {
        finish = resolve;
      });
      return { promise, finish };
    }, [doc, fontRevision]);
    useImperativeHandle(
      ref,
      () => ({
        prepare: async () => {
          const error = await readiness.promise;
          if (error) throw new Error(error);
        },
      }),
      [readiness],
    );
    useEffect(() => {
      const element = stage.current!;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0].contentRect.width;
        if (width > 0)
          setAutoScale(Math.min(1, width / ((metrics.width * 96) / 25.4)));
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [metrics.width]);
    useEffect(() => {
      const loaded = () => setFontRevision((n) => n + 1);
      document.fonts.addEventListener("loadingdone", loaded);
      return () => document.fonts.removeEventListener("loadingdone", loaded);
    }, []);
    useLayoutEffect(() => {
      if (!mounted) return;
      let cancelled = false;
      setFailure("");
      void document.fonts.ready.then(() => {
        if (cancelled || !measurement.current) return;
        try {
          const root = measurement.current;
          const capacity =
            ((metrics.height - 2 * metrics.margin - 7) * 96) / 25.4 - 2;
          const pages = paginateBlocks(blocks, root, capacity);
          setResult({ source: doc, pages });
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (!cancelled) readiness.finish();
            }),
          );
        } catch (e) {
          const message = (e as Error).message;
          setFailure(message);
          readiness.finish(message);
        }
      });
      return () => {
        cancelled = true;
        readiness.finish(
          "The resume changed while pages were being prepared. Try printing again.",
        );
      };
    }, [blocks, doc, metrics.height, metrics.margin, readiness, mounted]);
    const pages = result?.pages ?? [];
    const pending = result?.source !== doc;
    return (
      <div
        ref={stage}
        className="preview-pages"
        style={
          {
            ...presentationStyle(doc.presentation),
            "--preview-scale": scale,
          } as CSSProperties
        }
      >
        <div className="preview-stage-header no-print">
          <p className="pagination-status" aria-live="polite">
            {failure ||
              (pending
                ? "Preparing pages…"
                : `${pages.length} ${pages.length === 1 ? "page" : "pages"} · ${doc.presentation.pageSize}`)}
          </p>
          <div className="preview-zoom-bar" role="toolbar" aria-label="Preview zoom controls">
            <button
              type="button"
              className="zoom-btn"
              onClick={handleZoomOut}
              disabled={scale <= 0.35}
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="zoom-percentage" title="Current preview zoom">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              className="zoom-btn"
              onClick={handleZoomIn}
              disabled={scale >= 1.75}
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            {zoomMode !== "auto" && (
              <button
                type="button"
                className="zoom-btn-text"
                onClick={handleZoomReset}
                title="Fit to container width"
              >
                Fit
              </button>
            )}
            {Math.abs(scale - 1.0) > 0.05 && (
              <button
                type="button"
                className="zoom-btn-text"
                onClick={handleZoom100}
                title="Actual 100% print size"
              >
                100%
              </button>
            )}
          </div>
        </div>
        {mounted &&
          createPortal(
            <div
              className={`layout-measure ${presentationClass(doc.presentation)}`}
              style={presentationStyle(doc.presentation)}
              dir={doc.presentation.direction ?? "ltr"}
              aria-hidden="true"
              inert
            >
              <div ref={measurement} className="page-content">
                {blocks.map((block) => (
                  <ResumeBlock key={block.id} block={block} />
                ))}
              </div>
            </div>,
            document.body,
          )}
        <article
          className={`paginated-resume ${presentationClass(doc.presentation)}`}
          dir={doc.presentation.direction ?? "ltr"}
          aria-label="Resume preview"
          aria-busy={pending}
          data-pagination-ready={!pending && !failure}
        >
          {pages.map((page, i) => (
            <div
              className="page-frame"
              key={i}
              style={{ height: ((metrics.height * 96) / 25.4) * scale }}
            >
              <div className="page-sheet" data-page={i + 1} dir={doc.presentation.direction ?? "ltr"}>
                <div className="page-content">
                  {page.map((block) => (
                    <ResumeBlock
                      key={block.id}
                      block={block}
                      onSelect={onBlockClick}
                    />
                  ))}
                </div>
                {showWatermark && (
                  <div
                    className="page-watermark print-watermark-footer"
                    aria-hidden="true"
                  >
                    Created with AI CV Builder
                  </div>
                )}
                <div className="page-number" aria-hidden="true">
                  {i + 1} / {pages.length}
                </div>
              </div>
            </div>
          ))}
        </article>
        {failure && (
          <p className="alert no-print" role="alert">
            Could not prepare this layout. {failure}
          </p>
        )}
      </div>
    );
  },
);

