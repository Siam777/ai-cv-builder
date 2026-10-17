import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLANS, betaTrialDays, normalizePlanId } from "../src/lib/billing-plans";

test("three monthly tiers: Free, Go at $9.99 and Pro at $29.99", () => {
  assert.deepEqual(Object.keys(PLANS), ["free", "go", "pro"]);
  assert.equal(PLANS.free.priceCents, 0);
  assert.equal(PLANS.go.priceCents, 999);
  assert.equal(PLANS.pro.priceCents, 2999);
  assert.equal(PLANS.go.cadence, "month");
  assert.equal(PLANS.pro.cadence, "month");

  assert.equal(PLANS.free.hasWatermark, true);
  assert.equal(PLANS.free.maxTailoredPerMonth, 0);
  assert.equal(PLANS.free.aiRequestsPerDay, 5);
  assert.equal(PLANS.free.aiSummaryDrafts, false);
  assert.equal(PLANS.free.coverLetters, false);

  assert.equal(PLANS.go.hasWatermark, false);
  assert.equal(PLANS.go.aiRequestsPerDay, 50);
  assert.equal(PLANS.go.maxTailoredPerMonth, 20);
  assert.equal(PLANS.go.aiSummaryDrafts, true);
  assert.equal(PLANS.go.coverLetters, true);
  assert.equal(PLANS.go.jobCoaching, false);

  assert.equal(PLANS.pro.aiRequestsPerDay, 200);
  assert.equal(PLANS.pro.maxTailoredPerMonth, Infinity);
  assert.equal(PLANS.pro.jobCoaching, true);
});

test("old plan IDs map to the new tiers", () => {
  assert.equal(normalizePlanId("job_hunter_weekly"), "go");
  assert.equal(normalizePlanId("job_hunter_monthly"), "go");
  assert.equal(normalizePlanId("lifetime"), "pro");
  assert.equal(normalizePlanId("pro"), "pro");
  assert.equal(normalizePlanId("unknown"), "free");
  assert.equal(normalizePlanId(undefined), "free");
});

test("the beta trial length can be changed or switched off", () => {
  assert.equal(betaTrialDays({}), 30);
  assert.equal(betaTrialDays({ BETA_GO_TRIAL_DAYS: "0" }), 0);
  assert.equal(betaTrialDays({ BETA_GO_TRIAL_DAYS: "14" }), 14);
  assert.equal(betaTrialDays({ BETA_GO_TRIAL_DAYS: "soon" }), 30);
});

test("Subscription lifecycle, entitlement evaluation, and usage tracking", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  // The beta trial is tested separately below.
  process.env.BETA_GO_TRIAL_DAYS = "0";
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
    assert.equal(sub.beta, false);

    let checkExport = await checkEntitlement(testUserId, "watermark_free_export");
    assert.equal(checkExport, false);

    let checkTailor = await checkEntitlement(testUserId, "job_tailoring_engine");
    assert.equal(checkTailor, false);

    // 2. Activate Go
    const futureSec = Math.floor(Date.now() / 1000) + 30 * 86400;
    await upsertSubscription({
      userId: testUserId,
      stripeCustomerId: "cus_12345",
      stripeSubscriptionId: "sub_12345",
      planId: "go",
      status: "active",
      currentPeriodEnd: futureSec,
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "go");
    assert.equal(sub.status, "active");
    assert.equal(sub.entitlements.ai_summary_drafts, true);
    assert.equal(sub.entitlements.job_coaching, false);
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
      stripeSubscriptionId: "sub_pro_999",
      planId: "pro",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "pro");
    assert.equal(sub.entitlements.job_coaching, true);
    assert.equal(sub.entitlements.watermark_free_export, true);
    assert.equal(sub.entitlements.all_templates, true);

    // 4. Test Downgrade / Canceled status
    await upsertSubscription({
      userId: testUserId,
      stripeCustomerId: "cus_12345",
      stripeSubscriptionId: "sub_pro_999",
      planId: "go",
      status: "canceled",
      currentPeriodEnd: Math.floor(Date.now() / 1000) - 3600, // expired 1 hr ago
      cancelAtPeriodEnd: false,
    });

    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "free");
    assert.equal(sub.entitlements.watermark_free_export, false);

    // 5. Beta: a new account gets Go free for 30 days, then Free.
    process.env.BETA_GO_TRIAL_DAYS = "30";
    const created = Date.now() - 5 * 86_400_000;
    await client.execute({
      sql: "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["user_beta", "Beta", "beta@example.test", 1, created, created],
    });
    sub = await getUserSubscription("user_beta");
    assert.equal(sub.planId, "go");
    assert.equal(sub.status, "trialing");
    assert.equal(sub.beta, true);
    assert.equal(sub.entitlements.watermark_free_export, true);
    assert.equal(sub.currentPeriodEnd, Math.floor((created + 30 * 86_400_000) / 1000));
    await client.execute({
      sql: "UPDATE user SET createdAt = ? WHERE id = ?",
      args: [Date.now() - 31 * 86_400_000, "user_beta"],
    });
    sub = await getUserSubscription("user_beta");
    assert.equal(sub.planId, "free");
    assert.equal(sub.beta, false);
    // With the beta off, an expired paid plan is Free.
    process.env.BETA_GO_TRIAL_DAYS = "0";
    sub = await getUserSubscription(testUserId);
    assert.equal(sub.planId, "free");
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.BETA_GO_TRIAL_DAYS;
  }
});
