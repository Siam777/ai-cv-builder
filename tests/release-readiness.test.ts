import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument, parseBackup } from "../src/lib/document";
import { checkRateLimit, resetRateLimits } from "../src/lib/server/rate-limiter";
import {
  logOperation,
  getLogBuffer,
  clearLogBuffer,
} from "../src/lib/server/logger";

test("Release Readiness: rate limits, operational logging, cascading data retention and backup validation", async () => {
  // 1. RATE LIMITS
  resetRateLimits();
  const bucket = "test_limiter";
  const userKey = "user_123";
  const config = { windowMs: 1000, maxRequests: 3 };

  // First 3 calls should pass
  checkRateLimit(bucket, userKey, config);
  checkRateLimit(bucket, userKey, config);
  checkRateLimit(bucket, userKey, config);

  // 4th call should throw HTTP 429
  assert.throws(
    () => checkRateLimit(bucket, userKey, config),
    (err: any) => err.status === 429 && err.code === "RATE_LIMIT_EXCEEDED",
  );

  // Different user key should succeed
  checkRateLimit(bucket, "user_456", config);

  // 2. OPERATIONAL LOGGING & TELEMETRY
  clearLogBuffer();

  // Log an operational event with potential PII fields in metadata
  logOperation({
    level: "info",
    event: "export_pdf_completed",
    ownerId: "user_789",
    documentId: "doc_abc",
    durationMs: 120,
    statusCode: 200,
    metadata: {
      pageSize: "A4",
      watermarked: true,
      // Attempt to include PII that MUST be stripped
      rawText: "Secret candidate resume bullet about banking",
      userEmail: "candidate@example.test",
      prompt: "Instruction to rewrite",
    },
  });

  const buffer = getLogBuffer();
  assert.equal(buffer.length, 1);
  const logged = buffer[0];
  assert.equal(logged.event, "export_pdf_completed");
  assert.equal(logged.ownerId, "user_789");
  assert.equal(logged.metadata?.pageSize, "A4");
  assert.equal(logged.metadata?.watermarked, true);
  // PII must be completely stripped
  assert.equal((logged.metadata as any)?.rawText, undefined);
  assert.equal((logged.metadata as any)?.userEmail, undefined);
  assert.equal((logged.metadata as any)?.prompt, undefined);

  // 3. DATA RETENTION & CASCADING DELETION ACROSS ALL MIGRATIONS
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { database } = await import("../src/lib/server/database");
  const { saveResume, listResumes } = await import("../src/lib/server/resumes");
  const { client } = database();

  try {
    for (const name of [
      "001-foundation.sql",
      "002-ai-proposals.sql",
      "003-ai-evidence.sql",
      "004-subscriptions.sql",
    ]) {
      await client.executeMultiple(
        await readFile(`migrations/${name}`, "utf8"),
      );
    }

    // Insert user and cascade relations
    await client.execute(
      "INSERT INTO user VALUES ('target_user','Target','target@example.test',0,NULL,0,0)",
    );
    await client.execute(
      "INSERT INTO session VALUES ('s1',1000,'tok_1',0,0,'127.0.0.1','agent','target_user')",
    );
    await client.execute(
      "INSERT INTO subscriptions VALUES ('sub_1','target_user','cus_1','sub_stripe_1','job_hunter_monthly','active',9999,0,'2026-10-01','2026-10-01')",
    );
    await client.execute(
      "INSERT INTO subscription_usage VALUES ('usage_1','target_user','2026-10',2,5)",
    );

    const doc = await saveResume("target_user", createDocument(), null);
    assert.equal((await listResumes("target_user")).length, 1);

    await client.execute({
      sql: "INSERT INTO ai_requests(owner_id, id, resume_id, request_hash, base_revision, status, proposal, result_revision, created_at, expires_at) VALUES ('target_user','req_1',?,'hash_1',0,'review','{}',NULL,100,200)",
      args: [doc.id],
    });
    await client.execute(
      "INSERT INTO ai_owner_usage VALUES ('target_user','2026-10-08',3)",
    );

    // Delete user
    await client.execute("DELETE FROM user WHERE id='target_user'");

    // Verify complete cascade across all tables
    assert.equal((await listResumes("target_user")).length, 0);
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count(*) as c FROM session WHERE userId='target_user'",
          )
        ).rows[0].c,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count(*) as c FROM subscriptions WHERE user_id='target_user'",
          )
        ).rows[0].c,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count(*) as c FROM subscription_usage WHERE user_id='target_user'",
          )
        ).rows[0].c,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count(*) as c FROM ai_requests WHERE owner_id='target_user'",
          )
        ).rows[0].c,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count(*) as c FROM ai_owner_usage WHERE owner_id='target_user'",
          )
        ).rows[0].c,
      ),
      0,
    );

    // Verify foreign key integrity
    const fkCheck = await client.execute("PRAGMA foreign_key_check");
    assert.equal(fkCheck.rows.length, 0);
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
  }

  // 4. BACKUPS AND RESTORATION
  const validDoc = createDocument(true);
  const backupJson = JSON.stringify(validDoc, null, 2);
  const parsed = parseBackup(backupJson);
  assert.equal(parsed.id, validDoc.id);
  assert.equal(parsed.name, validDoc.name);

  // Rejection of invalid / corrupted backups without crashing
  assert.throws(() => parseBackup("not-json"));
  assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 999 })));
  assert.throws(() => parseBackup(JSON.stringify({ ...validDoc, schemaVersion: 2 })));
  assert.throws(() => parseBackup(JSON.stringify({ ...validDoc, revision: -5 })));
});
