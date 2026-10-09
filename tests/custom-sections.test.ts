import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  createDocument,
  createCustomSection,
  documentSchema,
  newEntry,
  toPlainText,
  uid,
} from "../src/lib/document";
import {
  CUSTOM_SECTION_PRESETS,
  createCustomSectionFromPreset,
  saveCustomSectionToLibrary,
  getSavedCustomSectionsLibrary,
  removeCustomSectionFromLibrary,
  getReusableSectionsFromDocuments,
} from "../src/lib/custom-sections";
import { layoutBlocks } from "../src/lib/layout";
import { exportToMarkdown } from "../src/lib/exporters/markdown-exporter";
import { exportToStandaloneHtml } from "../src/lib/exporters/html-exporter";
import { exportToDocx } from "../src/lib/exporters/docx-exporter";
import { extractAtsPlainText } from "../src/lib/linter/ats-plain-text";
import { generateTailoredVariant, matchEvidenceAndCalculateCoverage, parseJobDescriptionHeuristics } from "../src/lib/vault/job-tailoring";
import { parseTextToResume } from "../src/lib/importers/text-resume-parser";

test("createCustomSection creates valid schema-compliant custom section", () => {
  const customSec = createCustomSection("Speaking & Conferences");
  assert.equal(customSec.type, "custom");
  assert.equal(customSec.label, "Speaking & Conferences");
  assert.equal(customSec.visible, true);
  assert.deepEqual(customSec.entries, []);

  const doc = createDocument(true);
  doc.sections.push(customSec);
  assert.equal(documentSchema.safeParse(doc).success, true);
});

test("createCustomSectionFromPreset generates rich presets and starter examples", () => {
  for (const preset of CUSTOM_SECTION_PRESETS) {
    const secWithExample = createCustomSectionFromPreset(preset.id, true);
    assert.equal(secWithExample.type, "custom");
    assert.equal(secWithExample.label, preset.label);
    assert.equal(secWithExample.entries.length, 1);
    assert.equal(secWithExample.entries[0].title, preset.exampleTitle);
    assert.equal(secWithExample.entries[0].organization, preset.exampleOrg);
    assert.ok(secWithExample.entries[0].bullets.length >= 1);

    const doc = createDocument(true);
    doc.sections.push(secWithExample);
    const parsed = documentSchema.safeParse(doc);
    assert.equal(parsed.success, true, `Preset ${preset.id} must satisfy document schema`);

    const secBlank = createCustomSectionFromPreset(preset.id, false);
    assert.equal(secBlank.entries.length, 1);
    assert.equal(secBlank.entries[0].title, "");
  }
});

test("custom sections integrate seamlessly into layoutBlocks and live preview", () => {
  const doc = createDocument(true);
  const speakingSec = createCustomSectionFromPreset("speaking", true);
  doc.sections.push(speakingSec);

  const blocks = layoutBlocks(doc);
  const speakingHeaderBlock = blocks.find(
    (b) => b.kind === "section" && b.text === "Speaking & Conferences",
  );
  assert.ok(speakingHeaderBlock, "Section header block must exist in layout");

  const titleBlock = blocks.find(
    (b) => b.kind === "title" && b.text === speakingSec.entries[0].title,
  );
  assert.ok(titleBlock, "Entry title block must exist in layout");

  const bulletBlock = blocks.find(
    (b) => b.kind === "bullet" && b.text === speakingSec.entries[0].bullets[0].text,
  );
  assert.ok(bulletBlock, "Bullet block must exist in layout");
});

test("all exporters cleanly format and output custom sections", () => {
  const doc = createDocument(true);
  const volunteerSec = createCustomSectionFromPreset("volunteer", true);
  const patentsSec = createCustomSectionFromPreset("patents", true);
  doc.sections.push(volunteerSec, patentsSec);

  // 1. Plain text export
  const text = toPlainText(doc);
  assert.ok(text.includes("VOLUNTEER EXPERIENCE"));
  assert.ok(text.includes("PATENTS & INVENTIONS"));
  assert.ok(text.includes(volunteerSec.entries[0].title));
  assert.ok(text.includes(volunteerSec.entries[0].bullets[0].text));

  // 2. Markdown export
  const md = exportToMarkdown(doc);
  assert.ok(md.includes("## Volunteer Experience"));
  assert.ok(md.includes(`### ${volunteerSec.entries[0].title} · ${volunteerSec.entries[0].organization}`));
  assert.ok(md.includes("## Patents & Inventions"));

  // 3. Standalone HTML export
  const html = exportToStandaloneHtml(doc);
  assert.ok(html.includes("Volunteer Experience</h2>"));
  assert.ok(html.includes("Patents &amp; Inventions</h2>"));
  assert.ok(html.includes(volunteerSec.entries[0].title));

  // 4. DOCX export
  const docxBytes = exportToDocx(doc);
  assert.ok(docxBytes.length > 500, "DOCX package should be generated");

  // 5. ATS plain-text stream
  const atsText = extractAtsPlainText(doc);
  assert.ok(atsText.includes("VOLUNTEER EXPERIENCE"));
  assert.ok(atsText.includes("PATENTS & INVENTIONS"));
});

test("reusable section library supports saving, retrieving, and deduplicating", () => {
  // Mock localStorage for node environment
  const mockStorage: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    },
  };

  const volunteerSec = createCustomSectionFromPreset("volunteer", true);
  const saved = saveCustomSectionToLibrary(volunteerSec);
  assert.equal(saved.label, "Volunteer Experience");
  assert.equal(saved.entries.length, 1);

  const library = getSavedCustomSectionsLibrary();
  assert.equal(library.length, 1);
  assert.equal(library[0].label, "Volunteer Experience");

  // Updating the section
  volunteerSec.entries.push({
    ...newEntry(),
    title: "Second Volunteer Role",
  });
  saveCustomSectionToLibrary(volunteerSec);
  const updatedLibrary = getSavedCustomSectionsLibrary();
  assert.equal(updatedLibrary.length, 1, "Should update existing entry by label");
  assert.equal(updatedLibrary[0].entries.length, 2);

  // Removing from library
  removeCustomSectionFromLibrary(saved.id);
  assert.equal(getSavedCustomSectionsLibrary().length, 0);

  // Cross-resume section discovery
  const docA = createDocument(true);
  const docB = createDocument(false);
  docA.sections.push(volunteerSec);
  const awardsSec = createCustomSectionFromPreset("awards", true);
  docB.sections.push(awardsSec);

  const reusable = getReusableSectionsFromDocuments([docA, docB], docA.id);
  assert.equal(reusable.length, 1);
  assert.equal(reusable[0].section.label, "Awards & Honors");
});

test("job tailoring re-ranks matching bullets in custom sections", () => {
  const doc = createDocument(true);
  const speakingSec = createCustomSection("Conference Talks", [
    {
      id: "entry-speaking",
      title: "Keynote Speaker",
      organization: "Cloud Summit",
      location: "San Francisco, CA",
      start: "2023",
      end: "",
      current: false,
      description: "Delivered keynote presentations.",
      bullets: [
        { id: "b-unrelated", text: "Organized conference breakfast and badge pickup logistics." },
        { id: "b-matched", text: "Delivered 60-minute technical talk on Kubernetes microservices and Go concurrency." },
      ],
    },
  ]);
  doc.sections.push(speakingSec);

  const job = parseJobDescriptionHeuristics(
    "Requirements:\n- 5+ years Kubernetes and container orchestration\n- Experience building Go microservices",
    "Senior Cloud Engineer",
    "Acme Corp",
  );
  const matchResult = matchEvidenceAndCalculateCoverage(job, doc);
  const tailored = generateTailoredVariant(doc, matchResult);

  const tailoredSpeaking = tailored.sections.find((s) => s.label === "Conference Talks")!;
  assert.ok(tailoredSpeaking);
  // The matched bullet about Kubernetes and Go should be ranked first!
  assert.equal(tailoredSpeaking.entries[0].bullets[0].id, "b-matched");
  assert.equal(tailoredSpeaking.entries[0].bullets[1].id, "b-unrelated");
});

test("text resume parser detects and parses custom sections from raw resumes", () => {
  const resumeText = `
ALEX MORGAN
alex@example.com | +1 555-0100 | New York, NY

SUMMARY
Experienced product leader and researcher.

WORK EXPERIENCE
Senior Designer | Northstar
2022 - Present
- Led redesign of core product workflows.

VOLUNTEER EXPERIENCE
Volunteer Engineering Lead | Code for Good
2021 - 2023
- Built accessibility tools for local community non-profits.
- Coordinated 20 engineering volunteers.

PUBLICATIONS
Scaling Distributed Cache Invalidation | IEEE Cloud Computing
2023
- Published research on cache replication latency tradeoffs.
`;

  const { document, warnings } = parseTextToResume(resumeText, "alex-resume.txt");
  const volunteer = document.sections.find((s) => s.label.toUpperCase().includes("VOLUNTEER"));
  assert.ok(volunteer, "Volunteer custom section should be identified");
  assert.equal(volunteer.type, "custom");
  assert.ok(volunteer.entries.length >= 1);
  assert.equal(volunteer.entries[0].organization, "Code for Good");
  assert.ok(volunteer.entries[0].bullets.length >= 1);

  const publications = document.sections.find((s) => s.label.toUpperCase().includes("PUBLICATIONS"));
  assert.ok(publications, "Publications custom section should be identified");
  assert.equal(publications.type, "custom");
});
