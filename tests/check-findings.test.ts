import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  describeFinding,
  excerpt,
  groupFindings,
  isNotStarted,
  issuesToFix,
} from "../src/lib/check-findings";
import { lintBullet, lintResumeDocument } from "../src/lib/linter/ats-linter";

test("every rule has a short plain-language title", () => {
  const doc = createDocument();
  const experience = doc.sections.find((s) => s.type === "experience")!;
  experience.entries.push({
    id: "e1",
    title: "Nurse",
    organization: "",
    location: "",
    start: "2020-1",
    end: "",
    current: true,
    description: "",
    bullets: [
      { id: "b1", text: "Responsible for patient care across three busy wards." },
      { id: "b2", text: "Charted." },
    ],
  });
  const { issues } = lintResumeDocument(doc);
  const rules = new Set(issues.map((i) => i.ruleId));
  for (const rule of ["contact_missing", "weak_verb", "missing_metric", "bullet_length", "date_format", "empty_section"])
    assert.ok(rules.has(rule as never), `fixture covers ${rule}`);
  for (const issue of issues) {
    const copy = describeFinding(issue);
    assert.ok(copy.title.length > 0 && copy.title.length <= 40, copy.title);
    assert.equal(copy.tone, issue.severity === "suggestion" ? "suggestion" : "attention");
  }
  assert.equal(describeFinding(issues.find((i) => i.id === "contact-email")!).title, "Add your email address");
});

test("findings group by editor step in step order, most serious first", () => {
  const doc = createDocument();
  const experience = doc.sections.find((s) => s.type === "experience")!;
  experience.entries.push({
    id: "e1", title: "Nurse", organization: "", location: "", start: "", end: "", current: false, description: "",
    bullets: [{ id: "b1", text: "Responsible for care." }],
  });
  const groups = groupFindings(doc, lintResumeDocument(doc).issues);
  assert.equal(groups[0].stepId, "contact");
  const order = doc.sections.map((s) => s.id);
  const indexes = groups.slice(1).map((g) => order.indexOf(g.stepId));
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
  const work = groups.find((g) => g.stepId === experience.id)!;
  assert.equal(work.issues[0].severity, "warning");
});

test("excerpts cut at a word boundary", () => {
  assert.equal(excerpt("Short text"), "Short text");
  const long = "Led the design of a collaborative workspace, from early discovery through launch.";
  const cut = excerpt(long);
  assert.ok(cut.endsWith("…"));
  assert.ok(long.startsWith(cut.slice(0, -1)));
  assert.ok(cut.length <= 61);
});

test("inline hints and the full report use the same bullet checks", () => {
  const doc = createDocument(true);
  const report = lintResumeDocument(doc);
  for (const section of doc.sections)
    for (const entry of section.entries)
      for (const bullet of entry.bullets) {
        const inline = lintBullet(bullet.text, section.type, { bulletId: bullet.id }).issues.map((i) => i.id);
        const full = report.issues.filter((i) => i.bulletId === bullet.id).map((i) => i.id);
        if (section.visible) assert.deepEqual(inline, full);
      }
  assert.equal(lintBullet("   ", "experience", { bulletId: "x" }).counted, false);
  assert.equal(lintBullet("Cut wait times by 30% across clinics.", "experience", { bulletId: "x" }).issues.length, 0);
});

test("a new CV lists sections not started apart from findings to fix", () => {
  const doc = createDocument();
  doc.contact.name = "Sam Rivera";
  doc.contact.email = "sam@example.com";
  const issues = lintResumeDocument(doc).issues;
  const notStarted = issues.filter(isNotStarted);
  assert.ok(notStarted.length >= 3, "empty sections are to-dos");
  const toFix = issuesToFix(issues, new Set());
  assert.ok(toFix.every((issue) => issue.ruleId !== "empty_section"));
  // A missing city is optional advice, never a warning.
  const city = issues.find((issue) => issue.id === "contact-location")!;
  assert.equal(city.severity, "suggestion");
  assert.equal(issuesToFix(issues, new Set([city.id])).length, toFix.length - 1);
});

test("one-word skills, languages and details are fine; achievements keep their checks", () => {
  for (const type of ["skills", "languages", "certifications", "education", "custom"] as const) {
    const result = lintBullet("Python", type, { bulletId: `b-${type}` });
    assert.deepEqual(result.issues, [], type);
    assert.equal(result.counted, false, type);
  }
  const job = lintBullet("Python", "experience", { bulletId: "b-job" });
  assert.ok(job.issues.some((issue) => issue.ruleId === "bullet_length"));
  assert.ok(job.issues.some((issue) => issue.ruleId === "missing_metric"));
  const project = lintBullet("Responsible for things", "projects", { bulletId: "b-p" });
  assert.ok(project.issues.some((issue) => issue.ruleId === "weak_verb"));
});
