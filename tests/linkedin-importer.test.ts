import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvRecords,
  isLinkedInCsv,
  parseLinkedInArchive,
} from "../src/lib/importers/linkedin-importer";

test("parseCsvRecords handles quoted cells, commas, and newlines accurately", () => {
  const csv = `Company Name,Title,Location,"Description"\n"Stripe, Inc.","Staff Engineer","San Francisco, CA","Led infrastructure modernization.\nSaved $50k/mo in AWS costs."\nGoogle,Senior SWE,Mountain View,Built search indexing features.`;

  const records = parseCsvRecords(csv);
  assert.equal(records.length, 2);
  assert.equal(records[0]["company name"], "Stripe, Inc.");
  assert.equal(records[0]["title"], "Staff Engineer");
  assert.ok(records[0]["description"].includes("Saved $50k/mo"));
  assert.equal(records[1]["company name"], "Google");
});

test("isLinkedInCsv correctly detects LinkedIn CSV files", () => {
  assert.ok(isLinkedInCsv("Company Name,Title,Started On,Finished On"));
  assert.ok(isLinkedInCsv("School Name,Degree Name,Start Date,End Date"));
  assert.ok(isLinkedInCsv("First Name,Last Name,Headline,Summary"));
  assert.ok(isLinkedInCsv("Name\nTypeScript\nReact"));
  assert.ok(!isLinkedInCsv("Random,Data,Table\n1,2,3"));
});

test("parseLinkedInArchive maps profile, positions, education, and skills into ResumeDocument", () => {
  const profileCsv = `First Name,Last Name,Headline,Summary,Geo Location\nJane,Doe,Staff Infrastructure Engineer,Passionate about reliable distributed systems,Seattle WA`;
  const positionsCsv = `Company Name,Title,Location,Started On,Finished On,Description\nStripe,Staff Engineer,Seattle WA,Jan 2021,,"• Architected high-throughput payment pipeline\n• Reduced P99 latency by 35%"`;
  const educationCsv = `School Name,Degree Name,Notes,Start Date,End Date\nUniversity of Washington,B.S. Computer Science,Summa Cum Laude,2014,2018`;
  const skillsCsv = `Name\nTypeScript\nGo\nKubernetes\nDistributed Systems`;

  const result = parseLinkedInArchive({
    "Profile.csv": profileCsv,
    "Positions.csv": positionsCsv,
    "Education.csv": educationCsv,
    "Skills.csv": skillsCsv,
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.recordsCount.positions, 1);
  assert.equal(result.recordsCount.education, 1);
  assert.equal(result.recordsCount.skills, 4);

  const doc = result.document;
  assert.equal(doc.contact.name, "Jane Doe");
  assert.equal(doc.contact.headline, "Staff Infrastructure Engineer");
  assert.equal(doc.contact.location, "Seattle WA");

  // Experience
  const exp = doc.sections.find((s) => s.type === "experience");
  assert.ok(exp);
  assert.equal(exp.entries.length, 1);
  assert.equal(exp.entries[0].organization, "Stripe");
  assert.equal(exp.entries[0].title, "Staff Engineer");
  assert.equal(exp.entries[0].bullets.length, 2);
  assert.ok(exp.entries[0].bullets[0].text.includes("Architected"));

  // Education
  const edu = doc.sections.find((s) => s.type === "education");
  assert.ok(edu);
  assert.equal(edu.entries.length, 1);
  assert.equal(edu.entries[0].organization, "University of Washington");
  assert.equal(edu.entries[0].title, "B.S. Computer Science");

  // Skills
  const skills = doc.sections.find((s) => s.type === "skills");
  assert.ok(skills);
  assert.ok(skills.entries[0].description.includes("Kubernetes"));
  assert.ok(skills.entries[0].description.includes("TypeScript"));
});
