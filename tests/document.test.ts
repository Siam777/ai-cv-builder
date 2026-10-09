import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  createDocument,
  duplicateDocument,
  parseBackup,
  toPlainText,
  documentSchema,
} from "../src/lib/document";
import { ConflictError, createRepository } from "../src/lib/repository";
import { presentationSchema } from "../src/lib/presentation";
import { layoutBlocks } from "../src/lib/layout";
import { newEntry } from "../src/lib/document";

test("empty optional entries do not create stranded section headings", () => {
  const doc = createDocument();
  doc.sections[1].entries.push(newEntry());
  assert.deepEqual(
    layoutBlocks(doc).map((block) => block.kind),
    ["name"],
  );
});

test("legacy settings receive safe defaults; invalid design tokens are rejected", async () => {
  const legacy = JSON.parse(JSON.stringify(createDocument(true)));
  legacy.presentation = { template: "classic", pageSize: "A4" };
  const upgraded = parseBackup(JSON.stringify(legacy));
  assert.deepEqual(upgraded.contact, legacy.contact);
  assert.deepEqual(upgraded.sections, legacy.sections);
  assert.equal(upgraded.presentation.fontSize, 10);
  assert.equal(upgraded.presentation.density, "balanced");
  const repo = createRepository(`legacy-${crypto.randomUUID()}`);
  await repo.save(upgraded, null);
  assert.deepEqual((await repo.list())[0].presentation, upgraded.presentation);
  for (const change of [
    { fontSize: 6 },
    { accent: "#ffffff" },
    { font: "url(remote)" },
    { density: "unbounded" },
    { template: "unknown" },
  ]) {
    assert.equal(
      presentationSchema.safeParse({ ...upgraded.presentation, ...change })
        .success,
      false,
    );
  }
});

test("every template keeps section order, hidden content and stable fact identifiers intact", () => {
  const doc = createDocument(true);
  doc.sections[2].visible = false;
  doc.sections.reverse();
  const before = layoutBlocks(doc);
  for (const template of [
    "classic",
    "modern",
    "compact",
    "creative",
    "tech",
    "executive",
    "timeline",
    "minimalist",
  ] as const) {
    doc.presentation.template = template;
    assert.deepEqual(layoutBlocks(doc), before);
  }
  doc.contact.website = "javascript:alert(1)";
  assert.equal(
    layoutBlocks(doc).find((block) => block.id === "website")?.href,
    undefined,
  );
});

test("backup preserves Unicode, partial dates and stable IDs; rejects malformed input", () => {
  const doc = createDocument(true);
  doc.contact.name = "নাদিয়া · Zoë";
  assert.deepEqual(parseBackup(JSON.stringify(doc)), doc);
  for (const value of [
    "{",
    "{}",
    JSON.stringify({ ...doc, schemaVersion: 2 }),
    JSON.stringify({ ...doc, credential: "unexpected" }),
  ])
    assert.throws(() => parseBackup(value));
  doc.sections[1].entries[0].start = "2025-13";
  assert.equal(documentSchema.safeParse(doc).success, false);
});
test("variants are independent and hidden sections are excluded from text", () => {
  const original = createDocument(true);
  const copy = duplicateDocument(original);
  copy.contact.name = "Changed";
  copy.sections[1].entries[0].title = "Different role";
  assert.notEqual(original.id, copy.id);
  assert.equal(original.contact.name, "Alex Morgan");
  assert.equal(
    original.sections[1].entries[0].title,
    "Senior Product Designer",
  );
  original.sections[1].visible = false;
  assert.ok(!toPlainText(original).includes("Northstar"));
  assert.ok(toPlainText(original).includes("Education".toUpperCase()));
});
test("duplicate item IDs cannot enter stored or imported documents", () => {
  const doc = createDocument(true);
  doc.sections[1].entries[0].id = doc.sections[0].id;
  assert.throws(() => parseBackup(JSON.stringify(doc)));
});
test("storage saves and reloads, rejects stale writes/deletes, and isolates variants", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const repo = createRepository(name);
  const other = createRepository(name);
  const original = await repo.save(createDocument(true), null);
  const stale = (await other.list())[0];
  const next = await repo.save(
    { ...original, name: "Updated" },
    original.revision,
  );
  assert.equal(next.revision, 1);
  await assert.rejects(
    other.save({ ...stale, name: "Stale" }, stale.revision),
    ConflictError,
  );
  await assert.rejects(other.remove(stale.id, stale.revision), ConflictError);
  const copy = await repo.save(duplicateDocument(next), null);
  await repo.save({ ...copy, name: "Independent" }, copy.revision);
  assert.equal(
    (await repo.list()).find((d) => d.id === original.id)?.name,
    "Updated",
  );
  await assert.rejects(
    repo.save(
      { ...next, schemaVersion: 2 } as unknown as typeof next,
      next.revision,
    ),
  );
  assert.equal((await repo.list()).length, 2);
  await repo.remove(original.id, next.revision);
  assert.equal((await repo.list()).length, 1);
});

test("presentation schema validates reading direction and defaults to ltr", () => {
  const doc = createDocument(true);
  assert.equal(doc.presentation.direction, "ltr");

  const rtlDoc = {
    ...doc,
    presentation: {
      ...doc.presentation,
      direction: "rtl" as const,
    },
  };
  const parsed = parseBackup(JSON.stringify(rtlDoc));
  assert.equal(parsed.presentation.direction, "rtl");

  // Invalid direction rejected
  assert.equal(
    presentationSchema.safeParse({ ...doc.presentation, direction: "vertical" }).success,
    false,
  );
});
