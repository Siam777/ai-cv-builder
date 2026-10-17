import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument, newEntry, type ResumeDocument } from "../src/lib/document";
import { bulletEvidence } from "../src/lib/ai-proposals";
import { applyTidy, sameWords, statedDate, validateTidy } from "../src/lib/import-tidy";

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
  results: flags.map((ok, index) => ({ index, supported: ok, reason: ok ? "Stated." : "Not stated." })),
});
const code = (expected: string) => (error: unknown) => (error as { code: string }).code === expected;

/** A messy import: a degree under Experience, a run-on bullet, dates only in the text. */
function messyImport() {
  const doc = createDocument();
  const jobs = doc.sections.find((s) => s.type === "experience")!;
  const job = newEntry();
  job.title = "Support Agent";
  job.organization = "Northwind";
  job.description = "March 2021 - Present";
  job.bullets = [
    { id: "run-on", text: "Answered customer emails in Zendesk and trained new staff on the ticket queue and wrote the help centre articles" },
  ];
  const degree = newEntry();
  degree.title = "BSc Business";
  degree.organization = "University of Leeds";
  degree.description = "2016 - 2019";
  jobs.entries = [job, degree];
  return { doc, job, degree };
}

describe("Phase D: AI cover letter and Tidy with AI", () => {
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
  const letterInput = (a: Awaited<ReturnType<typeof account>>) => ({
    requestId: randomUUID(),
    documentId: a.doc.id,
    revision: a.doc.revision,
    job: { title: "Product Designer", company: "Contoso", post: "Required: design systems. Preferred: 5 years of fintech." },
    note: "I use Contoso's planning app every week. Email me at alex@example.com.",
  });

  test("a cover letter keeps paragraphs that cite evidence and pass the check; contact details are never sent", async () => {
    const a = await account("go");
    const [b1, b2] = a.bullets;
    const fake = fakeTransport(
      {
        message: "",
        paragraphs: [
          { text: "I am applying for the Product Designer role at Contoso, whose planning app I use every week.", evidenceIds: ["note"] },
          { text: "At Northstar Studio I built a shared component library with engineering.", evidenceIds: [b2.id] },
          { text: "I also led the design of a collaborative workspace from discovery through launch.", evidenceIds: [b1.id] },
          { text: "Thank you for considering my application.", evidenceIds: [] },
        ],
      },
      supported(true, true, true, true),
    );
    const result = await services.requestCoverLetter(a.id, letterInput(a), (doc, input) =>
      provider.generateCoverLetterDraft(doc, input, fake.transport),
    );
    assert.equal(result.paragraphs.length, 4);
    assert.equal(result.withheld, 0);
    for (const body of fake.sent) assert.doesNotMatch(body, /alex@example\.com|010-2040/);
    assert.match(fake.sent[0], /planning app/);
  });

  test("a paragraph with a new number, an invented citation or an unsupported claim is withheld; under two left withholds the letter", async () => {
    const a = await account("go");
    const [b1, b2] = a.bullets;
    const partly = fakeTransport(
      {
        message: "",
        paragraphs: [
          { text: "I bring 5 years of fintech design experience.", evidenceIds: [b1.id] },
          { text: "I hold a PhD in design.", evidenceIds: ["not-in-cv"] },
          { text: "I built a shared component library with engineering.", evidenceIds: [b2.id] },
          { text: "I led the design of a collaborative workspace.", evidenceIds: [b1.id] },
        ],
      },
      supported(true, true),
    );
    const kept = await provider.generateCoverLetterDraft(a.doc, letterInput(a), partly.transport);
    assert.equal(kept.paragraphs.length, 2);
    assert.equal(kept.withheld, 2);
    assert.ok(!kept.paragraphs.join(" ").includes("PhD"));
    const thin = fakeTransport(
      {
        message: "",
        paragraphs: [
          { text: "I managed the whole design department.", evidenceIds: [b1.id] },
          { text: "I built a shared component library with engineering.", evidenceIds: [b2.id] },
        ],
      },
      supported(false, true),
    );
    const none = await provider.generateCoverLetterDraft(a.doc, letterInput(a), thin.transport);
    assert.deepEqual(none.paragraphs, []);
    assert.match(none.message, /said more than your CV supports/);
  });

  test("AI cover letters are Go and Pro; consent is checked before any provider call", async () => {
    let calls = 0;
    const never = async () => {
      calls++;
      throw new Error("provider must not be called");
    };
    const free = await account("free");
    await assert.rejects(services.requestCoverLetter(free.id, letterInput(free), never), code("PLAN_REQUIRED"));
    const go = await account("go", false);
    await assert.rejects(services.requestCoverLetter(go.id, letterInput(go), never), code("AI_CONSENT_REQUIRED"));
    const doc = messyImport().doc;
    await assert.rejects(
      services.requestImportTidy(free.id, { requestId: randomUUID(), document: doc }, never),
      code("PLAN_REQUIRED"),
    );
    await assert.rejects(
      services.requestImportTidy(go.id, { requestId: randomUUID(), document: doc }, never),
      code("AI_CONSENT_REQUIRED"),
    );
    assert.equal(calls, 0);
  });

  test("Tidy with AI keeps only moves to real sections, same-word splits and dates stated in the entry", () => {
    const { doc, job, degree } = messyImport();
    const original = doc.sections.find((s) => s.type === "experience")!.entries[0].bullets[0].text;
    const { ops, dropped } = validateTidy(doc, {
      moves: [
        { entryId: degree.id, toType: "education" },
        { entryId: job.id, toType: "experience" },
        { entryId: "missing", toType: "skills" },
      ],
      splits: [
        {
          bulletId: "run-on",
          parts: [
            "Answered customer emails in Zendesk",
            "and trained new staff on the ticket queue",
            "and wrote the help centre articles",
          ],
        },
        { bulletId: "run-on", parts: ["Answered customer emails", "Led the support team"] },
      ],
      dates: [
        { entryId: job.id, start: "2021-03", end: "", current: true },
        { entryId: degree.id, start: "2016-09", end: "2019", current: false },
        { entryId: degree.id, start: "2010", end: "2012", current: false },
      ],
    });
    assert.deepEqual(
      ops.map((op) => op.type),
      ["move", "split", "dates", "dates"],
    );
    // Same entry twice, a move to its own section, an unknown entry and a split that changes words.
    assert.equal(dropped, 4);
    const degreeDates = ops.find((op) => op.type === "dates" && op.entryId === degree.id);
    assert.deepEqual(degreeDates, { type: "dates", entryId: degree.id, start: "2016", end: "2019", current: false });
    const { document, changes } = applyTidy(doc, ops);
    assert.equal(document.sections.find((s) => s.type === "education")!.entries[0].title, "BSc Business");
    const bullets = document.sections.find((s) => s.type === "experience")!.entries[0].bullets;
    assert.equal(bullets.length, 3);
    assert.ok(sameWords(original, bullets.map((b) => b.text).join(" ")));
    const tidied = document.sections.find((s) => s.type === "experience")!.entries[0];
    assert.deepEqual([tidied.start, tidied.end, tidied.current], ["2021-03", "", true]);
    assert.equal(changes.length, 4);
    assert.match(changes[0], /Moved “BSc Business at University of Leeds” from Experience to Education/);
  });

  test("statedDate and sameWords", () => {
    assert.equal(statedDate("2021-03", "March 2021 - Present"), "2021-03");
    assert.equal(statedDate("2021-03", "03/2021 to now"), "2021-03");
    assert.equal(statedDate("2021-04", "March 2021"), "2021");
    assert.equal(statedDate("2020", "March 2021"), "");
    assert.equal(statedDate("21-03", "March 2021"), "");
    assert.equal(sameWords("Built X, and Y.", "Built X and Y"), true);
    assert.equal(sameWords("Built X and Y", "Built X and Z"), false);
  });

  test("the tidy request sends no contact details and returns checked operations", async () => {
    const a = await account("go");
    const { doc, degree } = messyImport();
    doc.contact.email = "sam@example.test";
    doc.sections.find((s) => s.type === "experience")!.entries[0].bullets.push({
      id: "contact-line",
      text: "Reach me at sam@example.test for references",
    });
    const fake = fakeTransport({
      moves: [{ entryId: degree.id, toType: "education" }],
      splits: [],
      dates: [{ entryId: degree.id, start: "1999", end: "", current: false }],
    });
    const result = await services.requestImportTidy(a.id, { requestId: randomUUID(), document: doc }, (document) =>
      provider.generateImportTidy(document, fake.transport),
    );
    assert.deepEqual(result.ops, [{ type: "move", entryId: degree.id, toType: "education" }]);
    assert.equal(result.dropped, 1);
    assert.doesNotMatch(fake.sent[0], /sam@example\.test/);
  });
});
