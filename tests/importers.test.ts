import test from "node:test";
import assert from "node:assert/strict";
import { parseTextToResume } from "../src/lib/importers/text-resume-parser";
import { extractTextFromPdf } from "../src/lib/importers/pdf-text-extractor";
import { documentSchema } from "../src/lib/document";

test("text-resume-parser extracts contact info, sections, dates, and bullets from plain text", () => {
  const sampleResumeText = `
Sarah Connor
Senior DevOps & Infrastructure Engineer
sarah.connor@example.com • +1 (555) 234-5678 • Los Angeles, CA • linkedin.com/in/sarahconnor

PROFESSIONAL SUMMARY
Experienced infrastructure engineer specializing in high-reliability Kubernetes platforms and automation.

WORK EXPERIENCE
Principal Cloud Engineer - Cyberdyne Systems
2022-01 - Present | Los Angeles, CA
• Architected multi-region Kubernetes clusters handling 40,000 requests/sec.
• Reduced P99 latency by 35% through Redis caching and query optimization.
• Automated CI/CD pipelines with GitHub Actions, reducing deployment time from 45 mins to 6 mins.

DevOps Engineer - TechCorp
2019-03 - 2021-12 | Pasadena, CA
• Managed AWS infrastructure with Terraform across 12 production microservices.
• Implemented Prometheus and Grafana monitoring, achieving 99.99% system uptime.

EDUCATION
Bachelor of Science in Computer Science - UCLA
2015-09 - 2019-05 | Los Angeles, CA
• Graduated Magna Cum Laude

TECHNICAL SKILLS
Languages: Python, Go, TypeScript, Bash
Cloud & Infra: AWS, Kubernetes, Docker, Terraform, CI/CD
Databases: PostgreSQL, Redis
`;

  const { document, warnings } = parseTextToResume(sampleResumeText, "Sarah_Connor_Resume.txt");

  assert.equal(document.name, "Sarah_Connor_Resume");
  assert.equal(document.contact.name, "Sarah Connor");
  assert.equal(document.contact.headline, "Senior DevOps & Infrastructure Engineer");
  assert.equal(document.contact.email, "sarah.connor@example.com");
  assert.equal(document.contact.phone, "+1 (555) 234-5678");
  assert.ok(document.contact.website.includes("linkedin.com/in/sarahconnor"));

  // Check experience section
  const expSection = document.sections.find((s) => s.type === "experience");
  assert.ok(expSection, "Experience section must be parsed");
  assert.ok(expSection.entries.length >= 2, "Should have 2 experience entries");

  const firstRole = expSection.entries[0];
  assert.ok(firstRole.title.includes("Principal Cloud Engineer") || firstRole.title.includes("Cyberdyne"));
  assert.equal(firstRole.current, true);
  assert.equal(firstRole.start, "2022-01");
  assert.ok(firstRole.bullets.length >= 3, "First role should have at least 3 bullets");

  // Check skills section
  const skillsSection = document.sections.find((s) => s.type === "skills");
  assert.ok(skillsSection, "Skills section must be parsed");
  assert.ok(skillsSection.entries.length > 0, "Should have skills entries");

  // Verify full document matches schema without throw
  const validated = documentSchema.parse(document);
  assert.equal(validated.contact.name, "Sarah Connor");
});

test("pdf-text-extractor extracts text strings from uncompressed and stream blocks", () => {
  // Construct a minimal valid PDF stream buffer with BT ... (Hello World) Tj ... ET
  const pdfSource = `%PDF-1.4
1 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
(Antigravity CV Resume Test) Tj
ET
endstream
endobj
%%EOF`;

  const extracted = extractTextFromPdf(Buffer.from(pdfSource, "utf-8"));
  assert.ok(
    extracted.includes("Antigravity CV Resume Test"),
    "Extractor must locate and extract text in stream BT...ET blocks",
  );
});
