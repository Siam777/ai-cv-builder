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

test("contact guidance names only what is still missing", () => {
  const doc = createDocument();
  const reach = () => cvStrength(doc).items.find((i) => i.id === "reach")!;
  assert.equal(reach().action, "Add an email and a phone or location");
  doc.contact.email = "sam@example.com";
  assert.equal(reach().action, "Add a phone number or your city");
  assert.equal(reach().detail, "(add phone or city)");
  doc.contact.email = "";
  doc.contact.phone = "+44 20 0000 0000";
  assert.equal(reach().action, "Add your email address");
  doc.contact.email = "sam@example.com";
  assert.equal(reach().done, true);
});
