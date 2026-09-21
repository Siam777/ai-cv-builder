import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  applyReviewedProposal,
  bulletEvidence,
  reviewProposal,
} from "../src/lib/ai-proposals";

function fixture() {
  const doc = createDocument(true);
  const source = bulletEvidence(doc)[0];
  const proposal = {
    schemaVersion: 1,
    id: "proposal-1",
    documentId: doc.id,
    baseRevision: doc.revision,
    message: "Review this wording against the original facts.",
    questions: [],
    operations: [
      {
        type: "replaceBullet",
        sectionId: source.sectionId,
        entryId: source.entryId,
        bulletId: source.id,
        before: source.text,
        text: "Supported the design team.",
        evidenceIds: [source.id],
      },
    ],
  };
  return { doc, source, proposal };
}

test("proposal review resolves original evidence without sending contact details", () => {
  const { doc, source, proposal } = fixture();
  const review = reviewProposal(doc, proposal);
  assert.equal(review.changes[0].sources[0].text, source.text);
  assert.ok(!JSON.stringify(bulletEvidence(doc)).includes(doc.contact.email));
  assert.equal(
    doc.sections
      .flatMap((s) => s.entries)
      .flatMap((e) => e.bullets)
      .find((b) => b.id === source.id)!.text,
    source.text,
  );
});
test("proposals reject foreign documents, stale snapshots, arbitrary operations and invented evidence", () => {
  const { doc, proposal } = fixture();
  const op = proposal.operations[0];
  for (const invalid of [
    { ...proposal, documentId: "another-document" },
    { ...proposal, baseRevision: doc.revision + 1 },
    {
      ...proposal,
      operations: [{ ...op, before: "Changed while generating" }],
    },
    { ...proposal, operations: [{ ...op, type: "executeSQL" }] },
    { ...proposal, operations: [{ ...op, evidenceIds: ["invented-fact"] }] },
    { ...proposal, operations: [op, op] },
    { ...proposal, operations: [{ ...op, ownerId: "another-user" }] },
  ])
    assert.throws(() => reviewProposal(doc, invalid));
});
test("applying an explicitly reviewed proposal is atomic, preserves undo input, and rejects repeats", () => {
  const { doc, proposal } = fixture();
  const before = structuredClone(doc);
  const result = applyReviewedProposal(doc, proposal, new Set());
  assert.deepEqual(doc, before);
  assert.equal(
    bulletEvidence(result.document)[0].text,
    proposal.operations[0].text,
  );
  assert.throws(() =>
    applyReviewedProposal(doc, proposal, new Set([result.receipt])),
  );
  const invalid = {
    ...proposal,
    operations: [
      ...proposal.operations,
      { ...proposal.operations[0], bulletId: "missing" },
    ],
  };
  assert.throws(() => applyReviewedProposal(doc, invalid, new Set()));
  assert.deepEqual(doc, before);
});
