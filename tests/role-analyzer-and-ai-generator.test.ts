import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, documentSchema } from "../src/lib/document";
import {
  ROLE_BENCHMARKS,
  analyzeResumeForRole,
  detectAppliedRoleFromDocument,
} from "../src/lib/linter/role-analyzer";
import { generateAiResume } from "../src/lib/vault/ai-cv-generator";

test("ROLE_BENCHMARKS contains definitions for key market roles", () => {
  const roles = Object.keys(ROLE_BENCHMARKS);
  assert.ok(roles.includes("software-engineer"));
  assert.ok(roles.includes("software-architect"));
  assert.ok(roles.includes("programmer"));
  assert.ok(roles.includes("business-analyst"));
  assert.ok(roles.includes("data-engineer"));
  assert.ok(roles.includes("product-manager"));
  assert.ok(roles.includes("devops-engineer"));
  assert.ok(roles.includes("product-designer"));
  assert.ok(roles.includes("marketing-lead"));
  assert.ok(roles.includes("project-manager"));
});

test("detectAppliedRoleFromDocument accurately detects role across all 5 demo resumes", async () => {
  const { DEMO_PROFILES } = await import("../src/lib/demo-resumes");

  const siam = DEMO_PROFILES.find((p) => p.id === "siam-riaz")!.create();
  assert.equal(detectAppliedRoleFromDocument(siam).roleId, "software-engineer");
  assert.equal(detectAppliedRoleFromDocument(siam).source, "headline");

  const lorna = DEMO_PROFILES.find((p) => p.id === "lorna-alvarado")!.create();
  assert.equal(detectAppliedRoleFromDocument(lorna).roleId, "product-designer");
  assert.equal(detectAppliedRoleFromDocument(lorna).source, "headline");

  const richard = DEMO_PROFILES.find((p) => p.id === "richard-sanchez")!.create();
  assert.equal(detectAppliedRoleFromDocument(richard).roleId, "software-architect");
  assert.equal(detectAppliedRoleFromDocument(richard).source, "headline");

  const sarah = DEMO_PROFILES.find((p) => p.id === "sarah-jenkins")!.create();
  assert.equal(detectAppliedRoleFromDocument(sarah).roleId, "business-analyst");
  assert.equal(detectAppliedRoleFromDocument(sarah).source, "headline");

  const sharya = DEMO_PROFILES.find((p) => p.id === "sharya-singh")!.create();
  assert.equal(detectAppliedRoleFromDocument(sharya).roleId, "marketing-lead");
  assert.equal(detectAppliedRoleFromDocument(sharya).source, "headline");
});

test("analyzeResumeForRole calibrates to applied role (Sharya Singh = Marketing, Lorna = Designer)", async () => {
  const { DEMO_PROFILES } = await import("../src/lib/demo-resumes");

  const sharya = DEMO_PROFILES.find((p) => p.id === "sharya-singh")!.create();
  // Auto-detects applied role (marketing-lead) rather than falling back to software-engineer
  const sharyaAnalysis = analyzeResumeForRole(sharya);
  assert.equal(sharyaAnalysis.roleId, "marketing-lead");
  assert.ok(sharyaAnalysis.overallScore >= 80, `Expected score >= 80, got ${sharyaAnalysis.overallScore}`);
  assert.ok(sharyaAnalysis.matchedCompetencies.includes("Technical SEO"));
  assert.ok(sharyaAnalysis.matchedCompetencies.includes("Conversion Rate Optimization (CRO)"));
  assert.ok(sharyaAnalysis.matchedMetricTypes.length >= 2);

  const lorna = DEMO_PROFILES.find((p) => p.id === "lorna-alvarado")!.create();
  const lornaAnalysis = analyzeResumeForRole(lorna);
  assert.equal(lornaAnalysis.roleId, "product-designer");
  assert.ok(lornaAnalysis.overallScore >= 80, `Expected score >= 80, got ${lornaAnalysis.overallScore}`);
  assert.ok(lornaAnalysis.matchedCompetencies.includes("Design Systems"));
  assert.ok(lornaAnalysis.matchedCompetencies.includes("Figma"));
});

test("generateAiResume generates valid ResumeDocument for product-designer and marketing-lead", () => {
  const designerDoc = generateAiResume({
    name: "Clara Oswald",
    roleId: "product-designer",
    seniority: "senior",
    keySkills: ["Design Systems", "Figma", "User Research", "WCAG 2.1 Accessibility"],
  });
  const parsedDesigner = documentSchema.parse(designerDoc);
  assert.ok(parsedDesigner.contact.headline.includes("Designer"));
  const designerAnalysis = analyzeResumeForRole(parsedDesigner, "product-designer");
  assert.ok(designerAnalysis.overallScore >= 70);

  const marketingDoc = generateAiResume({
    name: "Julian Vance",
    roleId: "marketing-lead",
    seniority: "lead",
    keySkills: ["Technical SEO", "Conversion Rate Optimization (CRO)", "Google Analytics 4", "HubSpot"],
  });
  const parsedMarketing = documentSchema.parse(marketingDoc);
  assert.ok(parsedMarketing.contact.headline.includes("Marketing") || parsedMarketing.contact.headline.includes("Growth"));
  const marketingAnalysis = analyzeResumeForRole(parsedMarketing, "marketing-lead");
  assert.ok(marketingAnalysis.overallScore >= 70);
});

test("analyzeResumeForRole evaluates SWE skills and detects missing competencies", () => {
  const doc = createDocument(true); // Alex Morgan product designer
  const result = analyzeResumeForRole(doc, "software-engineer");

  assert.equal(result.roleId, "software-engineer");
  assert.ok(typeof result.overallScore === "number");
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
  assert.ok(result.missingCompetencies.length > 0);
  assert.ok(result.missingMetricTypes.length > 0);
  assert.ok(result.actionableInsights.length > 0);
});

test("generateAiResume generates valid ResumeDocument for software-engineer", () => {
  const doc = generateAiResume({
    name: "Devon Vance",
    roleId: "software-engineer",
    seniority: "senior",
    keySkills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "AWS"],
    industry: "High-Growth SaaS",
  });

  // Must validate against strict documentSchema
  const parsed = documentSchema.parse(doc);
  assert.equal(parsed.contact.name, "Devon Vance");
  assert.ok(parsed.contact.headline.includes("Software Engineer"));
  assert.ok(parsed.sections.some((s) => s.type === "experience" && s.entries.length >= 2));
  assert.ok(parsed.sections.some((s) => s.type === "skills" && s.entries.length >= 1));
  assert.ok(parsed.sections.some((s) => s.type === "summary" && s.entries.length >= 1));

  // Role analysis on generated resume should yield strong score
  const analysis = analyzeResumeForRole(parsed, "software-engineer");
  assert.ok(analysis.overallScore >= 70);
  assert.equal(analysis.detectedSeniority, "Senior");
});

test("generateAiResume generates valid ResumeDocument for software-architect", () => {
  const doc = generateAiResume({
    name: "Elena Rostova",
    roleId: "software-architect",
    seniority: "lead",
    keySkills: ["System Design", "Microservices Architecture", "AWS", "Kafka", "Kubernetes"],
  });

  const parsed = documentSchema.parse(doc);
  assert.equal(parsed.contact.name, "Elena Rostova");
  assert.ok(parsed.contact.headline.includes("Architect"));

  const expSec = parsed.sections.find((s) => s.type === "experience");
  assert.ok(expSec);
  const allBullets = expSec.entries.flatMap((e) => e.bullets.map((b) => b.text));
  // Should have architectural and cloud metrics
  assert.ok(allBullets.some((b) => b.includes("uptime SLA") || b.includes("microservices")));

  const analysis = analyzeResumeForRole(parsed, "software-architect");
  assert.ok(analysis.overallScore >= 70);
});

test("generateAiResume generates valid ResumeDocument for business-analyst", () => {
  const doc = generateAiResume({
    name: "Marcus Sterling",
    roleId: "business-analyst",
    seniority: "mid",
    keySkills: ["Requirements Gathering", "BRD / FRD Documentation", "User Stories", "Stakeholder Management"],
  });

  const parsed = documentSchema.parse(doc);
  assert.equal(parsed.contact.name, "Marcus Sterling");
  assert.ok(parsed.contact.headline.includes("Business Analyst"));

  const expSec = parsed.sections.find((s) => s.type === "experience");
  assert.ok(expSec);
  const allBullets = expSec.entries.flatMap((e) => e.bullets.map((b) => b.text));
  assert.ok(allBullets.some((b) => b.includes("BRD") || b.includes("UAT") || b.includes("cycle time")));

  const analysis = analyzeResumeForRole(parsed, "business-analyst");
  assert.ok(analysis.overallScore >= 70);
});

test("DEMO_PROFILES contains 5 complete realistic profiles that strictly validate", async () => {
  const { DEMO_PROFILES } = await import("../src/lib/demo-resumes");
  const { layoutBlocks } = await import("../src/lib/layout");

  assert.equal(DEMO_PROFILES.length, 5);

  for (const profile of DEMO_PROFILES) {
    const doc = profile.create();
    // Validate schema
    const parsed = documentSchema.parse(doc);
    assert.equal(parsed.contact.name, profile.name);
    assert.ok(parsed.sections.length >= 6);

    // Validate layout block generation
    const blocks = layoutBlocks(parsed);
    assert.ok(blocks.length > 10);
    assert.ok(blocks.some((b) => b.kind === "name" && b.text === profile.name));
    assert.ok(blocks.some((b) => b.kind === "section"));
    assert.ok(blocks.some((b) => b.kind === "bullet"));

    if (profile.hasPhoto) {
      assert.ok(blocks.some((b) => b.kind === "photo"));
    }
  }
});

