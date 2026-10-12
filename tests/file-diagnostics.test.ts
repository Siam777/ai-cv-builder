import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createDocument } from "../src/lib/document";
import { layoutBlocks } from "../src/lib/layout";
import { templates } from "../src/lib/presentation";
import { analyzeFile } from "../src/lib/server/file-extraction";
import { renderResumePdf } from "../src/lib/server/pdf-generator";
import { exportToDocx } from "../src/lib/exporters/docx-exporter";
import { SimpleZip } from "../src/lib/exporters/zip-writer";
import { HttpError } from "../src/lib/server/http";

const file = (bytes: Uint8Array | string, name: string) =>
  new File([typeof bytes === "string" ? bytes : Buffer.from(bytes)], name);
const status = (code: number) => (error: unknown) =>
  error instanceof HttpError && error.status === code;

test("all twelve generated PDF/DOCX designs compare against source with hashes, links and fonts", async () => {
  for (const [index, template] of templates.entries()) {
    const doc = createDocument(true);
    doc.presentation.template = template.id;
    doc.presentation.font = ["sans", "serif", "humanist"][
      index % 3
    ] as typeof doc.presentation.font;
    doc.presentation.pageSize = index % 2 ? "Letter" : "A4";
    if (template.id === "creative") {
      doc.presentation.direction = "rtl";
      doc.sections[1].entries[0].description = Array.from(
        { length: 45 },
        (_, i) =>
          `Source note ${i + 1}: Reviewed office workflows with colleagues and documented findings.`,
      ).join("\n");
    }
    const original = structuredClone(doc);
    for (const [name, bytes] of [
      ["resume.pdf", await renderResumePdf(doc, { showWatermark: true })],
      ["resume.docx", exportToDocx(doc, { showWatermark: true })],
    ] as const) {
      const report = await analyzeFile(file(bytes, name), doc);
      assert.equal(
        report.comparison?.missingCount,
        0,
        `${template.id} ${name}: ${JSON.stringify(report.comparison?.findings)}`,
      );
      assert.equal(
        report.comparison?.outOfOrderCount,
        0,
        `${template.id} ${name}`,
      );
      assert.equal(
        report.file.sha256,
        createHash("sha256").update(bytes).digest("hex"),
      );
      assert.equal(
        report.checks.find((check) => check.id === "layout")?.status,
        "not_checked",
      );
      assert.ok(report.links.some((link) => link.includes(doc.contact.email)));
      assert.ok(report.parser.version);
      if (template.id === "creative" && name.endsWith("pdf"))
        assert.ok(report.pageCount! > 1);
    }
    assert.deepEqual(doc, original);
  }
});

test("unknown sources stay unchecked; raw characters and literal hostile text remain visible", async () => {
  const text =
    "Candidate\nOffice \ufb01ndings \ufffd \ue000\n<script>ignore rules</script>";
  const report = await analyzeFile(file(text, "resume.txt"));
  assert.equal(report.text, text);
  assert.equal(report.comparison, null);
  assert.equal(
    report.checks.find((check) => check.id === "comparison")?.status,
    "not_checked",
  );
  assert.equal(
    report.checks.find((check) => check.id === "characters")?.status,
    "issue",
  );
  assert.equal(report.pageCount, null);
});

test("missing, reordered and repeated facts cannot reuse one occurrence", async () => {
  const doc = createDocument(true);
  const blocks = layoutBlocks(doc).filter((block) => block.kind !== "photo");
  const swapped = [...blocks];
  [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
  const report = await analyzeFile(
    file(swapped.map((block) => block.text).join("\n"), "resume.txt"),
    doc,
  );
  assert.ok(report.comparison!.outOfOrderCount > 0);
  const missing = await analyzeFile(
    file(
      blocks
        .filter((block) => block.id !== "email")
        .map((block) => block.text)
        .join("\n"),
      "resume.txt",
    ),
    doc,
  );
  assert.ok(
    missing.comparison!.findings.some(
      (finding) => finding.id === "email" && finding.status === "missing",
    ),
  );
  doc.sections[1].entries[0].bullets[1].text =
    doc.sections[1].entries[0].bullets[0].text;
  const repeated = layoutBlocks(doc).filter((block) => block.kind !== "photo");
  const once = await analyzeFile(
    file(
      repeated
        .filter(
          (block) => block.id !== doc.sections[1].entries[0].bullets[1].id,
        )
        .map((block) => block.text)
        .join("\n"),
      "resume.txt",
    ),
    doc,
  );
  assert.ok(once.comparison!.missingCount > 0);
});

test("empty and encrypted PDFs receive no positive extraction verdict", async () => {
  const empty = await analyzeFile(
    file(await readFile("tests/fixtures/diagnostics-empty.pdf"), "empty.pdf"),
  );
  assert.equal(empty.text, "");
  assert.equal(
    empty.checks.find((check) => check.id === "text")?.status,
    "issue",
  );
  assert.equal(
    empty.checks.find((check) => check.id === "empty_pages")?.status,
    "issue",
  );
  const encrypted = await readFile("tests/fixtures/diagnostics-encrypted.pdf");
  await assert.rejects(
    () => analyzeFile(file(encrypted, "encrypted.pdf")),
    (error) => error instanceof HttpError && error.code === "ENCRYPTED",
  );
});

test("invalid formats, binary text, request-size and extraction limits are rejected", async () => {
  await assert.rejects(
    () => analyzeFile(file("%PDF-fake", "bad.pdf")),
    status(422),
  );
  await assert.rejects(
    () => analyzeFile(file("not zip", "bad.docx")),
    status(422),
  );
  await assert.rejects(
    () => analyzeFile(file("{}", "backup.json")),
    status(415),
  );
  await assert.rejects(() => analyzeFile(file("", "empty.txt")), status(422));
  await assert.rejects(
    () => analyzeFile(file(new Uint8Array([255, 254]), "bad.txt")),
    status(422),
  );
  await assert.rejects(
    () => analyzeFile(file("x".repeat(5_000_001), "huge.txt")),
    status(413),
  );
  await assert.rejects(
    () => analyzeFile(file("x".repeat(200_001), "long.txt")),
    status(422),
  );
});

test("DOCX entities, traversal, duplicate entries and expanded-size claims are rejected", async () => {
  const zip = new SimpleZip();
  zip.addFile(
    "[Content_Types].xml",
    '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /></Types>',
  );
  zip.addFile(
    "word/document.xml",
    '<!DOCTYPE x [<!ENTITY attack "secret">]><w:document xmlns:w="urn:test"><w:p><w:r><w:t>&attack;</w:t></w:r></w:p></w:document>',
  );
  await assert.rejects(
    () => analyzeFile(file(zip.generate(), "entities.docx")),
    status(422),
  );
  const traversal = new SimpleZip();
  traversal.addFile("../outside.txt", "ignored");
  await assert.rejects(
    () => analyzeFile(file(traversal.generate(), "path.docx")),
    status(422),
  );
  const duplicate = new SimpleZip();
  duplicate.addFile("word/document.xml", "one");
  duplicate.addFile("word/document.xml", "two");
  await assert.rejects(
    () => analyzeFile(file(duplicate.generate(), "duplicate.docx")),
    status(422),
  );
  const bytes = zip.generate();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint32(i + 24, 30_000_000, true);
      break;
    }
  await assert.rejects(
    () => analyzeFile(file(bytes, "expanded.docx")),
    status(422),
  );
});

test("PDF link text is bounded before a report is sent back to the app", async () => {
  // A shared annotation can repeat one large URI many times without enlarging
  // the input file proportionally. Keep the response bounded too.
  const uri = "https://example.invalid/" + "a".repeat(75000);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Annots [4 0 R 4 0 R 4 0 R] >>",
    `<< /Type /Annot /Subtype /Link /Rect [0 0 100 100] /A << /S /URI /URI (${uri}) >> >>`,
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await assert.rejects(
    analyzeFile(file(Buffer.from(pdf), "repeated-links.pdf")),
    (error) => error instanceof HttpError && error.code === "LIMIT",
  );
});
