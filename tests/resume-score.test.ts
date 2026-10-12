import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, uid, type ResumeDocument } from "../src/lib/document";
import { lintResumeDocument } from "../src/lib/linter/ats-linter";
import {
  analyzeJobGap,
  experienceYears,
  scoreResume,
  startsWithActionVerb,
} from "../src/lib/linter/resume-score";

function section(doc: ResumeDocument, type: string) {
  return doc.sections.find((s) => s.type === type)!;
}

function entry(title: string, organization: string, start: string, end: string, bullets: string[], current = false) {
  return {
    id: uid(),
    title,
    organization,
    location: "",
    start,
    end,
    current,
    description: "",
    bullets: bullets.map((text) => ({ id: uid(), text })),
  };
}

function strongResume() {
  const doc = createDocument();
  doc.contact = {
    name: "Jordan Lee",
    headline: "Product Engineer",
    email: "jordan@example.com",
    phone: "+1 555 010 2000",
    location: "Austin, TX",
    website: "example.com/jordan",
  };
  section(doc, "summary").entries = [
    {
      ...entry("", "", "", "", []),
      description:
        "Product engineer with seven years building web platforms for growing SaaS teams. Known for turning ambiguous problems into shipped features, and for reducing page load time by 40% across a customer dashboard used daily.",
    },
  ];
  section(doc, "experience").entries = [
    entry("Senior Engineer", "Acme", "2021-03", "", [
      "Led a rebuild of the billing dashboard in React, cutting support tickets by 30% within two quarters.",
      "Reduced API latency from 900ms to 200ms by introducing caching with Redis across core endpoints.",
      "Mentored 4 engineers through structured code review and pairing, shortening onboarding by 3 weeks.",
      "Launched a self-serve export feature adopted by 2,000 customers in the first month after release.",
    ], true),
    entry("Engineer", "Beta", "2018-01", "2021-02", [
      "Built a TypeScript component library reused across 5 product teams and 3 marketing sites.",
      "Automated release checks in CI, reducing failed deployments by 25% over the following year.",
      "Designed onboarding flows that improved activation for new small business accounts.",
    ]),
  ];
  section(doc, "education").entries = [entry("BSc Computer Science", "State University", "2014", "2018", [])];
  section(doc, "skills").entries = [
    entry("Engineering", "", "", "", ["React", "TypeScript", "Node.js", "Redis", "PostgreSQL", "AWS", "CI/CD"]),
  ];
  return doc;
}

test("Skills and languages entries are not linted as accomplishment bullets", () => {
  const doc = createDocument();
  section(doc, "skills").entries = [entry("Tools", "", "", "", ["React", "Figma", "SQL"])];
  section(doc, "languages").entries = [entry("Languages", "", "", "", ["English", "Spanish"])];
  const report = lintResumeDocument(doc);
  assert.equal(report.totalBulletsCount, 0);
  assert.equal(report.issues.filter((i) => i.ruleId === "bullet_length").length, 0);
});

test("Action verb detection accepts strong and past-tense openings, rejects vague ones", () => {
  assert.equal(startsWithActionVerb("Led the redesign of onboarding"), true);
  assert.equal(startsWithActionVerb("Facilitated weekly design critiques"), true);
  assert.equal(startsWithActionVerb("Responsible for weekly reports"), false);
  assert.equal(startsWithActionVerb("The team shipped a feature"), false);
});

test("Empty resume scores low with completeness fixes first", () => {
  const score = scoreResume(createDocument());
  assert.ok(score.total < 30, `expected low score, got ${score.total}`);
  assert.equal(score.grade, "Needs work");
  assert.equal(score.topFixes.length, 3);
  assert.ok(score.topFixes[0].points >= score.topFixes[2].points);
});

test("A complete, quantified resume scores Strong or better and explains every point", () => {
  const score = scoreResume(strongResume());
  assert.ok(score.total >= 80, `expected strong score, got ${score.total}`);
  assert.ok(["Strong", "Excellent"].includes(score.grade));
  const sum = score.categories.reduce((n, c) => n + c.max, 0);
  assert.equal(sum, 100);
  for (const cat of score.categories) {
    for (const check of cat.checks) {
      assert.ok(check.earned <= check.max);
      if (check.earned < check.max) assert.ok(check.fix, `${check.id} lost points without a fix`);
    }
  }
  const quantified = score.benchmarks.find((b) => b.id === "quantified")!;
  assert.equal(quantified.status, "within");
});

test("Score is deterministic for the same document", () => {
  const doc = strongResume();
  assert.deepEqual(scoreResume(doc), scoreResume(doc));
});

test("Vague bullets lose impact points and raise a rewrite fix", () => {
  const doc = strongResume();
  section(doc, "experience").entries[0].bullets = [
    { id: uid(), text: "Responsible for the billing dashboard and related tasks" },
    { id: uid(), text: "Worked on API performance improvements with the team" },
    { id: uid(), text: "Helped with onboarding for new engineers on the team" },
  ];
  const before = scoreResume(strongResume()).categories[0].score;
  const after = scoreResume(doc).categories[0];
  assert.ok(after.score < before);
  assert.ok(after.checks.find((c) => c.id === "weak-openings")!.fix);
});

test("Experience years merge overlapping roles", () => {
  const doc = createDocument();
  section(doc, "experience").entries = [
    entry("A", "X", "2018-01", "2020-01", []),
    entry("B", "Y", "2019-01", "2021-01", []),
  ];
  assert.equal(experienceYears(doc, new Date("2026-01-01")), 3);
});

test("Job gap analysis separates matched, missing and skills-only keywords", () => {
  const job = `Senior Frontend Engineer
Requirements:
- 5+ years building web apps with React and TypeScript
- Experience with Kubernetes and GraphQL
- Bachelor's degree in Computer Science
Nice to have:
- Mentoring junior engineers`;
  const gap = analyzeJobGap(strongResume(), job, new Date("2026-01-01"));
  const names = (list: { name: string }[]) => list.map((k) => k.name);
  assert.ok(names(gap.matched).includes("React"));
  assert.ok(names(gap.matched).includes("TypeScript"));
  assert.ok(names(gap.missing).includes("Kubernetes"));
  assert.ok(names(gap.missing).includes("GraphQL"));
  assert.equal(gap.keywords.find((k) => k.name === "Mentoring")?.importance, "preferred");
  assert.equal(gap.keywords.find((k) => k.name === "Mentoring")?.found, true);
  assert.equal(gap.years.required, 5);
  assert.equal(gap.years.meets, true);
  assert.equal(gap.education.found, true);
  assert.ok(gap.matchPercent > 0 && gap.matchPercent < 100);
  assert.ok(gap.nextSteps[0].includes("Kubernetes"));
});

test("Ambiguous words are not treated as skills", () => {
  const gap = analyzeJobGap(createDocument(), "We go the extra mile and express ideas clearly. Next steps follow.");
  const names = gap.keywords.map((k) => k.name);
  assert.ok(!names.includes("Go"));
  assert.ok(!names.includes("Next.js"));
  assert.ok(!names.includes("Express"));
});
