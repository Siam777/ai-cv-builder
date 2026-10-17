import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../src/lib/document";
import { listedSkills, statedIn } from "../src/lib/ai-contract";

// Controlled provider: replies in order, records what was sent. No network.
function fakeTransport(...payloads: unknown[]) {
  const sent: string[] = [];
  const transport = (async (_url: string, init?: RequestInit) => {
    sent.push(String(init?.body));
    const payload = payloads.shift();
    if (payload === undefined) throw new Error("Unexpected provider call");
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] },
        ],
      }),
    );
  }) as typeof fetch;
  return { transport, sent, remaining: () => payloads.length };
}

const code = (expected: string) => (error: unknown) =>
  (error as { code: string }).code === expected;

describe("Suggest skills with AI and the AI interview", () => {
  let services: typeof import("../src/lib/server/ai-service");
  let provider: typeof import("../src/lib/server/openai-provider");
  let consent: typeof import("../src/lib/server/ai-consent");
  let saveResume: typeof import("../src/lib/server/resumes").saveResume;
  let upsertSubscription: typeof import("../src/lib/server/entitlements").upsertSubscription;
  let close: () => void;

  before(async () => {
    process.env.TURSO_DATABASE_URL = "file::memory:";
    process.env.OPENAI_API_KEY = "synthetic-test-key";
    process.env.BETA_GO_TRIAL_DAYS = "0";
    const { database } = await import("../src/lib/server/database");
    ({ saveResume } = await import("../src/lib/server/resumes"));
    ({ upsertSubscription } = await import("../src/lib/server/entitlements"));
    services = await import("../src/lib/server/ai-service");
    provider = await import("../src/lib/server/openai-provider");
    consent = await import("../src/lib/server/ai-consent");
    const { client } = database();
    close = () => client.close();
    for (const name of (await readdir("migrations")).filter((n) => n.endsWith(".sql")).sort())
      await client.executeMultiple(await readFile(`migrations/${name}`, "utf8"));
  });
  after(() => {
    close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.BETA_GO_TRIAL_DAYS;
  });

  /** An account on a plan, with AI writing help on and the sample CV. */
  async function account(plan: "free" | "go", withConsent = true) {
    const { database } = await import("../src/lib/server/database");
    const id = `user-${randomUUID()}`;
    await database().client.execute({
      sql: "INSERT INTO user VALUES (?,?,?,1,NULL,0,0)",
      args: [id, "Test", `${id}@example.test`],
    });
    if (plan === "go")
      await upsertSubscription({
        userId: id,
        stripeCustomerId: `cus_${id}`,
        planId: "go",
        status: "active",
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
      });
    if (withConsent) await consent.setAiConsent(id, true);
    const doc: ResumeDocument = await saveResume(id, createDocument(true), null);
    return { id, doc };
  }

  const bulletOf = (doc: ResumeDocument) =>
    doc.sections.find((s) => s.type === "experience")!.entries[0].bullets[0];

  test("skills the CV shows quote their evidence and pass the support check; others are withheld", async () => {
    const a = await account("go");
    const bullet = bulletOf(a.doc);
    const listed = listedSkills(a.doc);
    assert.ok(listed.includes("Figma"));
    const fake = fakeTransport(
      {
        message: "",
        demonstrated: [
          { skill: "Stakeholder interviews", evidenceIds: [bullet.id] },
          { skill: "People management", evidenceIds: [bullet.id] },
          { skill: "Kubernetes", evidenceIds: ["not-in-cv"] },
          { skill: "Figma", evidenceIds: [bullet.id] },
        ],
        roleSuggestions: ["Usability testing", "figma", "Accessibility"],
        groups: [
          { name: "Tools", skills: ["Figma", "Kubernetes"] },
          { name: "Methods", skills: ["User research", "Prototyping", "figma"] },
        ],
      },
      {
        results: [
          { index: 0, supported: true, reason: "Stated." },
          { index: 1, supported: false, reason: "No management in the evidence." },
        ],
      },
    );
    const result = await services.requestSkillSuggestions(
      a.id,
      { requestId: randomUUID(), documentId: a.doc.id, revision: a.doc.revision },
      (doc, input) => provider.generateSkillSuggestions(doc, input, fake.transport),
    );
    assert.deepEqual(result.demonstrated.map((d) => d.skill), ["Stakeholder interviews"]);
    assert.equal(result.demonstrated[0].evidence[0], bullet.text);
    // One unsupported, one with an invented evidence ID; an already listed skill is skipped.
    assert.equal(result.withheld, 2);
    assert.deepEqual(result.roleSuggestions, ["Usability testing", "Accessibility"]);
    // Groups only rearrange listed skills, each once; the rest go to Other.
    assert.deepEqual(result.groups[0], { name: "Tools", skills: ["Figma"] });
    assert.deepEqual(result.groups[1], { name: "Methods", skills: ["User research", "Prototyping"] });
    assert.equal(result.groups.at(-1)!.name, "Other");
    assert.equal(result.role, "Product designer");
    assert.equal(fake.remaining(), 0);
    for (const body of fake.sent) assert.doesNotMatch(body, /alex@example\.com|010-2040/);
  });

  test("skills are Go and Pro; plan and consent are checked before any provider call", async () => {
    let calls = 0;
    const never = async () => {
      calls++;
      throw new Error("provider must not be called");
    };
    const free = await account("free");
    await assert.rejects(
      services.requestSkillSuggestions(
        free.id,
        { requestId: randomUUID(), documentId: free.doc.id, revision: free.doc.revision },
        never,
      ),
      code("PLAN_REQUIRED"),
    );
    const go = await account("go", false);
    await assert.rejects(
      services.requestSkillSuggestions(
        go.id,
        { requestId: randomUUID(), documentId: go.doc.id, revision: go.doc.revision },
        never,
      ),
      code("AI_CONSENT_REQUIRED"),
    );
    assert.equal(calls, 0);
  });

  test("an interview step keeps only items stated in the answer", async () => {
    const a = await account("go");
    const { interviewId, remaining } = await services.startInterview(a.id, { documentId: a.doc.id });
    assert.equal(remaining, null);
    const education = fakeTransport({
      entries: [
        { qualification: "BSc Computer Science", institution: "University of Leeds", year: "2019" },
        { qualification: "MSc Data Science", institution: "Imperial College", year: "2021" },
        { qualification: "Diploma in Design", institution: "Leeds College", year: "20" },
      ],
    });
    const step = await services.requestInterviewStep(
      a.id,
      {
        requestId: randomUUID(),
        interviewId,
        step: "education",
        answer: "BSc Computer Science at the University of Leeds, 2019. Diploma in Design.",
      },
      (input) => provider.generateInterviewStep(input, education.transport),
    );
    assert.deepEqual(step.education, [
      { qualification: "BSc Computer Science", institution: "University of Leeds", year: "2019" },
      { qualification: "Diploma in Design", institution: "", year: "" },
    ]);
    assert.equal(step.dropped, 1);

    const extras = fakeTransport({
      skills: ["Excel", "SQL", "Python", "excel"],
      languages: [
        { language: "Spanish", level: "fluent" },
        { language: "French", level: "native" },
      ],
      certifications: [
        { name: "PRINCE2 Foundation", issuer: "Axelos", year: "2022" },
        { name: "AWS Solutions Architect", issuer: "", year: "" },
      ],
    });
    const more = await services.requestInterviewStep(
      a.id,
      {
        requestId: randomUUID(),
        interviewId,
        step: "extras",
        answer: "I use Excel and SQL daily. Spanish (fluent). PRINCE2 Foundation 2022.",
      },
      (input) => provider.generateInterviewStep(input, extras.transport),
    );
    assert.deepEqual(more.skills, ["Excel", "SQL"]);
    assert.deepEqual(more.languages, [{ language: "Spanish", level: "fluent" }]);
    assert.deepEqual(more.certifications, [{ name: "PRINCE2 Foundation", issuer: "", year: "2022" }]);
    assert.equal(more.dropped, 3);
  });

  test("Free gets one interview; steps need a started interview, consent and the daily limit", async () => {
    let calls = 0;
    const fake = async () => {
      calls++;
      return { education: [], skills: ["Excel"], languages: [], certifications: [], dropped: 0 };
    };
    const free = await account("free");
    const first = await services.startInterview(free.id, { documentId: free.doc.id });
    assert.equal(first.remaining, 0);
    await assert.rejects(
      services.startInterview(free.id, { documentId: free.doc.id }),
      code("PLAN_REQUIRED"),
    );
    const step = (interviewId: string) =>
      services.requestInterviewStep(
        free.id,
        { requestId: randomUUID(), interviewId, step: "extras", answer: "Excel" },
        fake,
      );
    await assert.rejects(step(randomUUID()), code("AI_INTERVIEW_NOT_FOUND"));
    // Free: 5 AI requests a day across all features.
    for (let i = 0; i < 5; i++) await step(first.interviewId);
    await assert.rejects(step(first.interviewId), code("AI_LIMIT"));
    assert.equal(calls, 5);

    const noConsent = await account("go", false);
    await assert.rejects(
      services.startInterview(noConsent.id, { documentId: noConsent.doc.id }),
      code("AI_CONSENT_REQUIRED"),
    );
    // Another account's CV is not found.
    await assert.rejects(services.startInterview(noConsent.id, { documentId: free.doc.id }));
  });

  test("statedIn matches whole words in order, ignoring case and punctuation", () => {
    assert.equal(statedIn("University of Leeds", "at the university of leeds, 2019"), true);
    assert.equal(statedIn("Leeds University", "at the university of leeds"), false);
    assert.equal(statedIn("C++", "I write C++ daily"), true);
    assert.equal(statedIn("Java", "I write JavaScript"), false);
    assert.equal(statedIn("", "anything"), false);
  });
});
