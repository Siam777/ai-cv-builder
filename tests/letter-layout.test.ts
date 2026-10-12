import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, documentSchema } from "../src/lib/document";
import { letterDocument } from "../src/lib/letter-layout";
import { layoutBlocks } from "../src/lib/layout";
import { exportToStandaloneHtml } from "../src/lib/exporters/html-exporter";

test("letterhead preserves the saved CV and includes only contact facts and reviewed letter text", () => {
  const source = createDocument(true);
  source.presentation.template = "creative";
  source.contact.photoUrl = "data:image/png;base64,cGhvdG8=";
  const before = structuredClone(source);
  const body = "Reviewed content\nLiteral <script> text and Zoë’s details.";
  const letter = documentSchema.parse(letterDocument(source, body));
  assert.deepEqual(source, before);
  assert.deepEqual(letter.presentation, source.presentation);
  assert.equal(letter.contact.name, source.contact.name);
  const blocks = layoutBlocks(letter);
  assert.equal(
    blocks
      .filter((block) => block.kind === "paragraph")
      .map((block) => block.text)
      .join(""),
    body,
  );
  assert.ok(
    !blocks.some(
      (block) =>
        block.kind === "photo" ||
        block.text === source.sections[1].entries[0].title,
    ),
  );
  const html = exportToStandaloneHtml(letter);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("template-creative"));
});
