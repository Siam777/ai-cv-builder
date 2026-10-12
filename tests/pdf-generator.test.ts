import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { chromium } from "playwright";
import { designSample } from "../src/lib/public-catalog";
import { layoutBlocks } from "../src/lib/layout";
import { pageCapacity } from "../src/lib/resume-presentation";
import { exportToStandaloneHtml } from "../src/lib/exporters/html-exporter";
import {
  renderResumeHtml,
  renderResumePdf,
} from "../src/lib/server/pdf-generator";

test("renderResumePdf generates valid PDF bytes starting with %PDF header", async () => {
  const doc = createDocument(true);
  const pdfBytes = await renderResumePdf(doc, { showWatermark: false });

  assert.ok(pdfBytes instanceof Uint8Array, "Result must be a Uint8Array");
  assert.ok(pdfBytes.length > 5000, "PDF must have meaningful byte length");

  // Verify %PDF- magic signature (0x25, 0x50, 0x44, 0x46)
  const header = String.fromCharCode(...pdfBytes.slice(0, 4));
  assert.equal(header, "%PDF", "PDF must start with %PDF header");
});

test("renderResumePdf supports Letter page size cleanly", async () => {
  const doc = createDocument(true);
  doc.presentation.pageSize = "Letter";

  const pdfBytes = await renderResumePdf(doc, { showWatermark: true });
  assert.ok(pdfBytes.length > 5000);
  const header = String.fromCharCode(...pdfBytes.slice(0, 4));
  assert.equal(header, "%PDF");
});

test("shared Creative sidebar rows fit one page without changing facts or text size", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const pageSize of ["A4", "Letter"] as const) {
      const doc = designSample("creative");
      doc.presentation.pageSize = pageSize;
      doc.presentation.direction = pageSize === "Letter" ? "rtl" : "ltr";
      const original = structuredClone(doc);
      await page.setContent(exportToStandaloneHtml(doc));
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page
        .locator(".layout-measure .page-content")
        .evaluate((root) => {
          const top = root.getBoundingClientRect().top;
          const bounds = Array.from(root.children, (node) =>
            node.getBoundingClientRect(),
          );
          return {
            extent: Math.max(...bounds.map((rect) => rect.bottom - top)),
            sum: bounds.reduce((total, rect) => total + rect.height, 0),
          };
        });
      const capacity = pageCapacity(doc.presentation);
      assert.ok(
        geometry.extent <= capacity,
        "Full content physically fits a page",
      );
      assert.ok(
        geometry.sum > capacity,
        "Summing shared rows would unnecessarily add a page",
      );
      await page.setContent(
        await renderResumeHtml(doc, { showWatermark: true }),
      );
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator(".page-sheet").count(), 1);
      assert.equal(
        (await page.locator("[data-block-text]").allTextContents()).join(""),
        layoutBlocks(doc)
          .map((block) => block.text)
          .join(""),
      );
      const overflow = await page.locator(".page-content").evaluate((root) => {
        const bottom = root.getBoundingClientRect().bottom;
        return Array.from(root.children).some(
          (node) => node.getBoundingClientRect().bottom > bottom + 1,
        );
      });
      assert.equal(overflow, false);
      assert.equal(
        await page
          .locator("body")
          .evaluate((node) =>
            getComputedStyle(node).getPropertyValue("--body-size"),
          ),
        `${doc.presentation.fontSize}pt`,
      );
      assert.deepEqual(doc, original);
    }
  } finally {
    await browser.close();
  }
});
