import type { CSSProperties } from "react";
import {
  accents,
  densities,
  fonts,
  pageMetrics,
  type Presentation,
} from "./presentation";

export const TEMPLATE_RENDER_VERSION = "2026-10-11.q3.2";

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
  return `template-${p.template}${p.template === "creative" && p.sidebar ? " with-sidebar" : ""}${p.direction === "rtl" ? " rtl" : ""}`;
}

export function pageCapacity(p: Presentation) {
  const metrics = pageMetrics(p);
  return ((metrics.height - 2 * metrics.margin - 7) * 96) / 25.4 - 2;
}
