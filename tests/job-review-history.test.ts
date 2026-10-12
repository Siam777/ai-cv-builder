import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createDocument, newEntry } from "../src/lib/document";
import { reviewJobEvidence } from "../src/lib/vault/job-evidence";
import {
  reviewSaveInput,
  saveJobReviewSchema,
  REVIEW_HISTORY_LIMIT,
  REVIEW_ACCOUNT_LIMIT,
} from "../src/lib/job-review-history";
const target = {
  role: "Product Designer",
  company: "Synthetic",
  seniority: "Senior",
  language: "english" as const,
};

test("job history validates consent and rejects submitted scores/duplicate priority references", async () => {
  const review = await reviewJobEvidence(
    createDocument(true),
    "Required: Figma",
    target,
  );
  const input = reviewSaveInput(review, crypto.randomUUID());
  assert.equal(
    saveJobReviewSchema.safeParse({ ...input, consent: false }).success,
    false,
  );
  assert.equal(
    saveJobReviewSchema.safeParse({ ...input, matches: [], groups: {} })
      .success,
    false,
  );
  assert.equal(
    saveJobReviewSchema.safeParse({
      ...input,
      priorityOverrides: [
        { id: "a", priority: "preferred" },
        { id: "a", priority: "required" },
      ],
    }).success,
    false,
  );
  assert.equal(
    saveJobReviewSchema.safeParse({ ...input, jobText: "x".repeat(20001) })
      .success,
    false,
  );
});

test("history transactions preserve server evidence, immutable retries, ownership, stale versions, quotas and cascading deletion", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { database } = await import("../src/lib/server/database");
  const { saveResume, removeResume } =
    await import("../src/lib/server/resumes");
  const {
    saveJobReview,
    listJobReviews,
    getJobReview,
    deleteJobReview,
    exportJobReviews,
  } = await import("../src/lib/server/job-review-history");
  const { client } = database();
  try {
    await client.execute("PRAGMA foreign_keys=ON");
    for (const name of (await readdir("migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await client.executeMultiple(
        await readFile(`migrations/${name}`, "utf8"),
      );
    for (const owner of ["first", "second"])
      await client.execute({
        sql: "INSERT INTO user VALUES (?,?,?,1,NULL,0,0)",
        args: [owner, owner, `${owner}@example.test`],
      });
    let doc = await saveResume("first", createDocument(true), null);
    const original = structuredClone(doc);
    const posting =
      "Requirements:\nExperience with prototyping\nFigma\n5 years of Figma";
    const review = await reviewJobEvidence(doc, posting, target);
    review.matches[0].criterion.priority = "preferred";
    review.matches[0].criterion.priorityOrigin = "candidate_review";
    const input = reviewSaveInput(review, crypto.randomUUID());
    const saved = await saveJobReview("first", input);
    assert.equal(saved.matches[0].criterion.priority, "preferred");
    assert.equal(saved.matches[0].status, "direct");
    assert.equal(saved.matches[2].status, "unknown");
    assert.equal(saved.groups.preferred.direct, 1);
    assert.equal("sourceSnapshot" in saved, false);
    assert.equal(JSON.stringify(saved).includes(doc.contact.email), false);
    assert.deepEqual(await saveJobReview("first", input), saved);
    assert.equal((await listJobReviews("first", doc.id)).length, 1);
    await assert.rejects(
      () =>
        saveJobReview("first", {
          ...input,
          target: { ...target, role: "Different" },
        }),
      (error) => (error as { code: string }).code === "REVIEW_REQUEST_CHANGED",
    );
    for (const operation of [
      () => listJobReviews("second", doc.id),
      () => getJobReview("second", doc.id, saved.id),
      () => deleteJobReview("second", doc.id, saved.id),
      () =>
        saveJobReview("second", { ...input, requestId: crypto.randomUUID() }),
    ])
      await assert.rejects(
        operation,
        (error) => (error as { status: number }).status === 404,
      );
    await assert.rejects(
      () =>
        saveJobReview("first", {
          ...input,
          requestId: crypto.randomUUID(),
          priorityOverrides: [{ id: "invented", priority: "required" }],
        }),
      (error) => (error as { code: string }).code === "REVIEW_PRIORITY",
    );
    assert.equal((await getJobReview("first", doc.id, saved.id)).stale, false);
    // A retained report from an earlier rule release is stale even with an unchanged CV.
    await client.execute({
      sql: "UPDATE job_reviews SET report=? WHERE owner_id=? AND id=?",
      args: [
        JSON.stringify({ ...saved, version: "previous-rules" }),
        "first",
        saved.id,
      ],
    });
    assert.equal((await getJobReview("first", doc.id, saved.id)).stale, true);
    assert.equal((await listJobReviews("first", doc.id))[0].stale, true);
    await client.execute({
      sql: "UPDATE job_reviews SET report=? WHERE owner_id=? AND id=?",
      args: [JSON.stringify(saved), "first", saved.id],
    });
    doc = await saveResume(
      "first",
      { ...doc, contact: { ...doc.contact, name: "Changed name" } },
      doc.revision,
    );
    assert.equal((await getJobReview("first", doc.id, saved.id)).stale, true);
    assert.deepEqual(await saveJobReview("first", input), saved); // Lost-response retry remains immutable after later CV edits.
    await assert.rejects(
      () =>
        saveJobReview("first", { ...input, requestId: crypto.randomUUID() }),
      (error) => (error as { code: string }).code === "REVIEW_STALE",
    );
    const fresh = reviewSaveInput(
      await reviewJobEvidence(doc, posting, target),
      crypto.randomUUID(),
    );
    await assert.rejects(
      () => saveJobReview("first", { ...fresh, rulesVersion: "old" }),
      (error) => (error as { code: string }).code === "REVIEW_RULES_CHANGED",
    );
    await assert.rejects(
      () => saveJobReview("first", { ...fresh, jobHash: "0".repeat(64) }),
      (error) => (error as { code: string }).code === "REVIEW_JOB_CHANGED",
    );
    for (let i = 1; i < REVIEW_HISTORY_LIMIT; i++)
      await saveJobReview("first", {
        ...fresh,
        requestId: crypto.randomUUID(),
      });
    await assert.rejects(
      () =>
        saveJobReview("first", { ...fresh, requestId: crypto.randomUUID() }),
      (error) => (error as { code: string }).code === "REVIEW_HISTORY_FULL",
    );
    assert.equal((await exportJobReviews("first")).length, 20);
    assert.equal((await exportJobReviews("second")).length, 0);
    await deleteJobReview("first", doc.id, saved.id);
    await deleteJobReview("first", doc.id, saved.id); // Lost deletion response can be retried.
    assert.equal((await listJobReviews("first", doc.id)).length, 19);
    await removeResume("first", doc.id, doc.revision);
    assert.equal((await exportJobReviews("first")).length, 0);

    const large = createDocument();
    large.sections.find((section) => section.type === "experience")!.entries = [
      {
        ...newEntry(),
        description: "Built AWS services " + "reliably ".repeat(2100),
      },
    ];
    const largeDoc = await saveResume("first", large, null);
    const largePosting = Array.from(
      { length: 30 },
      (_, index) =>
        `Required: AWS workflow ${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`,
    ).join("\n");
    const largeInput = reviewSaveInput(
      await reviewJobEvidence(largeDoc, largePosting, target),
      crypto.randomUUID(),
    );
    await assert.rejects(
      () => saveJobReview("first", largeInput),
      (error) => (error as { code: string }).code === "REVIEW_TOO_LARGE",
    );
    assert.equal((await listJobReviews("first", largeDoc.id)).length, 0);
    await removeResume("first", largeDoc.id, largeDoc.revision);

    for (
      let index = 0;
      index < REVIEW_ACCOUNT_LIMIT / REVIEW_HISTORY_LIMIT;
      index++
    ) {
      const quotaDoc = await saveResume("first", createDocument(true), null);
      const quotaInput = reviewSaveInput(
        await reviewJobEvidence(quotaDoc, "Required: Figma", target),
        crypto.randomUUID(),
      );
      for (let report = 0; report < REVIEW_HISTORY_LIMIT; report++)
        await saveJobReview("first", {
          ...quotaInput,
          requestId: crypto.randomUUID(),
        });
    }
    const next = await saveResume("first", original, null);
    const nextInput = reviewSaveInput(
      await reviewJobEvidence(next, posting, target),
      crypto.randomUUID(),
    );
    await assert.rejects(
      () => saveJobReview("first", nextInput),
      (error) => (error as { code: string }).code === "REVIEW_HISTORY_FULL",
    );
    assert.equal(
      (await exportJobReviews("first")).length,
      REVIEW_ACCOUNT_LIMIT,
    );
    await client.execute("DELETE FROM user WHERE id='first'");
    assert.equal(
      (await client.execute("SELECT count(*) AS n FROM job_reviews")).rows[0].n,
      0,
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
  }
});
