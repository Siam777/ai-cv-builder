import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../src/lib/document";
import { bulletEvidence } from "../src/lib/ai-proposals";
import { validAskActions } from "../src/lib/ai-contract";

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
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }],
      }),
    );
  }) as typeof fetch;
  return { transport, sent, remaining: () => payloads.length };
}
const supported = (...flags: boolean[]) => ({
  results: flags.map((ok, index) => ({ index, supported: ok, reason: ok ? "Accurate." : "Not accurate." })),
});
const code = (expected: string) => (error: unknown) => (error as { code: string }).code === expected;

describe("Phase E: Ask the AI", () => {
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
    return { id, doc, bullets: bulletEvidence(doc) };
  }
  const ask = (a: Awaited<ReturnType<typeof account>>, question = "How can I make my CV stronger for project manager roles?") => ({
    requestId: randomUUID(),
    documentId: a.doc.id,
    revision: a.doc.revision,
    question,
  });

  test("an answer with supported statements keeps only actions that target real items", async () => {
    const a = await account("go");
    const [b1] = a.bullets;
    const fake = fakeTransport(
      {
        answer: "Your bullets show design leadership but no planning or delivery results. Make the first one clearer, and match a project manager post to see the gaps.",
        claims: [
          { text: "The CV shows leading the design of a collaborative workspace.", evidenceIds: [b1.id] },
          { text: "The CV has no delivery results with numbers.", evidenceIds: [] },
        ],
        actions: [
          { type: "improve-bullet", targetId: b1.id, label: "Improve the first bullet" },
          { type: "improve-bullet", targetId: "not-a-bullet", label: "Improve something" },
          { type: "match-job", targetId: "", label: "Match a project manager post" },
          { type: "delete-section", targetId: "", label: "Delete" },
        ],
      },
      supported(true, true),
    );
    const result = await services.requestAsk(a.id, ask(a), (doc, input) => provider.generateAsk(doc, input, fake.transport));
    assert.equal(result.withheld, false);
    assert.match(result.answer, /no planning or delivery results/);
    assert.deepEqual(
      result.actions.map((x) => [x.type, x.targetId]),
      [
        ["improve-bullet", b1.id],
        ["match-job", ""],
      ],
    );
    for (const body of fake.sent) assert.doesNotMatch(body, /alex@example\.com|010-2040/);
  });

  test("an answer that describes the CV wrongly, or cites evidence that does not exist, is withheld", async () => {
    const a = await account("go");
    const wrong = fakeTransport(
      {
        answer: "You already managed a team of designers, so lead with that.",
        claims: [{ text: "The CV shows managing a team of designers.", evidenceIds: [a.bullets[0].id] }],
        actions: [{ type: "check", targetId: "", label: "Check my CV" }],
      },
      supported(false),
    );
    const withheld = await provider.generateAsk(a.doc, { question: "What should I lead with?" }, wrong.transport);
    assert.equal(withheld.withheld, true);
    assert.deepEqual(withheld.actions, []);
    assert.doesNotMatch(withheld.answer, /managed a team/);
    const invented = fakeTransport({
      answer: "Your PhD stands out.",
      claims: [{ text: "The CV lists a PhD.", evidenceIds: ["phd-entry"] }],
      actions: [],
    });
    const result = await provider.generateAsk(a.doc, { question: "What stands out?" }, invented.transport);
    assert.equal(result.withheld, true);
    assert.equal(invented.remaining(), 0, "no support call for an invented citation");
  });

  test("advice with no statements about the CV skips the support check; contact details in the question are removed", async () => {
    const a = await account("go");
    const fake = fakeTransport({
      answer: "Keep each bullet to one line and start with a verb.",
      claims: [],
      actions: [{ type: "check", targetId: "", label: "Check my CV" }],
    });
    const result = await provider.generateAsk(
      a.doc,
      {
        question: "Can you email tips to alex@example.com?",
        history: [{ question: "Hi", answer: "Hello! Ask me about your CV." }],
      },
      fake.transport,
    );
    assert.equal(result.withheld, false);
    assert.deepEqual(result.actions, [{ type: "check", targetId: "", label: "Check my CV" }]);
    assert.equal(fake.sent.length, 1);
    assert.doesNotMatch(fake.sent[0], /alex@example\.com/);
    assert.match(fake.sent[0], /Hello! Ask me about your CV/);
  });

  test("Ask the AI is Go and Pro; consent and the daily limit apply", async () => {
    let calls = 0;
    const never = async () => {
      calls++;
      throw new Error("provider must not be called");
    };
    const free = await account("free");
    await assert.rejects(services.requestAsk(free.id, ask(free), never), code("PLAN_REQUIRED"));
    const noConsent = await account("go", false);
    await assert.rejects(services.requestAsk(noConsent.id, ask(noConsent), never), code("AI_CONSENT_REQUIRED"));
    assert.equal(calls, 0);
    process.env.AI_DAILY_USER_LIMIT = "2";
    try {
      const a = await account("go");
      const reply = async () => ({ answer: "Tip.", actions: [], withheld: false });
      await services.requestAsk(a.id, ask(a), reply);
      await services.requestAsk(a.id, ask(a), reply);
      await assert.rejects(services.requestAsk(a.id, ask(a), reply), code("AI_LIMIT"));
    } finally {
      delete process.env.AI_DAILY_USER_LIMIT;
    }
  });

  test("validAskActions keeps known types with real targets, once each", () => {
    const doc = createDocument(true);
    const section = doc.sections[0];
    const bullet = bulletEvidence(doc)[0];
    assert.deepEqual(
      validAskActions(doc, [
        { type: "open-section", targetId: section.id, label: "Open" },
        { type: "open-section", targetId: "missing", label: "Open" },
        { type: "improve-bullet", targetId: bullet.id, label: "" },
        { type: "write-summary", targetId: "ignored", label: "Write my summary" },
        { type: "write-summary", targetId: "", label: "Again" },
        { type: "rm -rf", targetId: "", label: "No" },
      ]),
      [
        { type: "open-section", targetId: section.id, label: "Open" },
        { type: "improve-bullet", targetId: bullet.id, label: "improve-bullet" },
        { type: "write-summary", targetId: "", label: "Write my summary" },
      ],
    );
  });
});
