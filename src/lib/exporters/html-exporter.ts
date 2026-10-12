import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResumeDocument } from "../document";
import { layoutBlocks, type LayoutBlock } from "../layout";
import { pageMetrics } from "../presentation";
import {
  presentationClass,
  presentationStyle,
  TEMPLATE_RENDER_VERSION,
} from "../resume-presentation";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function blockHtml(block: LayoutBlock): string {
  const attrs = `data-block-id="${escapeHtml(block.id)}"${block.group ? ` data-block-group="${escapeHtml(block.group)}"` : ""}${block.sidebarRow ? ` style="--sidebar-row:${block.sidebarRow}"` : ""}`;
  if (block.kind === "photo")
    return `<div class="resume-block block-photo" ${attrs}><img src="${escapeHtml(block.text)}" alt="Applicant Profile Photo" class="resume-avatar-img"></div>`;
  const tag =
    block.kind === "name"
      ? "h1"
      : block.kind === "section"
        ? "h2"
        : block.kind === "title"
          ? "h3"
          : "p";
  const text = block.href
    ? `<a data-block-text dir="${block.href.startsWith("tel:") ? "ltr" : "auto"}" href="${escapeHtml(block.href)}">${escapeHtml(block.text)}</a>`
    : `<span data-block-text dir="auto">${block.kind === "meta" && block.date && block.text === [block.details, block.date].filter(Boolean).join(" · ") ? `<span>${escapeHtml(block.details || "")}${block.details ? " · " : ""}</span><span class="resume-date">${escapeHtml(block.date)}</span>` : escapeHtml(block.text)}</span>`;
  return `<${tag} class="resume-block block-${block.kind}${block.continued ? " continued" : ""}" ${attrs}>${text}</${tag}>`;
}

/** Static export shell. The server measures the same blocks/CSS as the editor
 * and supplies explicit pages before returning HTML or generating PDF. */
export function exportToStandaloneHtml(
  doc: ResumeDocument,
  options?: {
    showWatermark?: boolean;
    pages?: LayoutBlock[][];
  },
): string {
  const style = Object.entries(presentationStyle(doc.presentation))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  const metrics = pageMetrics(doc.presentation);
  const classes = presentationClass(doc.presentation);
  const blocks = layoutBlocks(doc);
  const pages = options?.pages ?? [blocks];
  // Trace this local asset into production; never load user-selected CSS/URLs.
  const fontFiles: Record<string, string> = {
    "SourceSans3-Upright.woff2": "woff2",
    "SourceSerif4-Regular.woff2": "woff2",
    "Lato-Regular.ttf": "ttf",
  };
  const fontCss = readFileSync(
    join(process.cwd(), "src/app/resume-fonts.css"),
    "utf8",
  ).replace(/url\("\.\/fonts\/([^"\/]+)"\)/g, (_match, file: string) => {
    if (!fontFiles[file]) throw new Error("Unapproved resume font");
    return `url("data:font/${fontFiles[file]};base64,${readFileSync(join(process.cwd(), "src/app/fonts", file)).toString("base64")}")`;
  });
  const css = readFileSync(
    join(process.cwd(), "src/app/templates.css"),
    "utf8",
  );
  const furniture = (index: number) =>
    `${options?.showWatermark ? '<div class="page-watermark" aria-hidden="true">Created with AI CV Builder</div>' : ""}<div class="page-number" aria-hidden="true">${index + 1} / ${pages.length}</div>`;
  return `<!DOCTYPE html>
<html lang="en" dir="${doc.presentation.direction}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(doc.name)}</title><style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:0;background:#edf1eb}
${fontCss}
${css}
body{${style};--preview-scale:1}
.paginated-resume{overflow:visible;max-width:none}
.page-sheet{margin:20px auto;break-after:page}
.page-sheet:last-child{break-after:auto}
@page{size:${metrics.width}mm ${metrics.height}mm;margin:0}
@media print{body{background:white}.page-sheet{margin:0;box-shadow:none;transform:none;break-after:page}.page-sheet:last-child{break-after:auto}.layout-measure{display:none!important}}
</style></head><body>
${options?.pages ? "" : `<div class="layout-measure ${classes}" aria-hidden="true" inert><div class="page-content">${blocks.map(blockHtml).join("")}</div></div>`}
<article class="paginated-resume ${classes}" dir="${doc.presentation.direction}" data-template-version="${TEMPLATE_RENDER_VERSION}" data-pagination-ready="${!!options?.pages}">${pages.map((page, i) => `<div class="page-sheet" data-page="${i + 1}"><div class="page-content">${page.map(blockHtml).join("")}</div>${furniture(i)}</div>`).join("")}</article>
</body></html>`;
}
