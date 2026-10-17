import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createDocument } from "../src/lib/document";

test("a CV with only a headline and job titles gets a plain reason and spends no AI request", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  process.env.BETA_GO_TRIAL_DAYS = "0";
  const { database } = await import("../src/lib/server/database");
  const { saveResume } = await import("../src/lib/server/resumes");
  const { requestSummaryDraft, THIN_CV_MESSAGE } = await import("../src/lib/server/ai-service");
  const { upsertSubscription } = await import("../src/lib/server/entitlements");
  const { client } = database();
  try {
    for (const name of (await readdir("migrations")).filter((n) => n.endsWith(".sql")).sort())
      await client.executeMultiple(await readFile(`migrations/${name}`, "utf8"));
    await client.execute("INSERT INTO user VALUES ('thin','Thin','thin@example.test',1,NULL,0,0)");
    await upsertSubscription({
      userId: "thin",
      stripeCustomerId: "cus_thin",
      planId: "go",
      status: "active",
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
    });
    const thin = createDocument();
    thin.contact.headline = "Senior Software Engineer";
    thin.sections.find((s) => s.type === "experience")!.entries.push({
      id: "job",
      title: "Senior Software Engineer",
      organization: "Contoso",
      location: "",
      start: "2022-11",
      end: "",
      current: true,
      description: "",
      bullets: [],
    });
    const doc = await saveResume("thin", thin, null);
    let calls = 0;
    const result = await requestSummaryDraft(
      "thin",
      { requestId: randomUUID(), documentId: doc.id, revision: doc.revision, consent: true },
      async () => {
        calls++;
        return { text: "x", message: "" };
      },
    );
    assert.equal(result.text, "");
    assert.equal(result.message, THIN_CV_MESSAGE);
    assert.equal(calls, 0);
    const used = (await client.execute("SELECT count(*) AS n FROM ai_owner_usage WHERE owner_id='thin'")).rows[0];
    assert.equal(Number(used.n), 0);
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.BETA_GO_TRIAL_DAYS;
  }
});
