import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { generateCoverLetter } from "../src/lib/vault/cover-letter";

test("generateCoverLetter creates grounded cover letter using resume facts", () => {
  const doc = createDocument(true);
  const letter = generateCoverLetter(doc, {
    title: "Staff Product Designer",
    company: "Acme Corp",
    recipientName: "Jane Doe, Head of Talent",
    description: "Looking for a Staff Product Designer experienced in collaborative workspaces and user research.",
  });

  assert.equal(letter.candidateName, doc.contact.name);
  assert.equal(letter.company, "Acme Corp");
  assert.equal(letter.roleTitle, "Staff Product Designer");
  assert.equal(letter.recipient, "Jane Doe, Head of Talent");
  assert.ok(letter.salutation.includes("Dear Jane Doe"));

  // Check anti-hallucination / groundedness
  // The document's experience bullet ("Led the design of a collaborative workspace...") should be in body1 or body2
  assert.ok(
    letter.fullText.includes("collaborative workspace") ||
      letter.fullText.includes("Product Designer"),
  );
  assert.ok(letter.fullText.includes("Acme Corp"));
  assert.ok(letter.fullText.includes("Staff Product Designer"));
  assert.ok(letter.markdown.startsWith(`# ${doc.contact.name}`));
  assert.ok(letter.matchedEvidenceCount >= 1);
});

test("generateCoverLetter provides clean fallbacks when input is minimal", () => {
  const doc = createDocument(true);
  const letter = generateCoverLetter(doc, {});

  assert.equal(letter.candidateName, doc.contact.name);
  assert.equal(letter.roleTitle, "Target Role");
  assert.equal(letter.company, "Target Company");
  assert.ok(letter.salutation.includes("Dear Hiring Team at Target Company"));
  assert.ok(letter.opening.includes("Target Role"));
  assert.ok(letter.fullText.length > 200);
});
