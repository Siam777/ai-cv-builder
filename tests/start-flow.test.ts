import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  readLinkedInFiles,
  readResumeFile,
} from "../src/lib/importers/read-resume-file";
import { templates } from "../src/lib/presentation";

const positions = `Company Name,Title,Location,Started On,Finished On,Description\n"Vercel, Inc.","Principal Engineer","Remote","Jan 2022",,"Shipped edge runtime features"`;
const skills = `Name\nTypeScript\nReact`;

test("LinkedIn import reads several export CSVs into one staged CV", async () => {
  const staged = await readLinkedInFiles([
    new File([positions], "Positions.csv", { type: "text/csv" }),
    new File([skills], "Skills.csv", { type: "text/csv" }),
  ]);
  assert.equal(staged.sourceFile, "Positions.csv, Skills.csv");
  const text = JSON.stringify(staged.document.sections);
  assert.match(text, /Principal Engineer/);
  assert.match(text, /TypeScript/);
});

test("LinkedIn import rejects files that are not LinkedIn CSVs", async () => {
  await assert.rejects(
    readLinkedInFiles([new File(["just,some\n1,2"], "notes.csv")]),
    /notes\.csv is not a LinkedIn export CSV/,
  );
  await assert.rejects(readLinkedInFiles([]), /at least one CSV/);
});

test("file upload stages JSON backups and enforces the 5 MB limit", async () => {
  const doc = createDocument();
  doc.contact.name = "Backup Person";
  const staged = await readResumeFile(
    new File([JSON.stringify(doc)], "backup.json", { type: "application/json" }),
  );
  assert.equal(staged.document.contact.name, "Backup Person");
  assert.deepEqual(staged.warnings, []);
  await assert.rejects(
    readResumeFile(new File([new Uint8Array(5_000_001)], "big.pdf")),
    /5 MB/,
  );
});

test("design picker data: photo slots, ATS designs and column counts", () => {
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]));
  for (const id of ["bold", "executive", "elegant"] as const)
    assert.equal(byId[id].photoSupported, true, id);
  // ATS-first designs stay photo-free, and the UI says so through the filter.
  for (const t of templates.filter((t) => t.category === "ats"))
    assert.equal(t.photoSupported, false, t.id);
  assert.deepEqual(
    templates.filter((t) => t.columns === 2).map((t) => t.id),
    ["creative"],
  );
  assert.equal(templates.filter((t) => t.photoSupported).length, 8);
});
