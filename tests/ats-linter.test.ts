import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, uid } from "../src/lib/document";
import {
  lintResumeDocument,
  hasQuantifiableMetric,
  isWeakOpening,
  wordCount,
} from "../src/lib/linter/ats-linter";
import {
  extractAtsPlainText,
  auditAtsExtraction,
} from "../src/lib/linter/ats-plain-text";

test("Quantifiable metric regex detects percentages, currencies, multipliers, latency, and scale", () => {
  assert.equal(
    hasQuantifiableMetric("Increased conversion rate by 24.5%"),
    true,
  );
  assert.equal(
    hasQuantifiableMetric("Saved $450k in annual infrastructure expenses"),
    true,
  );
  assert.equal(
    hasQuantifiableMetric("Reduced P99 query latency from 850ms to 95ms"),
    true,
  );
  assert.equal(
    hasQuantifiableMetric("Scaled platform to handle 10M daily active users"),
    true,
  );
  assert.equal(hasQuantifiableMetric("Accelerated build performance 3x"), true);
  assert.equal(
    hasQuantifiableMetric("Managed 40 microservices across 12 clusters"),
    true,
  );
  assert.equal(hasQuantifiableMetric("Worked on internal web tool"), false);
});

test("Weak opening detector catches passive verbs accurately", () => {
  assert.equal(isWeakOpening("Responsible for maintaining codebase"), true);
  assert.equal(isWeakOpening("Worked on database migrations"), true);
  assert.equal(isWeakOpening("Assisted with client support tickets"), true);
  assert.equal(isWeakOpening("Helped team organize agile sprints"), true);
  assert.equal(
    isWeakOpening("Architected multi-region failover system"),
    false,
  );
  assert.equal(
    isWeakOpening("Spearheaded redesign of checkout checkout flow"),
    false,
  );
});

test("Content linter reports observations with navigable findings and leaves file checks unknown", () => {
  const doc = createDocument(true);

  // Add a passive bullet and an oversized bullet
  const expSection = doc.sections.find((s) => s.type === "experience")!;
  expSection.entries[0].bullets.push({
    id: uid(),
    text: "Responsible for answering emails and participating in meetings.",
  });
  expSection.entries[0].bullets.push({
    id: uid(),
    text: "Short",
  });

  const report = lintResumeDocument(doc);

  assert.equal(report.extractionStatus, "not_checked");
  assert.ok(report.weakOpeningCount > 0);
  assert.equal("score" in report, false);
  assert.equal("strongVerbsCount" in report, false);
  assert.ok(report.totalBulletsCount > 0);
  assert.ok(report.issues.length > 0);

  const weakVerbIssue = report.issues.find((i) => i.ruleId === "weak_verb");
  assert.ok(weakVerbIssue, "Should report weak verb issue");
  assert.equal(weakVerbIssue?.severity, "warning");

  const shortBulletIssue = report.issues.find(
    (i) => i.ruleId === "bullet_length",
  );
  assert.ok(shortBulletIssue, "Should report short bullet issue");
});

test("Document serialization preserves visible content without claiming artifact layout checks", () => {
  const doc = createDocument(true);
  const plainText = extractAtsPlainText(doc);

  assert.ok(plainText.startsWith("ALEX MORGAN"));
  assert.ok(plainText.includes("alex@example.com"));
  assert.ok(plainText.includes("EXPERIENCE"));
  assert.ok(plainText.includes("EDUCATION"));
  assert.ok(plainText.includes("SKILLS"));

  const audit = auditAtsExtraction(doc);
  assert.equal(audit.serializedSectionOrderValid, true);
  assert.equal(audit.hasHazardousTables, null);
  assert.equal(audit.scope, "document_model");
  assert.equal(audit.artifactStatus, "not_checked");
  assert.equal(audit.hasLigatures, false);
  assert.equal(audit.diagnostics.length, 0);
});

test("Empty and hidden content cannot create perfect scores or counted observations", () => {
  const doc = createDocument(false);
  for (const section of doc.sections) section.visible = false;
  const report = lintResumeDocument(doc);
  assert.equal(report.totalBulletsCount, 0);
  assert.equal(report.metricsCount, 0);
  assert.equal(report.weakOpeningCount, 0);
  assert.equal(report.totalDateCount, 0);
  assert.equal(report.extractionStatus, "not_checked");
  assert.equal("score" in report, false);
});

test("Numeric matches do not establish verified impact and non-matches do not establish strong verbs", () => {
  const doc = createDocument(true);
  const section = doc.sections.find(
    (section) => section.type === "experience",
  )!;
  for (const candidate of doc.sections)
    candidate.visible = candidate === section;
  section.entries[0].bullets = [
    {
      id: uid(),
      text: "Banana internal project concepts across several teams",
    },
    {
      id: uid(),
      text: "Responsible for serving 40 customers without a measured outcome",
    },
  ];
  section.entries = [section.entries[0]];
  const report = lintResumeDocument(doc);
  assert.equal(report.totalBulletsCount, 2);
  assert.equal(report.weakOpeningCount, 1);
  assert.equal(report.metricsCount, 1);
  assert.ok(
    report.issues
      .find((issue) => issue.ruleId === "missing_metric")
      ?.suggestion?.includes("qualitative"),
  );
});

test("Repeated section headings keep serialization order and hidden sections are omitted", () => {
  const doc = createDocument(true);
  doc.sections[0].label = "EXPERIENCE";
  doc.sections[1].label = "EXPERIENCE";
  const hidden = doc.sections.find((section) => section.type === "education")!;
  hidden.label = "HIDDEN EDUCATION";
  hidden.visible = false;
  const audit = auditAtsExtraction(doc);
  assert.equal(audit.serializedSectionOrderValid, true);
  assert.equal(audit.plainText.includes("HIDDEN EDUCATION"), false);
});
