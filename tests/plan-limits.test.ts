import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument } from "../src/lib/document";
import { rewriteContext } from "../src/lib/ai-contract";

test("plans decide AI summary drafts and daily AI requests", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  process.env.BETA_GO_TRIAL_DAYS = "0";
  const { database } = await import("../src/lib/server/database");
  const { saveResume } = await import("../src/lib/server/resumes");
  const { requestRewrite, requestSummaryDraft } = await import(
    "../src/lib/server/ai-service"
  );
  const { upsertSubscription } = await import("../src/lib/server/entitlements");
  const { client } = database();
  try {
    for (const name of (await readdir("migrations")).filter((n) => n.endsWith(".sql")).sort())
      await client.executeMultiple(await readFile(`migrations/${name}`, "utf8"));
    await client.execute(
      "INSERT INTO user VALUES ('free','Free','free@example.test',1,NULL,0,0), ('go','Go','go@example.test',1,NULL,0,0)",
    );
    await upsertSubscription({
      userId: "go",
      stripeCustomerId: "cus_go",
      planId: "go",
      status: "active",
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
    });
    const summary = async () => ({ text: "Product designer with research experience.", message: "" });

    // Free: no AI summary drafts, and the generator is never called.
    const freeDoc = await saveResume("free", createDocument(true), null);
    let calls = 0;
    await assert.rejects(
      requestSummaryDraft(
        "free",
        { requestId: randomUUID(), documentId: freeDoc.id, revision: freeDoc.revision, consent: true },
        async () => {
          calls++;
          return summary();
        },
      ),
      (error) => (error as { code: string }).code === "PLAN_REQUIRED",
    );
    assert.equal(calls, 0);

    // Go: the draft comes back for review; nothing is saved.
    const goDoc = await saveResume("go", createDocument(true), null);
    const draft = await requestSummaryDraft(
      "go",
      { requestId: randomUUID(), documentId: goDoc.id, revision: goDoc.revision, consent: true },
      summary,
    );
    assert.equal(draft.text, "Product designer with research experience.");

    // Free: 5 AI rewrites a day.
    const bullet = freeDoc.sections.flatMap((s) => s.entries).flatMap((e) => e.bullets)[0];
    const rewrite = async () => ({
      text: "Worked with the design team.",
      evidenceIds: [bullet.id],
      message: "Review",
      questions: [],
      context: rewriteContext(freeDoc, bullet.id),
    });
    const ask = () =>
      requestRewrite(
        "free",
        {
          requestId: randomUUID(),
          documentId: freeDoc.id,
          revision: freeDoc.revision,
          bulletId: bullet.id,
          instruction: "Shorten this bullet",
          consent: true,
        },
        rewrite,
      );
    for (let i = 0; i < 5; i++) await ask();
    await assert.rejects(ask(), (error) => (error as { code: string }).code === "AI_LIMIT");

  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.BETA_GO_TRIAL_DAYS;
  }
});

test("an AI summary that adds a number not in the CV is withheld", async () => {
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  const { generateSummary } = await import("../src/lib/server/openai-provider");
  const doc = createDocument(true);
  const respond = (payload: unknown) =>
    new Response(
      JSON.stringify({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(payload) }] }],
      }),
    );
  const result = await generateSummary(doc, (async () =>
    respond({ message: "", text: "Designer who grew revenue by 912%.", evidenceIds: ["headline"] })) as typeof fetch);
  assert.equal(result.text, "");
  assert.match(result.message, /number that is not in your CV/);
  delete process.env.OPENAI_API_KEY;
});
