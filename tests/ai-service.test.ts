import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createDocument } from "../src/lib/document";
import { rewriteContext } from "../src/lib/ai-contract";

test("AI persistence enforces ownership, retry receipts, revision checks, quotas and cascading deletion", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  const { database } = await import("../src/lib/server/database");
  const { saveResume, getResume, removeResume } =
    await import("../src/lib/server/resumes");
  const { requestRewrite, decideProposal } =
    await import("../src/lib/server/ai-service");
  const { client } = database();
  try {
    for (const name of [
      "001-foundation.sql",
      "002-ai-proposals.sql",
      "003-ai-evidence.sql",
      "004-subscriptions.sql",
    ])
      await client.executeMultiple(
        await readFile(`migrations/${name}`, "utf8"),
      );
    await client.execute(
      "INSERT INTO user VALUES ('alice','Alice','alice@example.test',0,NULL,0,0), ('bob','Bob','bob@example.test',0,NULL,0,0)",
    );
    // Pro, so these checks are not limited by Free's 5 AI requests a day.
    await client.execute(
      "INSERT INTO subscriptions VALUES ('sub_alice','alice','cus_alice',NULL,'pro','active',NULL,0,'2026-01-01','2026-01-01'), ('sub_bob','bob','cus_bob',NULL,'pro','active',NULL,0,'2026-01-01','2026-01-01')",
    );
    const doc = await saveResume("alice", createDocument(true), null);
    const bullet = doc.sections
      .flatMap((s) => s.entries)
      .flatMap((e) => e.bullets)[0];
    const input = {
      requestId: randomUUID(),
      documentId: doc.id,
      revision: doc.revision,
      bulletId: bullet.id,
      instruction: "Shorten this bullet",
      consent: true as const,
    };
    let calls = 0;
    const generator = async () => {
      calls++;
      return {
        text: "Worked with the design team.",
        evidenceIds: [bullet.id],
        message: "Review",
        questions: [],
        context: rewriteContext(doc, bullet.id),
      };
    };
    await assert.rejects(requestRewrite("bob", input, generator));
    assert.equal(calls, 0);
    const proposal = await requestRewrite("alice", input, generator);
    const legacyHash = createHash("sha256")
      .update(
        JSON.stringify([
          input.documentId,
          input.revision,
          input.bulletId,
          input.instruction,
        ]),
      )
      .digest("hex");
    assert.equal(
      (
        await client.execute({
          sql: "SELECT request_hash FROM ai_requests WHERE id=?",
          args: [input.requestId],
        })
      ).rows[0].request_hash,
      legacyHash,
    );
    assert.deepEqual(await requestRewrite("alice", input, generator), proposal);
    assert.equal(calls, 1);
    await assert.rejects(
      requestRewrite(
        "alice",
        { ...input, instruction: "Different request" },
        generator,
      ),
    );
    await assert.rejects(decideProposal("bob", proposal.id, "accept"));
    const accepted = await decideProposal("alice", proposal.id, "accept");
    assert.equal(accepted.document?.revision, 1);
    const retried = await decideProposal("alice", proposal.id, "accept");
    assert.equal(retried.alreadyApplied, true);
    assert.equal(retried.document?.revision, 1);
    const edited = await saveResume(
      "alice",
      { ...accepted.document!, name: "Edited later" },
      1,
    );
    await assert.rejects(decideProposal("alice", proposal.id, "accept"));
    const second = await requestRewrite(
      "alice",
      { ...input, requestId: randomUUID(), revision: edited.revision },
      async () => ({
        ...(await generator()),
        context: rewriteContext(edited, bullet.id),
      }),
    );
    await saveResume("alice", edited, edited.revision);
    await assert.rejects(decideProposal("alice", second.id, "accept"));
    const latest = await getResume("alice", doc.id);
    const failed = {
      ...input,
      requestId: randomUUID(),
      revision: latest.revision,
    };
    await assert.rejects(
      requestRewrite("alice", failed, async () => {
        throw new Error("controlled timeout");
      }),
    );
    assert.equal((await getResume("alice", doc.id)).revision, latest.revision);
    assert.equal(
      (
        await client.execute({
          sql: "SELECT status FROM ai_requests WHERE id=?",
          args: [failed.requestId],
        })
      ).rows[0].status,
      "failed",
    );
    process.env.AI_DAILY_USER_LIMIT = "3";
    await assert.rejects(
      requestRewrite(
        "alice",
        { ...failed, requestId: randomUUID() },
        generator,
      ),
      /used today.s 3 AI requests/,
    );
    await removeResume("alice", doc.id, latest.revision);
    assert.equal(
      (await client.execute("SELECT * FROM ai_requests")).rows.length,
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count FROM ai_owner_usage WHERE owner_id='alice'",
          )
        ).rows[0].count,
      ),
      3,
    );
    await client.execute("DELETE FROM user WHERE id='alice'");
    assert.equal(
      (await client.execute("SELECT * FROM ai_owner_usage")).rows.length,
      0,
    );
    assert.equal(
      Number(
        (await client.execute("SELECT count FROM ai_global_usage")).rows[0]
          .count,
      ),
      3,
    );
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_DAILY_USER_LIMIT;
  }
});
