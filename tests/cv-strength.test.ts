import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { cvStrength } from "../src/lib/cv-strength";
import { lintResumeDocument } from "../src/lib/linter/ats-linter";

test("a blank CV starts at 0% and points to the name first", () => {
  const doc = createDocument();
  const strength = cvStrength(doc);
  assert.equal(strength.percent, 0);
  assert.equal(strength.next?.id, "name");
  assert.equal(strength.steps.contact, "empty");
  for (const section of doc.sections) assert.equal(strength.steps[section.id], "empty");
});

test("filled sections raise the score and mark their steps", () => {
  const doc = createDocument(true);
  const strength = cvStrength(doc, lintResumeDocument(doc).issues);
  assert.ok(strength.percent > 50, `got ${strength.percent}`);
  assert.equal(strength.steps.contact, "done");
  const experience = doc.sections.find((s) => s.type === "experience")!;
  assert.notEqual(strength.steps[experience.id], "empty");
  const total = strength.items.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(total, 100);
});

test("hidden or removed sections leave the score out of the denominator", () => {
  const doc = createDocument();
  doc.contact.name = "Sam";
  doc.contact.email = "sam@example.test";
  doc.contact.phone = "1";
  doc.contact.headline = "Nurse";
  doc.sections = [];
  assert.equal(cvStrength(doc).percent, 100);
});

test("results count when at least half of the experience bullets have a number", () => {
  const doc = createDocument(true);
  const experience = doc.sections.find((s) => s.type === "experience")!;
  for (const entry of experience.entries)
    for (const bullet of entry.bullets) bullet.text = "Led the work.";
  assert.equal(cvStrength(doc).items.find((i) => i.id === "results")!.done, false);
  for (const entry of experience.entries)
    for (const bullet of entry.bullets) bullet.text = "Cut costs by 20%.";
  assert.equal(cvStrength(doc).items.find((i) => i.id === "results")!.done, true);
});
