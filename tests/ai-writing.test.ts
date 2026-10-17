import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, newEntry, type ResumeDocument } from "../src/lib/document";
import {
  findBlanks,
  numbersOutsideBlanks,
  redactContact,
  starterCacheKey,
  starterReady,
  type EntryBulletsRequest,
  type StartersRequest,
} from "../src/lib/ai-contract";

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
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(payload) }],
          },
        ],
      }),
    );
  }) as typeof fetch;
  return { transport, sent, remaining: () => payloads.length };
}

const code = (expected: string) => (error: unknown) =>
  (error as { code: string }).code === expected;

describe("Write with AI (entry bullets) and examples for a job title", () => {
  let services: typeof import("../src/lib/server/ai-service");
  let provider: typeof import("../src/lib/server/openai-provider");
  let consent: typeof import("../src/lib/server/ai-consent");
  let plans: typeof import("../src/lib/billing-plans");
  let saveResume: typeof import("../src/lib/server/resumes").saveResume;
  let close: () => void;

  before(async () => {
    process.env.TURSO_DATABASE_URL = "file::memory:";
    process.env.OPENAI_API_KEY = "synthetic-test-key";
    process.env.BETA_GO_TRIAL_DAYS = "0";
    const { database } = await import("../src/lib/server/database");
    ({ saveResume } = await import("../src/lib/server/resumes"));
    services = await import("../src/lib/server/ai-service");
    provider = await import("../src/lib/server/openai-provider");
    consent = await import("../src/lib/server/ai-consent");
    plans = await import("../src/lib/billing-plans");
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

  /** A Free account with AI writing help on, and a CV with one empty job. */
  async function account(withConsent = true) {
    const { database } = await import("../src/lib/server/database");
    const id = `user-${randomUUID()}`;
    await database().client.execute({
      sql: "INSERT INTO user VALUES (?,?,?,1,NULL,0,0)",
      args: [id, "Test", `${id}@example.test`],
    });
    if (withConsent) await consent.setAiConsent(id, true);
    const draft = createDocument();
    draft.contact.email = "sam.private@example.test";
    draft.contact.phone = "+44 7700 900123";
    const jobs = draft.sections.find((s) => s.type === "experience")!;
    const job = newEntry();
    job.organization = "Northwind Help Desk";
    jobs.entries = [job];
    const doc: ResumeDocument = await saveResume(id, draft, null);
    return { id, doc, sectionId: jobs.id, entryId: job.id };
  }

  const entryInput = (
    a: Awaited<ReturnType<typeof account>>,
    notes = "handled customer tickets, trained 3 new staff, used Zendesk",
  ): EntryBulletsRequest => ({
    requestId: randomUUID(),
    documentId: a.doc.id,
    revision: a.doc.revision,
    sectionId: a.sectionId,
    entryId: a.entryId,
    notes,
  });
  const entryWith = (transport: typeof fetch) => (doc: ResumeDocument, input: EntryBulletsRequest) =>
    provider.generateEntryBullets(doc, input, transport);

  test("notes become supported bullets that keep their numbers and cite the notes", async () => {
    const a = await account();
    const fake = fakeTransport(
      {
        message: "Built from your notes.",
        title: "",
        description: { text: "", evidenceIds: [] },
        bullets: [
          { text: "Handled customer tickets using Zendesk.", evidenceIds: ["note-1"] },
          { text: "Trained 3 new staff members.", evidenceIds: ["note-1"] },
        ],
        questions: ["How many tickets did you handle a week?"],
      },
      {
        results: [
          { index: 0, supported: true, reason: "Stated in the notes." },
          { index: 1, supported: true, reason: "Stated in the notes." },
        ],
      },
    );
    const result = await services.requestEntryBullets(
      a.id,
      entryInput(a, "handled customer tickets, trained 3 new staff, used Zendesk\nemail me at sam.private@example.test"),
      entryWith(fake.transport),
    );
    assert.deepEqual(
      result.bullets.map((b) => b.text),
      ["Handled customer tickets using Zendesk.", "Trained 3 new staff members."],
    );
    assert.equal(result.bullets[1].evidence[0], "handled customer tickets, trained 3 new staff, used Zendesk");
    assert.deepEqual(result.withheld, []);
    assert.deepEqual(result.questions, ["How many tickets did you handle a week?"]);
    assert.equal(result.title, "");
    assert.equal(fake.remaining(), 0);
    // Contact details never reach the provider, even when typed into the notes.
    for (const body of fake.sent) {
      assert.doesNotMatch(body, /sam\.private@example\.test/);
      assert.doesNotMatch(body, /7700 900123/);
    }
    assert.match(fake.sent[0], /Northwind Help Desk/);
  });

  test("a bullet with a number the notes do not contain is withheld before the support check", async () => {
    const a = await account();
    const fake = fakeTransport(
      {
        message: "",
        title: "",
        description: { text: "", evidenceIds: [] },
        bullets: [
          { text: "Trained 5 new staff members.", evidenceIds: ["note-1"] },
          { text: "Handled customer tickets.", evidenceIds: ["note-1"] },
        ],
        questions: [],
      },
      { results: [{ index: 0, supported: true, reason: "ok" }] },
    );
    const result = await services.requestEntryBullets(a.id, entryInput(a), entryWith(fake.transport));
    assert.deepEqual(result.bullets.map((b) => b.text), ["Handled customer tickets."]);
    assert.equal(result.withheld.length, 1);
    assert.match(result.withheld[0].reason, /number that is not in your notes/);
    assert.ok(result.questions.length > 0);
    // Only the remaining bullet was sent to the support check.
    assert.doesNotMatch(fake.sent[1], /Trained 5/);
    assert.ok(!JSON.stringify(result).includes("Trained 5"));
  });

  test("a bullet the support check cannot back up is withheld; invented evidence IDs too", async () => {
    const a = await account();
    const fake = fakeTransport(
      {
        message: "",
        title: "",
        description: { text: "", evidenceIds: [] },
        bullets: [
          { text: "Led the customer support team.", evidenceIds: ["note-1"] },
          { text: "Used Zendesk for customer tickets.", evidenceIds: ["note-1"] },
          { text: "Won employee of the month.", evidenceIds: ["note-9"] },
        ],
        questions: [],
      },
      {
        results: [
          { index: 0, supported: false, reason: "Notes say handled, not led." },
          { index: 1, supported: true, reason: "Stated." },
        ],
      },
    );
    const result = await services.requestEntryBullets(a.id, entryInput(a), entryWith(fake.transport));
    assert.deepEqual(result.bullets.map((b) => b.text), ["Used Zendesk for customer tickets."]);
    assert.equal(result.withheld.length, 2);
    assert.ok(result.withheld.some((w) => /more than your notes support/.test(w.reason)));
    assert.ok(result.withheld.some((w) => /notes that do not exist/.test(w.reason)));
  });

  test("a role description from the notes is offered only when it passes the same checks", async () => {
    const a = await account();
    const notes = "Develop features\nFull stack development - react, angular, asp.net\nDatabase maintenance";
    const reply = (description: { text: string; evidenceIds: string[] }) => ({
      message: "",
      title: "",
      description,
      bullets: [
        {
          text: "Developed new application features across the full stack with React, Angular and ASP.NET.",
          evidenceIds: ["note-1", "note-2"],
        },
      ],
      questions: [],
    });
    const good = fakeTransport(
      reply({
        text: "Full-stack developer building features with React, Angular and ASP.NET and maintaining the application databases.",
        evidenceIds: ["note-1", "note-2", "note-3"],
      }),
      { results: [0, 1].map((index) => ({ index, supported: true, reason: "Stated." })) },
    );
    const kept = await services.requestEntryBullets(a.id, entryInput(a, notes), entryWith(good.transport));
    assert.match(kept.description, /React, Angular and ASP\.NET/);
    assert.equal(kept.bullets.length, 1);
    // The description is checked in the same support call as the bullets.
    assert.match(good.sent[1], /role description/);

    const numbers = await services.requestEntryBullets(
      a.id,
      entryInput(a, notes),
      entryWith(
        fakeTransport(
          reply({ text: "Led a team of 6 full-stack developers.", evidenceIds: ["note-2"] }),
          { results: [{ index: 0, supported: true, reason: "Stated." }] },
        ).transport,
      ),
    );
    assert.equal(numbers.description, "");
    assert.ok(numbers.withheld.some((w) => /role description went beyond your notes/.test(w.reason)));

    const unsupported = await services.requestEntryBullets(
      a.id,
      entryInput(a, notes),
      entryWith(
        fakeTransport(
          reply({ text: "Owned the architecture of the whole platform.", evidenceIds: ["note-2"] }),
          { results: [{ index: 0, supported: true, reason: "Stated." }, { index: 1, supported: false, reason: "Not stated." }] },
        ).transport,
      ),
    );
    assert.equal(unsupported.description, "");
    assert.equal(unsupported.bullets.length, 1);
  });

  test("a title is offered only when the notes state it", async () => {
    const a = await account();
    const reply = (title: string) => ({
      message: "",
      title,
      description: { text: "", evidenceIds: [] },
      bullets: [],
      questions: ["What did you do most days?"],
    });
    const stated = await services.requestEntryBullets(
      a.id,
      entryInput(a, "Support Agent at the help desk\nhandled tickets"),
      entryWith(fakeTransport(reply("Support Agent")).transport),
    );
    assert.equal(stated.title, "Support Agent");
    const invented = await services.requestEntryBullets(
      a.id,
      entryInput(a, "handled tickets"),
      entryWith(fakeTransport(reply("Senior Support Manager")).transport),
    );
    assert.equal(invented.title, "");
  });

  test("plan, consent and revision are checked before any provider call", async () => {
    const a = await account();
    let calls = 0;
    const never = async () => {
      calls++;
      throw new Error("provider must not be called");
    };
    plans.PLANS.free.aiEntryBullets = false;
    plans.PLANS.free.aiStarters = false;
    try {
      await assert.rejects(services.requestEntryBullets(a.id, entryInput(a), never), code("PLAN_REQUIRED"));
      await assert.rejects(
        services.requestStarters(a.id, { requestId: randomUUID(), jobTitle: "Nurse", section: "experience" }, never),
        code("PLAN_REQUIRED"),
      );
    } finally {
      plans.PLANS.free.aiEntryBullets = true;
      plans.PLANS.free.aiStarters = true;
    }
    const noConsent = await account(false);
    await assert.rejects(
      services.requestEntryBullets(noConsent.id, entryInput(noConsent), never),
      code("AI_CONSENT_REQUIRED"),
    );
    await assert.rejects(
      services.requestStarters(
        noConsent.id,
        { requestId: randomUUID(), jobTitle: "Nurse", section: "experience" },
        never,
      ),
      code("AI_CONSENT_REQUIRED"),
    );
    // Turning AI writing help off again refuses requests.
    await consent.setAiConsent(a.id, false);
    await assert.rejects(services.requestEntryBullets(a.id, entryInput(a), never), code("AI_CONSENT_REQUIRED"));
    await consent.setAiConsent(a.id, true);
    await assert.rejects(
      services.requestEntryBullets(a.id, { ...entryInput(a), revision: a.doc.revision + 1 }, never),
      code("AI_STALE"),
    );
    await assert.rejects(
      services.requestEntryBullets(a.id, { ...entryInput(a), sectionId: "missing" }, never),
      code("AI_CONTEXT"),
    );
    assert.equal(calls, 0);
  });

  test("examples for a job title have blanks, drop stated numbers, and are cached per title and seniority", async () => {
    const a = await account();
    const fake = fakeTransport({
      bullets: [
        "Resolved [number] customer tickets a week using [tool].",
        "Resolved 40 customer tickets a week using [tool].",
        "Helped customers with their questions.",
        "Trained [number] new team members on [process].",
      ],
      summary: "Support agent with [years] years of experience in [industry].",
      skills: ["Customer service", "Ticketing systems", "Customer service"],
    });
    const ask = (input: Partial<StartersRequest> = {}) =>
      services.requestStarters(
        a.id,
        { requestId: randomUUID(), jobTitle: "Customer Support Agent", section: "experience", ...input },
        (request) => provider.generateStarters(request, fake.transport),
      );
    const first = await ask();
    assert.equal(first.cached, false);
    assert.deepEqual(first.bullets, [
      "Resolved [number] customer tickets a week using [tool].",
      "Trained [number] new team members on [process].",
    ]);
    assert.equal(first.summary, "Support agent with [years] years of experience in [industry].");
    assert.deepEqual(first.skills, ["Customer service", "Ticketing systems"]);
    assert.match(fake.sent[0], /Customer Support Agent/);
    // Same title, any spelling: served from the cache, no provider call.
    const again = await ask({ jobTitle: "customer  support agent" });
    assert.equal(again.cached, true);
    assert.deepEqual(again.bullets, first.bullets);
    assert.equal(fake.sent.length, 1);
    // A different seniority is a separate entry.
    await assert.rejects(ask({ seniority: "senior" }), code("AI_UNAVAILABLE"));
    assert.equal(fake.sent.length, 2);
  });

  test("an example cannot be accepted while it has blanks", () => {
    assert.equal(starterReady("Resolved [number] tickets a week using [tool]."), false);
    assert.deepEqual(findBlanks("Resolved [number] tickets using [tool]."), ["[number]", "[tool]"]);
    assert.equal(starterReady("Resolved 30 tickets a week using [tool]."), false);
    assert.equal(starterReady("Resolved tickets using Zendesk ]"), false);
    assert.equal(starterReady("Resolved 30 tickets a week using Zendesk."), true);
    assert.equal(starterReady("   "), false);
    assert.equal(numbersOutsideBlanks("Cut wait times by [result]."), false);
    assert.equal(numbersOutsideBlanks("Cut wait times by 20%."), true);
    assert.equal(starterCacheKey("Customer  Support-Agent", "mid"), starterCacheKey("customer support agent", "mid"));
    const doc = createDocument();
    doc.contact.email = "me@site.test";
    assert.equal(redactContact("write to me@site.test or call 020 7946 0958", doc), "write to [contact removed] or call [contact removed]");
    assert.equal(redactContact("trained 3 new staff in 2024", doc), "trained 3 new staff in 2024");
  });

  test("every request counts toward the plan's daily limit, cached examples included", async () => {
    const a = await account();
    const examples = async () => ({ bullets: ["Answered [number] calls a day."], summary: "", skills: [] });
    const bullets = async () => ({
      message: "",
      title: "",
      description: "",
      bullets: [],
      withheld: [],
      questions: ["What did you do?"],
      sources: [],
    });
    await services.requestStarters(a.id, { requestId: randomUUID(), jobTitle: "Receptionist", section: "experience" }, examples);
    await services.requestStarters(a.id, { requestId: randomUUID(), jobTitle: "Receptionist", section: "experience" }, examples);
    await services.requestEntryBullets(a.id, entryInput(a), bullets);
    await services.requestEntryBullets(a.id, entryInput(a), bullets);
    await services.requestEntryBullets(a.id, entryInput(a), bullets);
    await assert.rejects(services.requestEntryBullets(a.id, entryInput(a), bullets), code("AI_LIMIT"));
    await assert.rejects(
      services.requestStarters(a.id, { requestId: randomUUID(), jobTitle: "Receptionist", section: "experience" }, examples),
      code("AI_LIMIT"),
    );
  });
});
