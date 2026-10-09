import { chromium } from "playwright";
import type { ResumeDocument } from "../document";
import { exportToStandaloneHtml } from "../exporters/html-exporter";

export interface PdfRenderOptions {
  showWatermark?: boolean;
}

/**
 * Deterministic Server-Side Headless PDF Generator
 * Renders the resume to standalone HTML and captures a pixel-perfect,
 * font-embedded PDF via headless Chromium.
 */
export async function renderResumePdf(
  doc: ResumeDocument,
  options?: PdfRenderOptions,
): Promise<Uint8Array> {
  const html = exportToStandaloneHtml(doc, {
    showWatermark: options?.showWatermark ?? false,
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    // Load the standalone HTML
    await page.setContent(html, { waitUntil: "load" });
    // Wait for embedded fonts to be ready
    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      format: doc.presentation.pageSize === "Letter" ? "Letter" : "A4",
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
