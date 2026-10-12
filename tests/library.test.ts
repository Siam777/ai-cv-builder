import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  documentSchema,
  duplicateDocument,
} from "../src/lib/document";
import {
  documentsInCollection,
  startFromDesign,
} from "../src/lib/document-library";
import { exportRequestSchema } from "../src/lib/export-contract";
import { DEMO_PROFILES } from "../src/lib/demo-resumes";

test("built-in examples are practice documents with reserved example contact domains", () => {
  assert.equal(DEMO_PROFILES.length, 12);
  for (const profile of DEMO_PROFILES) {
    const document = profile.create();
    assert.equal(documentSchema.safeParse(document).success, true, profile.id);
    assert.equal(document.provenance.purpose, "practice");
    assert.ok(document.contact.email.endsWith("@example.com"));
    assert.ok(document.contact.website.startsWith("example.com/"));
  }
});

test("legacy documents preserve every fact and enter review instead of guessing ownership", () => {
  const { provenance: _, ...legacy } = createDocument(true);
  const restored = documentSchema.parse(legacy);
  assert.deepEqual(restored.provenance, {
    purpose: "unclassified",
    origin: "legacy",
  });
  assert.deepEqual(restored.contact, legacy.contact);
  assert.deepEqual(restored.sections, legacy.sections);
  assert.equal(restored.id, legacy.id);
  assert.equal(documentsInCollection([restored], "personal").length, 0);
});

test("using a design copies presentation only and creates an independent personal draft", () => {
  const example = createDocument(true);
  const draft = startFromDesign(example, "sample-id");
  assert.notEqual(draft.id, example.id);
  assert.equal(draft.contact.name, "");
  assert.ok(draft.sections.every((s) => s.entries.length === 0));
  assert.deepEqual(draft.presentation, example.presentation);
  draft.presentation.accent = "rust";
  assert.notEqual(draft.presentation.accent, example.presentation.accent);
  assert.deepEqual(draft.provenance, {
    purpose: "personal",
    origin: "example",
    exampleId: "sample-id",
  });
});

test("practice copies and duplicates remain separate from personal documents", () => {
  const example = createDocument(true);
  const duplicate = duplicateDocument(example);
  const own = createDocument();
  assert.equal(duplicate.provenance.purpose, "practice");
  assert.deepEqual(
    documentsInCollection([example, duplicate, own], "personal"),
    [own],
  );
  assert.equal(
    documentsInCollection([example, duplicate, own], "practice").length,
    2,
  );
});

test("export contract requires local processing consent and rejects owner spoofing", () => {
  const request = {
    kind: "resume",
    format: "json",
    source: { storage: "device", document: createDocument() },
  };
  assert.equal(exportRequestSchema.safeParse(request).success, false);
  assert.equal(
    exportRequestSchema.safeParse({
      ...request,
      source: { ...request.source, processingConsent: true },
    }).success,
    true,
  );
  assert.equal(
    exportRequestSchema.safeParse({
      ...request,
      source: {
        storage: "account",
        documentId: "id",
        revision: 0,
        ownerId: "other",
      },
    }).success,
    false,
  );
});
