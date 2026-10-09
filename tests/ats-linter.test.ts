import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, newEntry, uid } from "../src/lib/document";
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
  assert.equal(hasQuantifiableMetric("Increased conversion rate by 24.5%"), true);
  assert.equal(hasQuantifiableMetric("Saved $450k in annual infrastructure expenses"), true);
  assert.equal(hasQuantifiableMetric("Reduced P99 query latency from 850ms to 95ms"), true);
  assert.equal(hasQuantifiableMetric("Scaled platform to handle 10M daily active users"), true);
  assert.equal(hasQuantifiableMetric("Accelerated build performance 3x"), true);
  assert.equal(hasQuantifiableMetric("Managed 40 microservices across 12 clusters"), true);
  assert.equal(hasQuantifiableMetric("Worked on internal web tool"), false);
});

test("Weak opening detector catches passive verbs accurately", () => {
  assert.equal(isWeakOpening("Responsible for maintaining codebase"), true);
  assert.equal(isWeakOpening("Worked on database migrations"), true);
  assert.equal(isWeakOpening("Assisted with client support tickets"), true);
  assert.equal(isWeakOpening("Helped team organize agile sprints"), true);
  assert.equal(isWeakOpening("Architected multi-region failover system"), false);
  assert.equal(isWeakOpening("Spearheaded redesign of checkout checkout flow"), false);
});

test("ATS Linter computes readiness score and identifies actionable issues", () => {
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

  assert.ok(report.score >= 50 && report.score <= 100);
  assert.ok(report.totalBulletsCount > 0);
  assert.ok(report.issues.length > 0);

  const weakVerbIssue = report.issues.find((i) => i.ruleId === "weak_verb");
  assert.ok(weakVerbIssue, "Should report weak verb issue");
  assert.equal(weakVerbIssue?.severity, "warning");

  const shortBulletIssue = report.issues.find((i) => i.ruleId === "bullet_length");
  assert.ok(shortBulletIssue, "Should report short bullet issue");
});

test("ATS plain-text extractor produces clean sequential stream without layout hazards", () => {
  const doc = createDocument(true);
  const plainText = extractAtsPlainText(doc);

  assert.ok(plainText.startsWith("ALEX MORGAN"));
  assert.ok(plainText.includes("alex@example.com"));
  assert.ok(plainText.includes("EXPERIENCE"));
  assert.ok(plainText.includes("EDUCATION"));
  assert.ok(plainText.includes("SKILLS"));

  const audit = auditAtsExtraction(doc);
  assert.equal(audit.readingOrderValid, true);
  assert.equal(audit.hasHazardousTables, false);
  assert.equal(audit.hasLigatures, false);
  assert.equal(audit.diagnostics.length, 0);
});
