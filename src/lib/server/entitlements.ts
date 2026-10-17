import { database } from "./database";
import {
  PLANS,
  betaTrialDays,
  normalizePlanId,
  type PlanConfig,
  type PlanId,
} from "../billing-plans";

export type { PlanConfig, PlanId };
export { PLANS };

export type EntitlementFeature =
  | "watermark_free_export"
  | "unlimited_variants"
  | "career_vault_storage"
  | "job_tailoring_engine"
  | "all_templates"
  | "ai_summary_drafts"
  | "cover_letters"
  | "job_coaching";

export interface UserSubscriptionDetails {
  planId: PlanId;
  plan: PlanConfig;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  /** True while the plan comes from the beta's free Go period. */
  beta: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Unix seconds when the current period (or beta) ends. */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  entitlements: Record<EntitlementFeature, boolean>;
}

function entitlementsFor(plan: PlanConfig, paid: boolean) {
  return {
    watermark_free_export: !plan.hasWatermark,
    unlimited_variants: plan.maxVariants > 1,
    career_vault_storage: paid,
    job_tailoring_engine: plan.maxTailoredPerMonth > 0,
    all_templates: plan.allTemplates,
    ai_summary_drafts: plan.aiSummaryDrafts,
    cover_letters: plan.coverLetters,
    job_coaching: plan.jobCoaching,
  };
}

function freeDetails(
  extra: Partial<UserSubscriptionDetails> = {},
): UserSubscriptionDetails {
  return {
    planId: "free",
    plan: PLANS.free,
    status: "none",
    beta: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    entitlements: entitlementsFor(PLANS.free, false),
    ...extra,
  };
}

/**
 * Beta: a signed-in account gets Go free for its first `BETA_GO_TRIAL_DAYS`
 * days (30 by default, 0 turns it off). No card or Stripe record is involved.
 */
async function betaTrial(userId: string, nowMs: number) {
  const days = betaTrialDays();
  if (!days) return null;
  const row = (
    await database().client.execute({
      sql: 'SELECT "createdAt" AS created FROM "user" WHERE id = ?',
      args: [userId],
    })
  ).rows[0];
  if (!row) return null;
  const endsMs = Number(row.created) + days * 86_400_000;
  if (!Number.isFinite(endsMs) || endsMs <= nowMs) return null;
  return freeDetails({
    planId: "go",
    plan: PLANS.go,
    status: "trialing",
    beta: true,
    currentPeriodEnd: Math.floor(endsMs / 1000),
    entitlements: entitlementsFor(PLANS.go, true),
  });
}

/**
 * Retrieves the plan a user has now: an active paid subscription, else the
 * beta's free Go period, else Free.
 */
export async function getUserSubscription(
  userId: string | null,
): Promise<UserSubscriptionDetails> {
  if (!userId) return freeDetails();
  const nowMs = Date.now();
  const { client } = database();
  const result = await client.execute({
    sql: "SELECT * FROM subscriptions WHERE user_id = ?",
    args: [userId],
  });
  const row = result.rows[0];
  if (row) {
    const planId = normalizePlanId(row.plan_id);
    const status = (row.status as string) || "canceled";
    const currentPeriodEnd = row.current_period_end
      ? Number(row.current_period_end)
      : null;
    const isActive =
      planId !== "free" &&
      (status === "active" || status === "trialing") &&
      (!currentPeriodEnd || currentPeriodEnd * 1000 > nowMs);
    if (isActive)
      return {
        planId,
        plan: PLANS[planId],
        status: status as "active" | "trialing",
        beta: false,
        stripeCustomerId: String(row.stripe_customer_id || ""),
        stripeSubscriptionId: row.stripe_subscription_id
          ? String(row.stripe_subscription_id)
          : null,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        entitlements: entitlementsFor(PLANS[planId], true),
      };
    const trial = await betaTrial(userId, nowMs);
    if (trial)
      return { ...trial, stripeCustomerId: String(row.stripe_customer_id || "") };
    return freeDetails({
      status: "canceled",
      stripeCustomerId: String(row.stripe_customer_id || ""),
      stripeSubscriptionId: row.stripe_subscription_id
        ? String(row.stripe_subscription_id)
        : null,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    });
  }
  return (await betaTrial(userId, nowMs)) ?? freeDetails();
}

/**
 * Checks a specific entitlement flag for a user.
 */
export async function checkEntitlement(
  userId: string | null,
  feature: EntitlementFeature,
): Promise<boolean> {
  const details = await getUserSubscription(userId);
  return details.entitlements[feature];
}

/**
 * Upserts a subscription record into the database (called by Stripe Webhook handler).
 */
export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  planId: PlanId;
  status: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const { client } = database();
  const id = `sub_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO subscriptions (
      id, user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end, cancel_at_period_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan_id = excluded.plan_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = excluded.updated_at`,
    args: [
      id,
      data.userId,
      data.stripeCustomerId,
      data.stripeSubscriptionId ?? null,
      data.planId,
      data.status,
      data.currentPeriodEnd ?? null,
      data.cancelAtPeriodEnd ? 1 : 0,
      now,
      now,
    ],
  });
}

/**
 * Records monthly consumption quota (tailored resumes or AI bullet actions).
 */
export async function recordUsage(
  userId: string,
  action: "tailored_resumes_generated" | "ai_bullet_rewrites",
) {
  const { client } = database();
  const periodMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const id = `usg_${crypto.randomUUID()}`;

  await client.execute({
    sql: `INSERT INTO subscription_usage (id, user_id, period_month, ${action})
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, period_month) DO UPDATE SET
      ${action} = ${action} + 1`,
    args: [id, userId, periodMonth],
  });
}

/**
 * Retrieves monthly feature usage for a given user.
 */
export async function getMonthlyUsage(
  userId: string,
): Promise<{ tailored_resumes_generated: number; ai_bullet_rewrites: number }> {
  const { client } = database();
  const periodMonth = new Date().toISOString().slice(0, 7);
  const result = await client.execute({
    sql: "SELECT tailored_resumes_generated, ai_bullet_rewrites FROM subscription_usage WHERE user_id = ? AND period_month = ?",
    args: [userId, periodMonth],
  });
  if (!result.rows.length) {
    return { tailored_resumes_generated: 0, ai_bullet_rewrites: 0 };
  }
  const row = result.rows[0];
  return {
    tailored_resumes_generated: Number(row.tailored_resumes_generated || 0),
    ai_bullet_rewrites: Number(row.ai_bullet_rewrites || 0),
  };
}

