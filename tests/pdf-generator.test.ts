import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { renderResumePdf } from "../src/lib/server/pdf-generator";

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
