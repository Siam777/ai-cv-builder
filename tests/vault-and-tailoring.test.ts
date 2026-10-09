import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  documentToVault,
  createEmptyVault,
  careerVaultSchema,
} from "../src/lib/vault/vault-model";
import {
  parseJobDescriptionHeuristics,
  normalizeSkill,
  matchEvidenceAndCalculateCoverage,
  generateTailoredVariant,
  TECH_SYNONYMS,
} from "../src/lib/vault/job-tailoring";
import {
  analyzeBulletForImpact,
  synthesizeVerifiedXyzBullet,
} from "../src/lib/vault/impact-coach";

test("Master Career Vault correctly ingests resume document and indexes skills", () => {
  const doc = createDocument(true);
  const vault = documentToVault(doc);

  assert.equal(vault.version, 1);
  assert.ok(vault.items.length > 0);
  assert.ok(vault.skills.length > 0);

  // Validate vault matches schema
  const parsed = careerVaultSchema.safeParse(vault);
  assert.ok(parsed.success, "CareerVault must pass careerVaultSchema");

  // Check that skills were inferred
  const skillNames = vault.skills.map((s) => s.name.toLowerCase());
  assert.ok(
    skillNames.some((s) => s.includes("design") || s.includes("prototyping") || s.includes("figma")),
    "Extracted skills should contain design tokens",
  );
});

test("Synonym dictionary normalizes technical terms accurately", () => {
  assert.equal(normalizeSkill("k8s"), "kubernetes");
  assert.equal(normalizeSkill("K8S"), "kubernetes");
  assert.equal(normalizeSkill("Postgres"), "postgresql");
  assert.equal(normalizeSkill("React.js"), "react");
  assert.equal(normalizeSkill("reactjs"), "react");
  assert.equal(normalizeSkill("TS"), "typescript");
  assert.equal(normalizeSkill("golang"), "go");
  assert.equal(normalizeSkill("Amazon Web Services"), "aws");
  assert.equal(normalizeSkill("ci/cd"), "ci/cd");
});

test("Job requirement extractor parses hard requirements, nice-to-haves, and skills", () => {
  const jobText = `
Senior Software Engineer at Stripe
San Francisco, CA

Requirements:
• 5+ years of experience with React, TypeScript, and Node.js
• Strong knowledge of PostgreSQL database indexing
• Bachelor's degree in Computer Science or equivalent

Preferred Qualifications:
• Experience with Kubernetes and Docker containers
• Bonus: Familiarity with AWS cloud architecture

Responsibilities:
• Design and build mission-critical payment workflows
• Collaborate closely with product managers and designers
`;

  const parsed = parseJobDescriptionHeuristics(jobText);

  assert.equal(parsed.jobTitle, "Senior Software Engineer");
  assert.equal(parsed.company, "Stripe");
  assert.ok(parsed.hardRequirements.length >= 2, "Should extract hard requirements");
  assert.ok(parsed.preferredQualifications.length >= 2, "Should extract preferred qualifications");
  assert.ok(parsed.keyResponsibilities.length >= 1, "Should extract responsibilities");

  const hardSkills = parsed.hardRequirements.map((r) => r.normalizedSkill).filter(Boolean);
  assert.ok(hardSkills.includes("react") || hardSkills.includes("typescript") || hardSkills.includes("postgresql"));

  const prefSkills = parsed.preferredQualifications.map((r) => r.normalizedSkill).filter(Boolean);
  assert.ok(prefSkills.includes("kubernetes") || prefSkills.includes("aws") || prefSkills.includes("docker"));
});

test("Evidence matching engine calculates coverage and separates matched evidence from gaps", () => {
  const doc = createDocument(true);
  // doc is Alex Morgan (Product designer: Figma, design systems, prototyping)
  const jobText = `
Senior Product Designer at Stripe

Requirements:
• 4+ years experience in interaction design and prototyping
• Strong proficiency in Figma and design systems
• Required: Experience with Kubernetes cluster administration

Preferred Qualifications:
• Familiarity with user research and usability testing
• Bonus: Python scripting
`;

  const parsedJob = parseJobDescriptionHeuristics(jobText);
  const matchResult = matchEvidenceAndCalculateCoverage(parsedJob, doc);

  assert.ok(matchResult.coverageScore > 0 && matchResult.coverageScore < 100);
  assert.ok(matchResult.matchedCount > 0, "Should match Figma and prototyping");
  assert.ok(matchResult.skillGaps.length > 0, "Should flag Kubernetes and Python as gaps");

  // Verify matched evidence contains actual candidate bullet or skill pointers
  const matchedReq = matchResult.matchedEvidence.find((m) =>
    m.description.toLowerCase().includes("figma") || m.description.toLowerCase().includes("prototyping"),
  );
  assert.ok(matchedReq, "Figma/prototyping requirement should be matched");

  // Verify Kubernetes is flagged as a gap, NOT hallucinated into candidate experience
  const k8sGap = matchResult.skillGaps.find((g) =>
    g.description.toLowerCase().includes("kubernetes"),
  );
  assert.ok(k8sGap, "Kubernetes must be identified as an unevidenced skill gap");
});

test("1-Click Targeted Variant Generator creates independent named resume and re-ranks bullets", () => {
  const doc = createDocument(true);
  const jobText = `
Senior Interaction Designer at Stripe
Requirements:
• Experience prototyping and refining interaction patterns
`;
  const parsedJob = parseJobDescriptionHeuristics(jobText);
  const matchResult = matchEvidenceAndCalculateCoverage(parsedJob, doc);

  const tailored = generateTailoredVariant(doc, matchResult, {
    jobTitle: "Senior Interaction Designer",
    company: "Stripe",
  });

  // Check independence
  assert.notEqual(tailored.id, doc.id);
  assert.ok(tailored.name.includes("Stripe"));
  assert.ok(tailored.name.includes("Tailored"));

  // Check that the bullet mentioning prototypes was prioritized to index 0 of its entry
  const expSection = tailored.sections.find((s) => s.type === "experience");
  assert.ok(expSection);
  const firstRole = expSection.entries[0];
  assert.ok(firstRole.bullets.length > 0);
  // In sample doc, the bullet has "Partnered with product managers to test prototypes"
  // It should be sorted to the top
  const matchedBullet = firstRole.bullets.find((b) => b.text.toLowerCase().includes("prototype"));
  if (matchedBullet) {
    assert.equal(firstRole.bullets[0].id, matchedBullet.id, "Matching bullet should be re-ranked to the top");
  }
});

test("Google XYZ Impact Coach flags passive phrasing and missing metrics", () => {
  // Passive, no metric
  const passive = analyzeBulletForImpact("Responsible for managing company website and helping team");
  assert.equal(passive.isPassive, true);
  assert.equal(passive.hasMetric, false);
  assert.ok(passive.score < 50);

  // Active verb, but no metric
  const activeNoMetric = analyzeBulletForImpact("Engineered real-time notification service using WebSockets");
  assert.equal(activeNoMetric.isPassive, false);
  assert.equal(activeNoMetric.hasActionVerb, true);
  assert.equal(activeNoMetric.hasMetric, false);
  assert.equal(activeNoMetric.missingComponent, "metric");

  // Full XYZ accomplishment bullet
  const fullXyz = analyzeBulletForImpact(
    "Reduced API response latency by 68% (from 850ms to 270ms) by optimizing PostgreSQL indexes and implementing Redis caching.",
  );
  assert.equal(fullXyz.hasMetric, true);
  assert.equal(fullXyz.hasActionVerb, true);
  assert.equal(fullXyz.isPassive, false);
  assert.ok(fullXyz.score >= 90);
});

test("Google XYZ Impact Coach synthesizes verified user metrics into high-impact bullets", () => {
  const original = "Responsible for optimizing database queries and adding caching layer";
  const verifiedMetric = "reducing P99 latency by 55%";

  const synthesized = synthesizeVerifiedXyzBullet(original, verifiedMetric);

  assert.ok(!synthesized.toLowerCase().startsWith("responsible for"));
  assert.ok(synthesized.includes("reducing P99 latency by 55%"));
  assert.ok(synthesized.endsWith("."));

  // With a noun metric
  const nounMetric = "$24k in monthly cloud infrastructure savings";
  const synthesizedNoun = synthesizeVerifiedXyzBullet("Automated redundant CI/CD testing stages", nounMetric);
  assert.ok(synthesizedNoun.includes("resulting in $24k in monthly cloud infrastructure savings"));
});
