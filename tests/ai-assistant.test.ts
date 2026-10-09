import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  generateExecutiveSummaries,
  generateInterviewClarifications,
  applyInterviewAnswer,
  discoverDemonstratedSkills,
} from "../src/lib/vault/ai-assistant";

test("generateExecutiveSummaries produces 3 grounded summaries citing candidate details", () => {
  const doc = createDocument(true);
  doc.contact.headline = "Staff Cloud Architect";

  const summaries = generateExecutiveSummaries(doc);
  assert.equal(summaries.length, 3);

  const ids = summaries.map((s) => s.id);
  assert.ok(ids.includes("metric_impact"));
  assert.ok(ids.includes("tech_architecture"));
  assert.ok(ids.includes("concise_executive"));

  for (const s of summaries) {
    assert.ok(s.text.length > 50, "Summary should have meaningful length");
    assert.ok(s.wordCount > 10, "Summary word count should be accurate");
    assert.ok(
      s.text.includes("Staff Cloud Architect"),
      "Summary should cite candidate headline",
    );
  }
});

test("generateInterviewClarifications identifies bullets without metrics and suggests relevant question prompts", () => {
  const doc = createDocument(false);
  const expSection = doc.sections.find((s) => s.type === "experience")!;
  expSection.entries = [
    {
      id: "exp-1",
      title: "Backend Engineer",
      organization: "CloudCo",
      location: "Remote",
      start: "2021",
      end: "2023",
      current: false,
      description: "",
      bullets: [
        { id: "b-1", text: "Optimized database queries and API response latency." },
        { id: "b-2", text: "Built microservices that handled 50k requests per second." }, // Has metric!
        { id: "b-3", text: "Helped reduce infrastructure cloud spend." },
      ],
    },
  ];

  const questions = generateInterviewClarifications(doc);
  assert.equal(questions.length, 2); // b-1 and b-3 (b-2 has a metric)

  // b-1 matches latency
  const q1 = questions.find((q) => q.bulletId === "b-1")!;
  assert.ok(q1);
  assert.equal(q1.suggestedMetricKind, "latency");
  assert.ok(q1.questionPrompt.includes("CloudCo"));
  assert.ok(q1.questionPrompt.includes("Backend Engineer"));

  // b-3 matches cost
  const q3 = questions.find((q) => q.bulletId === "b-3")!;
  assert.ok(q3);
  assert.equal(q3.suggestedMetricKind, "cost");
});

test("applyInterviewAnswer synthesizes a Google XYZ bullet with candidate metric", () => {
  const original = "Optimized database queries and API response latency.";
  const metric = "reducing P99 query latency by 45%";
  const result = applyInterviewAnswer(original, metric);

  assert.ok(result.includes("reducing P99 query latency by 45%"));
  assert.ok(result.startsWith("Optimized"));
});

test("discoverDemonstratedSkills discovers skills mentioned in bullets but not in skills section", () => {
  const doc = createDocument(false);
  const expSection = doc.sections.find((s) => s.type === "experience")!;
  expSection.entries = [
    {
      id: "exp-1",
      title: "Full Stack Engineer",
      organization: "TechCorp",
      location: "San Francisco",
      start: "2022",
      end: "2024",
      current: false,
      description: "",
      bullets: [
        { id: "b-1", text: "Deployed containerized services to Kubernetes and configured Docker workflows." },
      ],
    },
  ];

  const skillsSection = doc.sections.find((s) => s.type === "skills")!;
  skillsSection.entries = [
    {
      id: "sk-1",
      title: "Languages",
      organization: "",
      location: "",
      start: "",
      end: "",
      current: false,
      description: "TypeScript · Python",
      bullets: [],
    },
  ];

  const discovered = discoverDemonstratedSkills(doc);
  const skillNames = discovered.map((d) => d.skill);

  // Kubernetes and Docker are in bullets but not in Skills section
  assert.ok(skillNames.includes("Kubernetes"));
  assert.ok(skillNames.includes("Docker"));
  // TypeScript is already in Skills section, so should NOT be suggested
  assert.ok(!skillNames.includes("TypeScript"));

  const k8s = discovered.find((d) => d.skill === "Kubernetes")!;
  assert.ok(k8s.evidenceBullet.includes("Kubernetes"));
  assert.equal(k8s.category, "Cloud & DevOps");
});
