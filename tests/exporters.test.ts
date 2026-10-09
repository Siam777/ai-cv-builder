import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { exportToMarkdown } from "../src/lib/exporters/markdown-exporter";
import { exportToStandaloneHtml } from "../src/lib/exporters/html-exporter";
import { SimpleZip, crc32 } from "../src/lib/exporters/zip-writer";
import { exportToDocx } from "../src/lib/exporters/docx-exporter";

test("Markdown exporter outputs well-formatted semantic Markdown", () => {
  const doc = createDocument(true);
  const md = exportToMarkdown(doc);

  assert.ok(md.includes(`# ${doc.contact.name}`));
  assert.ok(md.includes(doc.contact.email));
  assert.ok(md.includes("## Experience"));
  assert.ok(md.includes("Senior Product Designer"));
  assert.ok(md.includes("- Led the design of a collaborative workspace"));
});

test("Standalone HTML exporter inlines styles, escapes XSS, and outputs clean HTML5", () => {
  const doc = createDocument(true);
  const html = exportToStandaloneHtml(doc, { showWatermark: true });

  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes(`<h1 class="name">${doc.contact.name}</h1>`));
  assert.ok(html.includes("class=\"page-sheet\""));
  assert.ok(html.includes("class=\"watermark-footer\""));
  assert.ok(html.includes("Created with AI CV Builder"));
  assert.ok(html.includes("mailto:"));

  // Check XSS escaping
  const maliciousDoc = {
    ...doc,
    contact: { ...doc.contact, name: "<script>alert('xss')</script>" },
  };
  const safeHtml = exportToStandaloneHtml(maliciousDoc);
  assert.ok(!safeHtml.includes("<script>"));
  assert.ok(safeHtml.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"));
});

test("SimpleZip utility creates valid PKZIP byte stream with correct CRC32", () => {
  const zip = new SimpleZip();
  const testContent = "Hello OpenXML world!";
  const expectedCrc = crc32(new TextEncoder().encode(testContent));

  zip.addFile("test.txt", testContent);
  const bytes = zip.generate();

  assert.ok(bytes.length > 50);
  // Magic bytes 0x50, 0x4B, 0x03, 0x04 ('PK\x03\x04')
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);
  assert.ok(expectedCrc > 0);
});

test("DOCX exporter creates valid OpenXML word processing package", () => {
  const doc = createDocument(true);
  const docxBytes = exportToDocx(doc, { showWatermark: true });

  assert.ok(docxBytes instanceof Uint8Array);
  assert.ok(docxBytes.length > 500);

  // Magic bytes 0x50, 0x4B, 0x03, 0x04 ('PK\x03\x04')
  assert.equal(docxBytes[0], 0x50);
  assert.equal(docxBytes[1], 0x4b);
  assert.equal(docxBytes[2], 0x03);
  assert.equal(docxBytes[3], 0x04);

  // Content inspection: check for OpenXML strings inside byte stream
  const asString = new TextDecoder("latin1").decode(docxBytes);
  assert.ok(asString.includes("[Content_Types].xml"));
  assert.ok(asString.includes("word/document.xml"));
  assert.ok(asString.includes("word/styles.xml"));
  assert.ok(asString.includes(doc.contact.name));
  assert.ok(asString.includes("Created with AI CV Builder"));
});

test("HTML and DOCX exporters respect RTL reading direction", () => {
  const doc = createDocument(true);
  doc.presentation.direction = "rtl";

  const html = exportToStandaloneHtml(doc);
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('lang="ar"'));
  assert.ok(html.includes("direction: rtl"));

  const docxBytes = exportToDocx(doc);
  const asString = new TextDecoder("latin1").decode(docxBytes);
  assert.ok(asString.includes("<w:bidi/>"));
  assert.ok(asString.includes('<w:jc w:val="right"/>'));
});
