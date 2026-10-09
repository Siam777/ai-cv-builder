import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLANS } from "../src/lib/billing-plans";

test("PLANS configuration provides valid tiers and feature matrices", () => {
  assert.ok(PLANS.free);
  assert.ok(PLANS.job_hunter_weekly);
  assert.ok(PLANS.job_hunter_monthly);
  assert.ok(PLANS.lifetime);

  assert.equal(PLANS.free.hasWatermark, true);
  assert.equal(PLANS.free.allTemplates, false);
  assert.equal(PLANS.free.maxVariants, 1);
  assert.equal(PLANS.free.maxTailoredPerMonth, 0);

  assert.equal(PLANS.job_hunter_monthly.hasWatermark, false);
  assert.equal(PLANS.job_hunter_monthly.allTemplates, true);
  assert.equal(PLANS.job_hunter_monthly.maxTailoredPerMonth, 50);

  assert.equal(PLANS.lifetime.hasWatermark, false);
  assert.equal(PLANS.lifetime.maxVariants, 500);
});

test("Subscription lifecycle, entitlement evaluation, and usage tracking", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { database } = await import("../src/lib/server/database");
  const {
    getUserSubscription,
    upsertSubscription,
    checkEntitlement,
    recordUsage,
    getMonthlyUsage,
  } = await import("../src/lib/server/entitlements");

  const { client } = database();
  try {
    // Apply migrations
    const m1 = await readFile("migrations/001-foundation.sql", "utf8");
    const m2 = await readFile("migrations/002-ai-proposals.sql", "utf8");
    const m3 = await readFile("migrations/003-ai-evidence.sql", "utf8");
    const m4 = await readFile("migrations/004-subscriptions.sql", "utf8");

    await client.executeMultiple(m1);
    await client.executeMultiple(m2);
    await client.executeMultiple(m3);
    await client.executeMultiple(m4);

    const testUserId = "user_billing_test";
    await client.execute({
      sql: "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [testUserId, "Billing Test User", "billing@example.test", 1, Date.now(), Date.now()],
    });

    // 1. Initial state: free user has no subscription record
    let sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "free");
    assert.equal(sub.entitlements.watermark_free_export, false);
    assert.equal(sub.entitlements.all_templates, false);

    let checkExport = await checkEntitlement(testUserId, "watermark_free_export");
    assert.equal(checkExport, false);

    let checkTailor = await checkEntitlement(testUserId, "job_tailoring_engine");
    assert.equal(checkTailor, false);

    // 2. Activate Job Hunter Monthly
    const futureSec = Math.floor(Date.now() / 1000) + 30 * 86400;
    await upsertSubscription({
      userId: testUserId,
      stripeCustomerId: "cus_12345",
      stripeSubscriptionId: "sub_12345",
      planId: "job_hunter_monthly",
      status: "active",
      currentPeriodEnd: futureSec,
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "job_hunter_monthly");
    assert.equal(sub.status, "active");
    assert.equal(sub.entitlements.watermark_free_export, true);
    assert.equal(sub.entitlements.all_templates, true);

    checkExport = await checkEntitlement(testUserId, "watermark_free_export");
    assert.equal(checkExport, true);

    checkTailor = await checkEntitlement(testUserId, "job_tailoring_engine");
    assert.equal(checkTailor, true);

    // 3. Test Usage Tracking & Quota Gating
    let usage = await getMonthlyUsage(testUserId);
    assert.equal(usage.tailored_resumes_generated, 0);

    // Record usage
    await recordUsage(testUserId, "tailored_resumes_generated");
    await recordUsage(testUserId, "tailored_resumes_generated");
    usage = await getMonthlyUsage(testUserId);
    assert.equal(usage.tailored_resumes_generated, 2);

    // Verify idempotent upsert on subscription update (e.g. renewal or plan change to lifetime)
    await upsertSubscription({
      userId: testUserId,
      stripeCustomerId: "cus_12345",
      stripeSubscriptionId: "sub_lifetime_999",
      planId: "lifetime",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "lifetime");
    assert.equal(sub.entitlements.watermark_free_export, true);
    assert.equal(sub.entitlements.all_templates, true);

    // 4. Test Downgrade / Canceled status
    await upsertSubscription({
      userId: testUserId,
      stripeCustomerId: "cus_12345",
      stripeSubscriptionId: "sub_lifetime_999",
      planId: "job_hunter_monthly",
      status: "canceled",
      currentPeriodEnd: Math.floor(Date.now() / 1000) - 3600, // expired 1 hr ago
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "free");
    assert.equal(sub.entitlements.watermark_free_export, false);
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
  }
});
