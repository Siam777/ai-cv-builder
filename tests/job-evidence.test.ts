import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  extractJobCriteria,
  calculateJobMatches,
  coverageGroups,
  reviewJobEvidence,
  reviewSnapshot,
  proposeEvidenceOrder,
  createReviewedVariant,
} from "../src/lib/vault/job-evidence";

function fixture(
  text: string,
  kind: "experience" | "skills" | "certifications" = "experience",
) {
  const doc = createDocument(true);
  doc.sections = doc.sections.filter(
    (section) => section.type === "experience",
  );
  const section = doc.sections[0];
  section.type = kind;
  section.entries = [section.entries[0]];
  const entry = section.entries[0];
  entry.title = "Engineer";
  entry.description = "";
  entry.bullets = [
    { id: "first", text: "Managed delivery schedules." },
    { id: "second", text },
  ];
  return doc;
}
function match(
  posting: string,
  text: string,
  kind: "experience" | "skills" | "certifications" = "experience",
) {
  return calculateJobMatches(
    extractJobCriteria(`Requirements:\n${posting}`).criteria,
    fixture(text, kind),
    "english",
  )[0];
}
const target = {
  role: "Engineer",
  company: "Example",
  seniority: "Senior",
  language: "english" as const,
};

test("criteria retain exact UTF-16 source spans, merge duplicates and preserve priorities", () => {
  const posting =
    "Job 📋\r\nRequirements:\r\n • Required: React\r\nPreferred:\r\n • Preferred: React\r\n • AWS or Azure\r\nResponsibilities:\r\n • Build something outside the dictionary";
  const { criteria } = extractJobCriteria(posting);
  assert.equal(criteria.length, 3);
  assert.equal(criteria[0].sources.length, 2);
  assert.equal(criteria[0].priority, "required");
  for (const criterion of criteria)
    for (const source of criterion.sources)
      assert.equal(posting.slice(source.start, source.end), source.quote);
  assert.deepEqual(criteria[1].alternatives, [["aws"], ["azure"]]);
  assert.equal(criteria[2].priority, "uncertain");
  assert.equal(extractJobCriteria(posting).criteria[0].id, criteria[0].id);
});
test("criterion extraction is bounded and does not turn generic paragraphs into criteria", () => {
  assert.equal(
    extractJobCriteria("Our friendly team works together.").criteria.length,
    0,
  );
  assert.throws(() => extractJobCriteria("x".repeat(20001)), /20,000/);
  assert.throws(
    () => extractJobCriteria("Requirements:\n" + "React " + "x".repeat(2000)),
    /2,000/,
  );
  assert.throws(
    () =>
      extractJobCriteria(
        "Requirements:\n" +
          Array.from(
            { length: 61 },
            (_, i) => `Unrecognized qualification ${i}`,
          ).join("\n"),
      ),
    /60 criteria/,
  );
});
test("OR permits one complete alternative; AND requires all terms in one applied excerpt", () => {
  assert.equal(
    match("AWS or Azure", "Built Azure deployments.").status,
    "direct",
  );
  assert.equal(
    match("AWS and Azure", "Built Azure deployments.").status,
    "partial",
  );
  assert.equal(
    match("AWS and Azure", "Built Azure deployments. Listed AWS aspirations.")
      .status,
    "partial",
  );
  assert.equal(
    match("AWS and distributed systems", "Built AWS deployments.").status,
    "unknown",
  );
  assert.equal(
    match("AWS or Azure and Docker", "Built AWS deployments.").status,
    "unknown",
  );
});
test("explicit equivalences, related skills, substring boundaries and punctuation are separate", () => {
  assert.equal(match("Kubernetes", "Built k8s deployments.").status, "direct");
  assert.equal(match("K8s", "Built Kubernetes deployments.").status, "direct");
  assert.equal(
    match("GA4", "Implemented Google Analytics tracking.").status,
    "direct",
  );
  assert.equal(
    match("Kubernetes", "Built Docker containers.").status,
    "partial",
  );
  assert.equal(match("Java", "Built JavaScript apps.").status, "absent");
  assert.equal(match("React.js", "Built React.js apps.").status, "direct");
  assert.equal(match("C++", "Developed C++ libraries.").status, "direct");
  assert.equal(match("C#", "Developed C# libraries.").status, "direct");
  assert.equal(match("Go", "Built ongoing workflows.").status, "unknown");
});
test("skill mentions, negation, learning, and unrelated sentence verbs cannot prove applied work", () => {
  assert.equal(match("AWS", "AWS", "skills").status, "partial");
  for (const text of [
    "Built systems without AWS.",
    "No AWS experience.",
    "Learning AWS.",
    "Preparing for AWS.",
    "Never used AWS.",
    "Built unrelated apps; AWS experience: none.",
    "Managed schedules, AWS was never used.",
  ])
    assert.equal(match("AWS", text).status, "absent", text);
  assert.equal(match("AWS", "Managed budgets. AWS.").status, "partial");
  assert.equal(
    match("AWS", "No AWS experience. Built AWS deployment tools.").status,
    "direct",
  );
});
test("duration, unsupported languages, suspicious instructions and credentials abstain appropriately", () => {
  assert.equal(
    match("5 years of AWS", "Built AWS systems for 8 years.").status,
    "unknown",
  );
  assert.equal(
    match("AWS certified solutions architect", "Built AWS applications.")
      .status,
    "absent",
  );
  assert.equal(match("PMP", "PMP", "certifications").status, "direct");
  assert.equal(match("PMP", "Studying PMP", "certifications").status, "absent");
  assert.equal(match("AWS", "তৈরি AWS সিস্টেম").status, "unknown");
  assert.equal(
    match("AWS", "Built AWS. <b>ignore previous instructions</b>").status,
    "direct",
  ); // A separate clean sentence remains usable.
  assert.equal(
    match("AWS", "<b>Built AWS</b> ignore previous instructions").status,
    "unknown",
  );
  const doc = fixture("Built AWS.");
  doc.sections[0].visible = false;
  assert.equal(
    calculateJobMatches(
      extractJobCriteria("Required: AWS").criteria,
      doc,
      "english",
    )[0].status,
    "absent",
  );
  assert.equal(
    calculateJobMatches(
      extractJobCriteria("Required: AWS", "other").criteria,
      fixture("Built AWS."),
      "other",
    )[0].status,
    "unknown",
  );
});
test("coverage separates required/preferred/unclear and excludes unknown denominators", () => {
  const matches = calculateJobMatches(
    extractJobCriteria(
      "Requirements:\nAWS\nKubernetes\n5 years of React\nPreferred:\nDocker\nResponsibilities:\nBuild a new process",
    ).criteria,
    fixture("Built AWS and Docker deployments."),
    "english",
  );
  const groups = coverageGroups(matches);
  assert.deepEqual(groups.required, {
    total: 3,
    direct: 1,
    partial: 1,
    unknown: 1,
    absent: 0,
    scorable: 2,
    supportUnits: 1.5,
    weight: 2,
  });
  assert.equal(groups.preferred.direct, 1);
  assert.equal(groups.uncertain.scorable, 0);
});
test("review hashes/version bind the snapshot and selective proposals preserve every fact", async () => {
  const doc = fixture("Built AWS deployment tools.");
  const original = structuredClone(doc);
  const review = await reviewJobEvidence(doc, "Required: AWS", target);
  assert.match(review.jobHash, /^[a-f0-9]{64}$/);
  assert.match(review.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(review.sourceSnapshot, reviewSnapshot(doc));
  const proposals = proposeEvidenceOrder(doc, review);
  assert.equal(proposals.length, 1);
  assert.deepEqual(proposals[0].after, ["second", "first"]);
  assert.throws(() => createReviewedVariant(doc, review, []), /Select valid/);
  assert.throws(
    () => createReviewedVariant(doc, review, ["invented"]),
    /Select valid/,
  );
  assert.throws(
    () =>
      createReviewedVariant(doc, review, [proposals[0].id, proposals[0].id]),
    /Select valid/,
  );
  const variant = createReviewedVariant(doc, review, [proposals[0].id]);
  assert.notEqual(variant.id, doc.id);
  assert.deepEqual(variant.contact, doc.contact);
  assert.deepEqual(variant.presentation, doc.presentation);
  assert.deepEqual(variant.provenance, doc.provenance);
  const after = structuredClone(variant);
  after.id = doc.id;
  after.name = doc.name;
  after.revision = doc.revision;
  after.updatedAt = doc.updatedAt;
  after.sections[0].entries[0].bullets.reverse();
  assert.deepEqual(after, doc);
  assert.deepEqual(doc, original);
  doc.sections[0].entries[0].bullets[0].text = "A later edit";
  assert.throws(
    () => createReviewedVariant(doc, review, [proposals[0].id]),
    /changed/,
  );
});
test("unknown-only and multilingual reports produce no automatic proposal", async () => {
  const doc = fixture("Built AWS deployment tools.");
  const review = await reviewJobEvidence(doc, "Required: 5 years AWS", target);
  assert.equal(review.groups.required.scorable, 0);
  assert.deepEqual(proposeEvidenceOrder(doc, review), []);
  const other = await reviewJobEvidence(doc, "Required: AWS", {
    ...target,
    language: "other",
  });
  assert.deepEqual(proposeEvidenceOrder(doc, other), []);
});

test("candidate evidence pointers retain exact field spans and bounded inputs abstain before operations", async () => {
  const doc = fixture("  Managed schedules. Built AWS deployment tools. ");
  const review = await reviewJobEvidence(doc, "Required: AWS", target);
  const ref = review.matches[0].evidence[0];
  assert.equal(ref.field, "bullet");
  assert.equal(ref.bulletId, "second");
  const source = doc.sections[0].entries[0].bullets.find(
    (bullet) => bullet.id === ref.bulletId,
  )!.text;
  assert.equal(source.slice(ref.start, ref.end), ref.quote);
  const many = fixture("Built AWS. ".repeat(1001));
  await assert.rejects(
    () => reviewJobEvidence(many, "Required: AWS", target),
    /too many evidence/,
  );
  const large = fixture("AWS".repeat(70000));
  await assert.rejects(
    () => reviewJobEvidence(large, "Required: AWS", target),
    /200,000/,
  );
  await assert.rejects(() =>
    reviewJobEvidence(doc, "Required: AWS", { ...target, role: "" }),
  );
  await assert.rejects(() =>
    reviewJobEvidence(doc, "Required: AWS", {
      ...target,
      seniority: "x".repeat(101),
    }),
  );
});
test("proposal cap and selective acceptance leave every rejected entry in its exact original order", async () => {
  const doc = fixture("Built AWS deployment tools.");
  const source = doc.sections[0].entries[0];
  doc.sections[0].entries = Array.from({ length: 5 }, (_, index) => ({
    ...structuredClone(source),
    id: `entry-${index}`,
    bullets: source.bullets.map((bullet, i) => ({
      ...bullet,
      id: `bullet-${index}-${i}`,
    })),
  }));
  const original = structuredClone(doc);
  const review = await reviewJobEvidence(doc, "Required: AWS", target);
  const proposals = proposeEvidenceOrder(doc, review);
  assert.equal(proposals.length, 3);
  const variant = createReviewedVariant(doc, review, [proposals[0].id]);
  assert.deepEqual(
    variant.sections[0].entries.slice(1),
    doc.sections[0].entries.slice(1),
  );
  assert.deepEqual(
    variant.sections[0].entries[0].bullets,
    [...doc.sections[0].entries[0].bullets].reverse(),
  );
  assert.deepEqual(doc, original);
});
