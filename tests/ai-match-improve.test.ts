import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, type ResumeDocument } from "../src/lib/document";
import { bulletEvidence } from "../src/lib/ai-proposals";
import { keepsOutsideSelection, keepsStart } from "../src/lib/ai-contract";

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
const supported = (...flags: boolean[]) => ({
  results: flags.map((ok, index) => ({ index, supported: ok, reason: ok ? "Stated." : "Not stated." })),
});
/** The JSON the provider was given, out of the request body. */
const providerInput = (body: string) => JSON.parse(JSON.parse(body).input[0].content);
const code = (expected: string) => (error: unknown) =>
  (error as { code: string }).code === expected;

const POST =
  "We are hiring a Product Designer. Required: lead discovery research with customers, build design systems and component libraries, and prototype in Figma. Preferred: experience with accessibility audits and B2B SaaS.";

describe("Phase C: Improve all, Continue writing, Rewrite selection, Match and Tailor with AI", () => {
  let services: typeof import("../src/lib/server/ai-service");
  let provider: typeof import("../src/lib/server/openai-provider");
  let consent: typeof import("../src/lib/server/ai-consent");
  let saveResume: typeof import("../src/lib/server/resumes").saveResume;
  let getResume: typeof import("../src/lib/server/resumes").getResume;
  let upsertSubscription: typeof import("../src/lib/server/entitlements").upsertSubscription;
  let close: () => void;

  before(async () => {
    process.env.TURSO_DATABASE_URL = "file::memory:";
    process.env.OPENAI_API_KEY = "synthetic-test-key";
    process.env.BETA_GO_TRIAL_DAYS = "0";
    const { database } = await import("../src/lib/server/database");
    ({ saveResume, getResume } = await import("../src/lib/server/resumes"));
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

  async function account(plan: "free" | "go" | "pro") {
    const { database } = await import("../src/lib/server/database");
    const id = `user-${randomUUID()}`;
    await database().client.execute({
      sql: "INSERT INTO user VALUES (?,?,?,1,NULL,0,0)",
      args: [id, "Test", `${id}@example.test`],
    });
    if (plan !== "free")
      await upsertSubscription({
        userId: id,
        stripeCustomerId: `cus_${id}`,
        planId: plan,
        status: "active",
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
      });
    await consent.setAiConsent(id, true);
    const doc: ResumeDocument = await saveResume(id, createDocument(true), null);
    // The first job's three bullets.
    const job = bulletEvidence(doc).slice(0, 3);
    return { id, doc, job };
  }
  const rewriteInput = (
    a: Awaited<ReturnType<typeof account>>,
    extra: Record<string, unknown>,
  ) => ({
    requestId: randomUUID(),
    documentId: a.doc.id,
    revision: a.doc.revision,
    bulletId: a.job[0].id,
    instruction: "Make these clearer without adding facts.",
    consent: true as const,
    ...extra,
  });

  test("Improve all returns one proposal; new numbers and unsupported rewrites are withheld", async () => {
    const a = await account("go");
    const [b1, b2, b3] = a.job;
    const fake = fakeTransport(
      {
        message: "Clearer wording.",
        questions: [],
        rewrites: [
          { bulletId: b1.id, text: "Led design of a collaborative workspace from discovery to launch.", evidenceIds: [b1.id] },
          { bulletId: b2.id, text: "Built a component library used by 40 engineers.", evidenceIds: [b2.id] },
          { bulletId: b3.id, text: "Owned all customer research for the company.", evidenceIds: [b3.id] },
        ],
      },
      supported(true, false),
    );
    const proposal = await services.requestRewrite(
      a.id,
      rewriteInput(a, { mode: "entry" }),
      undefined,
      undefined,
      (doc, bulletId, instruction) => provider.generateImproveAll(doc, bulletId, instruction, fake.transport),
    );
    assert.equal(proposal.operations.length, 1);
    assert.equal(proposal.operations[0].bulletId, b1.id);
    assert.match(proposal.message, /2 suggestions were withheld/);
    assert.equal(fake.remaining(), 0);
    // The number was withheld before the support check, which saw two items.
    assert.doesNotMatch(fake.sent[1], /40 engineers/);
  });

  test("accepting part of an Improve all proposal changes only the ticked bullets, once", async () => {
    const a = await account("pro");
    const [b1, b2] = a.job;
    const fake = fakeTransport(
      {
        message: "",
        questions: [],
        rewrites: [
          { bulletId: b1.id, text: "Led workspace design from discovery to launch.", evidenceIds: [b1.id] },
          { bulletId: b2.id, text: "Built a shared component library with engineering.", evidenceIds: [b2.id] },
        ],
      },
      supported(true, true),
    );
    const proposal = await services.requestRewrite(
      a.id,
      rewriteInput(a, { mode: "entry" }),
      undefined,
      undefined,
      (doc, bulletId, instruction) => provider.generateImproveAll(doc, bulletId, instruction, fake.transport),
    );
    assert.equal(proposal.operations.length, 2);
    await assert.rejects(
      services.decideProposal(a.id, proposal.id, "accept", ["not-in-proposal"]),
      code("AI_DECISION"),
    );
    const result = await services.decideProposal(a.id, proposal.id, "accept", [b2.id]);
    assert.equal(result.alreadyApplied, false);
    const saved = await getResume(a.id, a.doc.id);
    const texts = bulletEvidence(saved).map((b) => b.text);
    assert.ok(texts.includes("Built a shared component library with engineering."));
    assert.ok(texts.includes(b1.text), "the unticked bullet is unchanged");
    const again = await services.decideProposal(a.id, proposal.id, "accept", [b2.id]);
    assert.equal(again.alreadyApplied, true);
  });

  test("Improve all is Go and Pro; job coaching cannot use other modes", async () => {
    const free = await account("free");
    let calls = 0;
    const never = async () => {
      calls++;
      throw new Error("provider must not be called");
    };
    await assert.rejects(
      services.requestRewrite(free.id, rewriteInput(free, { mode: "entry" }), never, never, never),
      code("PLAN_REQUIRED"),
    );
    assert.equal(calls, 0);
  });

  test("Continue writing keeps the written words at the start; anything else is withheld", async () => {
    const a = await account("free");
    const original = a.job[0].text;
    const doc = await getResume(a.id, a.doc.id);
    const changed = await provider.generateRewrite(
      doc,
      a.job[0].id,
      "Finish this bullet.",
      fakeTransport({
        message: "",
        questions: [],
        text: "Designed a workspace for small teams.",
        evidenceIds: [a.job[0].id],
      }).transport,
      { mode: "continue" },
    );
    assert.equal(changed.text, "");
    assert.match(changed.message, /changed the words you had already written/);
    const fake = fakeTransport(
      { message: "", questions: [], text: `${original} with engineering partners.`, evidenceIds: [a.job[0].id, a.job[1].id] },
      { supported: true, reason: "Stated." },
    );
    const finished = await provider.generateRewrite(doc, a.job[0].id, "Finish this bullet.", fake.transport, {
      mode: "continue",
    });
    assert.equal(finished.text, `${original} with engineering partners.`);
    assert.equal(providerInput(fake.sent[0]).mode, "continue");
    assert.equal(keepsStart("Built a", "Built a library"), true);
    assert.equal(keepsStart("Built a", "Built a"), false);
  });

  test("Rewrite selection changes only the selected words", async () => {
    const a = await account("free");
    const doc = await getResume(a.id, a.doc.id);
    const original = a.job[0].text; // "Led the design of a collaborative workspace, ..."
    const start = original.indexOf("collaborative workspace");
    const selection = { start, end: start + "collaborative workspace".length };
    const outside = await provider.generateRewrite(
      doc,
      a.job[0].id,
      "Rewrite the selection.",
      fakeTransport({
        message: "",
        questions: [],
        text: original.replace("Led", "Drove").replace("collaborative workspace", "shared workspace"),
        evidenceIds: [a.job[0].id],
      }).transport,
      { mode: "selection", selection },
    );
    assert.equal(outside.text, "");
    assert.match(outside.message, /outside your selection/);
    const fake = fakeTransport(
      {
        message: "",
        questions: [],
        text: original.replace("collaborative workspace", "shared team workspace"),
        evidenceIds: [a.job[0].id],
      },
      { supported: true, reason: "Stated." },
    );
    const inside = await provider.generateRewrite(doc, a.job[0].id, "Rewrite the selection.", fake.transport, {
      mode: "selection",
      selection,
    });
    assert.equal(inside.text, original.replace("collaborative workspace", "shared team workspace"));
    assert.equal(providerInput(fake.sent[0]).rewriteOnly, "collaborative workspace");
    await assert.rejects(
      services.requestRewrite(
        a.id,
        rewriteInput(a, { mode: "selection", selection: { start: 0, end: 9999 } }),
        async () => {
          throw new Error("provider must not be called");
        },
      ),
      code("AI_CONTEXT"),
    );
    assert.equal(keepsOutsideSelection("abc def", "abc xyz", { start: 4, end: 7 }), true);
    assert.equal(keepsOutsideSelection("abc def", "abz xyz", { start: 4, end: 7 }), false);
  });

  test("Match with AI quotes supported evidence, turns unsupported claims into gaps and drops requirements not in the post", async () => {
    const a = await account("go");
    const [b1, b2] = a.job;
    const fake = fakeTransport(
      {
        requirements: [
          { text: "Lead discovery research with customers", priority: "required", evidenceIds: [b1.id] },
          { text: "Build design systems and component libraries", priority: "required", evidenceIds: [b2.id] },
          { text: "Accessibility audits", priority: "preferred", evidenceIds: [] },
          { text: "Ten years of banking experience", priority: "required", evidenceIds: [] },
        ],
      },
      supported(false, true),
    );
    const result = await services.requestJobMatch(
      a.id,
      {
        requestId: randomUUID(),
        documentId: a.doc.id,
        revision: a.doc.revision,
        job: { title: "Product Designer", company: "Contoso", post: POST },
      },
      (doc, job) => provider.generateJobMatch(doc, job, fake.transport),
    );
    assert.deepEqual(
      result.requirements.map((r) => [r.text, r.status]),
      [
        ["Lead discovery research with customers", "gap"],
        ["Build design systems and component libraries", "shown"],
        ["Accessibility audits", "gap"],
      ],
    );
    assert.equal(result.requirements[1].evidence[0].text, b2.text);
    assert.equal(result.withheld, 1);
    for (const body of fake.sent) assert.doesNotMatch(body, /alex@example\.com|010-2040/);
  });

  test("a gap line becomes a bullet for a named job only when the line supports it", async () => {
    const a = await account("go");
    const entryId = a.job[0].entryId;
    const ask = (payloads: unknown[], line = "I ran accessibility audits on the checkout flow at Northstar") =>
      services.requestGapLine(
        a.id,
        {
          requestId: randomUUID(),
          documentId: a.doc.id,
          revision: a.doc.revision,
          requirement: "Accessibility audits",
          line,
        },
        (doc, input) => provider.generateGapLine(doc, input, fakeTransport(...payloads).transport),
      );
    const placed = await ask([
      { placement: "entry", entryId, text: "Ran accessibility audits on the checkout flow.", message: "" },
      supported(true),
    ]);
    assert.equal(placed.placement, "entry");
    assert.equal(placed.entryLabel, "Senior Product Designer at Northstar Studio");
    const number = await ask([
      { placement: "entry", entryId, text: "Ran 12 accessibility audits on the checkout flow.", message: "" },
    ]);
    assert.equal(number.placement, "none");
    assert.match(number.message, /number that is not in your line/);
    const stronger = await ask([
      { placement: "entry", entryId, text: "Led the accessibility program across the company.", message: "" },
      supported(false),
    ]);
    assert.equal(stronger.placement, "none");
    const skill = await ask([{ placement: "skill", entryId: "", text: "WCAG 2.2", message: "" }]);
    assert.equal(skill.placement, "none");
    const stated = await ask(
      [{ placement: "skill", entryId: "", text: "axe DevTools", message: "" }],
      "I use axe DevTools for accessibility checks",
    );
    assert.deepEqual([stated.placement, stated.text], ["skill", "axe DevTools"]);
    const nowhere = await ask([{ placement: "entry", entryId: "made-up", text: "Ran audits.", message: "" }]);
    assert.equal(nowhere.placement, "none");
  });

  test("Tailor with AI is Pro; rewrites keep same-entry evidence, add no numbers and are checked without the job post", async () => {
    const go = await account("go");
    await assert.rejects(
      services.requestTailoring(
        go.id,
        {
          requestId: randomUUID(),
          documentId: go.doc.id,
          revision: go.doc.revision,
          job: { title: "Product Designer", post: POST },
          requirements: [],
        },
        async () => {
          throw new Error("provider must not be called");
        },
      ),
      code("PLAN_REQUIRED"),
    );
    const a = await account("pro");
    const all = bulletEvidence(a.doc);
    const [b1, b2, b3] = a.job;
    const other = all.find((b) => b.entryId !== b1.entryId)!;
    const fake = fakeTransport(
      {
        summary: { text: "Product designer who builds design systems and leads discovery.", evidenceIds: [b1.id, b2.id] },
        rewrites: [
          { bulletId: b2.id, text: "Built a shared component library and design system with engineering.", evidenceIds: [b2.id] },
          { bulletId: b3.id, text: "Ran customer interviews with 30 users.", evidenceIds: [b3.id] },
          { bulletId: b1.id, text: "Led discovery for a collaborative workspace.", evidenceIds: [b1.id, other.id] },
          { bulletId: b3.id + "-x", text: "Invented bullet.", evidenceIds: [b3.id] },
        ],
      },
      supported(true, false),
    );
    const result = await services.requestTailoring(
      a.id,
      {
        requestId: randomUUID(),
        documentId: a.doc.id,
        revision: a.doc.revision,
        job: { title: "Product Designer", company: "Contoso", post: POST },
        requirements: ["Build design systems and component libraries"],
      },
      (doc, input) => provider.generateTailoring(doc, input, fake.transport),
    );
    assert.equal(result.summary?.text, "Product designer who builds design systems and leads discovery.");
    assert.equal(result.rewrites.length, 0, "the bullet rewrite failed the support check");
    // New number and cross-entry evidence withheld before the check; one unsupported after it.
    assert.equal(result.withheld, 3);
    assert.doesNotMatch(fake.sent[1], /hiring a Product Designer/);
    assert.match(fake.sent[0], /requirementsTheCvShows/);
  });

  test("every Phase C request counts toward the daily limit", async () => {
    const a = await account("free");
    const reply = async () => ({ message: "", questions: [], text: "", evidenceIds: [], context: { selected: a.job[0], sources: a.job } });
    for (let i = 0; i < 5; i++)
      await services.requestRewrite(a.id, rewriteInput(a, { mode: "continue" }), reply as never);
    await assert.rejects(
      services.requestRewrite(a.id, rewriteInput(a, { mode: "continue" }), reply as never),
      code("AI_LIMIT"),
    );
  });
});
