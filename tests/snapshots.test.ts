import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  createSnapshot,
  computeSnapshotDiff,
  restoreSnapshotAsVariant,
} from "../src/lib/snapshots";

test("createSnapshot captures immutable deep clone and metadata", () => {
  const doc = createDocument(true);
  doc.name = "My Target Resume";
  doc.revision = 5;

  const snapshot = createSnapshot(doc, "Pre-Interview Polish");
  assert.equal(snapshot.name, "Pre-Interview Polish");
  assert.equal(snapshot.documentId, doc.id);
  assert.equal(snapshot.revision, 5);
  assert.equal(snapshot.document.name, "My Target Resume");

  // Verify immutability / deep cloning
  doc.name = "Mutated In Place";
  assert.equal(snapshot.document.name, "My Target Resume");
});

test("computeSnapshotDiff identifies structural differences accurately", () => {
  const v1 = createDocument(true);
  const v2 = structuredClone(v1);

  // Modify v2: change name and remove one bullet
  v2.name = "Updated Resume Name";
  const exp = v2.sections.find((s) => s.type === "experience")!;
  exp.entries[0].bullets.pop();

  const diff = computeSnapshotDiff(v2, v1);
  assert.equal(diff.nameChanged, true);
  assert.equal(diff.bulletCountDelta, -1);
  assert.ok(diff.sectionsModified.includes("Experience"));
});

test("restoreSnapshotAsVariant generates independent named variant with new IDs", () => {
  const doc = createDocument(true);
  const snapshot = createSnapshot(doc, "Release v1");

  const restored = restoreSnapshotAsVariant(snapshot, "Restored Variant");
  assert.equal(restored.name, "Restored Variant");
  assert.notEqual(restored.id, doc.id);
  assert.equal(restored.revision, 0);
  assert.equal(restored.contact.name, doc.contact.name);
});
